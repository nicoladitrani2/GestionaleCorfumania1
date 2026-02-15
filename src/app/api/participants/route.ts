import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import nodemailer from 'nodemailer'

export const dynamic = 'force-dynamic'

function encodeDocumentInfo(docType?: string, docNumber?: string): string | null {
  if (!docType && !docNumber) return null
  try {
    return JSON.stringify({ docType: docType || null, docNumber: docNumber || null })
  } catch {
    return docNumber || null
  }
}

function decodeDocumentInfo(ticketNumber?: string | null): { docType?: string | null; docNumber?: string | null } {
  if (!ticketNumber) return {}
  try {
    const parsed = JSON.parse(ticketNumber)
    if (parsed && typeof parsed === 'object') {
      return {
        docType: typeof parsed.docType === 'string' ? parsed.docType : null,
        docNumber: typeof parsed.docNumber === 'string' ? parsed.docNumber : null,
      }
    }
    return { docNumber: ticketNumber }
  } catch {
    return { docNumber: ticketNumber }
  }
}

function mapParticipantForClient(p: any) {
  const { user, client, assignedTo, ...rest } = p
  const paymentType = rest.paymentType || 'BALANCE'

  const clientFirstName = client?.firstName || ''
  const clientLastName = client?.lastName || ''
  const clientEmail = client?.email || null
  const clientPhone = client?.phoneNumber || null
  const clientNationality = client?.nationality || null

  const documentInfo = decodeDocumentInfo(rest.ticketNumber)

  return {
    ...rest,
    createdBy: user,
    createdById: rest.userId,
    assignedTo,
    assignedToId: rest.assignedToId,
    price: rest.totalPrice,
    deposit: rest.paidAmount || 0,
    isOption: paymentType === 'OPTION',
    paymentType,
    phoneNumber: clientPhone || rest.phone,
    email: clientEmail || rest.email,
    firstName: clientFirstName,
    lastName: clientLastName,
    nationality: clientNationality || rest.nationality,
    docType: documentInfo.docType || null,
    docNumber: documentInfo.docNumber || null,
    accommodation: rest.roomNumber || null,
    pickupTime: rest.pickupTime || null,
  }
}

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const excursionId = searchParams.get('excursionId')
  const transferId = searchParams.get('transferId')
  const isRental = searchParams.get('isRental') === 'true'
  const search = searchParams.get('search') || undefined

  if (!excursionId && !transferId && !isRental) return NextResponse.json({ error: 'Excursion ID, Transfer ID, or isRental required' }, { status: 400 })

  const whereClause: any = {}
  if (excursionId) whereClause.excursionId = excursionId
  if (transferId) whereClause.transferId = transferId
  if (isRental) whereClause.rentalId = { not: null }
  if (search) {
    whereClause.notes = { contains: search, mode: 'insensitive' }
  }

  // Auto-expire logic DISABLED due to schema changes
  /*
  const now = new Date()
  if (excursionId) { ... }
  */

  const participants = await prisma.participant.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          code: true,
          role: true,
          agencyId: true,
          agency: {
            select: {
              name: true,
              defaultCommission: true,
              commissionType: true
            }
          }
        }
      },
      assignedTo: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          agencyId: true,
          agency: {
            select: {
              name: true,
              defaultCommission: true,
              commissionType: true
            }
          }
        }
      },
      client: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phoneNumber: true,
          nationality: true,
        }
      }
    }
  })

  const mapped = participants.map(mapParticipantForClient)

  return NextResponse.json(mapped)
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()

    // Validation
    if (body.firstName !== undefined && !body.firstName?.trim()) {
      return NextResponse.json({ error: 'Il nome è obbligatorio.' }, { status: 400 })
    }
    
    const { 
      excursionId, transferId, rentalId,
      firstName, lastName, email, phoneNumber, 
      adults, children, infants,
      price, tax, 
      paymentType, paymentMethod,
      notes, supplier, pickupLocation, dropoffLocation,
      nationality,
      dateOfBirth,
      docNumber,
      docType,
      isOption,
      deposit,
      depositPaymentMethod,
      balancePaymentMethod,
      commissionPercentage,
      pickupTime,
      returnPickupLocation,
      returnDropoffLocation,
      returnDate,
      returnTime,
      isRental,
      rentalType,
      rentalStartDate,
      rentalEndDate,
      accommodation,
      needsTransfer,
      licenseType,
      insurancePrice,
      supplementPrice,
      assistantCommission,
      assistantCommissionType,
      assignedToId: rawAssignedToId
    } = body

    const name = `${firstName || ''} ${lastName || ''}`.trim()
    const totalPrice = parseFloat(String(price)) || 0
    const totalTax = parseFloat(String(tax)) || 0
    const depositAmount = parseFloat(String(deposit || 0)) || 0
    
    let clientId: string | null = null
    if (firstName && lastName) {
      if (email) {
        const existing = await prisma.client.findUnique({ where: { email } }).catch(() => null)
        if (existing) {
          clientId = existing.id
        } else {
          const created = await prisma.client.create({
            data: {
              firstName,
              lastName,
              email,
              phoneNumber,
              nationality
            }
          }).catch(() => null)
          clientId = created?.id || null
        }
      } else {
        const created = await prisma.client.create({
          data: {
            firstName,
            lastName,
            email: null,
            phoneNumber,
            nationality
          }
        }).catch(() => null)
        clientId = created?.id || null
      }
    }
    
    // Auto-calc and approval logic for Excursions/Transfers (discount approval)
    let finalPaymentStatus = 'PENDING'
    let finalTotalPrice = totalPrice
    let approvalStatus: 'PENDING' | 'APPROVED' | null = null
    let originalPrice: number | null = null

    if (excursionId) {
      const excursion = await prisma.excursion.findUnique({
        where: { id: excursionId },
        select: { priceAdult: true, priceChild: true }
      })
      if (excursion) {
        const adultsNum = parseInt(adults) || 0
        const childrenNum = parseInt(children) || 0
        const calculated = (adultsNum * (excursion.priceAdult || 0)) + (childrenNum * (excursion.priceChild || 0))
        if (finalTotalPrice <= 0) finalTotalPrice = calculated
        const isAdmin = session.user.role === 'ADMIN'
        if (!isAdmin && finalTotalPrice < calculated - 0.01) {
          finalPaymentStatus = 'PENDING_APPROVAL'
          approvalStatus = 'PENDING'
          originalPrice = calculated
        } else {
          approvalStatus = 'APPROVED'
        }
      }
    } else if (transferId) {
      const transfer = await prisma.transfer.findUnique({
        where: { id: transferId },
        select: { priceAdult: true, priceChild: true }
      })
      if (transfer) {
        const adultsNum = parseInt(adults) || 0
        const childrenNum = parseInt(children) || 0
        const calculated = (adultsNum * (transfer.priceAdult || 0)) + (childrenNum * (transfer.priceChild || 0))
        if (finalTotalPrice <= 0) finalTotalPrice = calculated
        const isAdmin = session.user.role === 'ADMIN'
        if (!isAdmin && finalTotalPrice < calculated - 0.01) {
          finalPaymentStatus = 'PENDING_APPROVAL'
          approvalStatus = 'PENDING'
          originalPrice = calculated
        } else {
          approvalStatus = 'APPROVED'
        }
      }
    }

    const rawPaymentType = paymentType || (isOption ? 'OPTION' : 'BALANCE')
    let paidAmount = 0

    if (rawPaymentType === 'BALANCE' && finalPaymentStatus !== 'PENDING_APPROVAL') {
      paidAmount = finalTotalPrice
      if (finalPaymentStatus === 'PENDING') {
        finalPaymentStatus = 'PAID'
      }
    } else if (rawPaymentType === 'DEPOSIT') {
      paidAmount = depositAmount
      if (finalPaymentStatus === 'PENDING') {
        finalPaymentStatus = 'PARTIAL'
      }
    } else if (rawPaymentType === 'OPTION') {
      paidAmount = 0
      if (finalPaymentStatus === 'PENDING') {
        finalPaymentStatus = 'PENDING'
      }
    }

    const ticketNumberValue = encodeDocumentInfo(docType, docNumber)

    let assignedToId: string | null = null
    if (session.user.role === 'ADMIN') {
      if (rawAssignedToId && typeof rawAssignedToId === 'string') {
        assignedToId = rawAssignedToId
      }
    } else {
      assignedToId = session.user.id
    }

    let resolvedRentalId: string | null = rentalId || null
    if ((isRental || rentalType) && !resolvedRentalId) {
      const safeType = rentalType || 'CAR'
      let typeLabel = 'Auto'
      if (safeType === 'MOTO') typeLabel = 'Moto'
      else if (safeType === 'BOAT') typeLabel = 'Barca'
      const rentalName = `Noleggio ${typeLabel}`

      const rental = await prisma.rental.create({
        data: {
          name: rentalName,
          type: safeType
        }
      })
      resolvedRentalId = rental.id
    }

    const participant = await prisma.participant.create({
      data: {
        excursionId: excursionId || null,
        transferId: transferId || null,
        rentalId: resolvedRentalId,
        name,
        email,
        phone: phoneNumber,
        nationality,
        adults: parseInt(adults) || 0,
        children: parseInt(children) || 0,
        infants: parseInt(infants) || 0,
        notes,
        supplier,
        pickupLocation,
        pickupTime,
        dropoffLocation,
        returnPickupLocation,
        returnDropoffLocation,
        returnDate: returnDate ? new Date(returnDate) : null,
        returnTime,
        isRoundTrip: !!returnDate,
        roomNumber: accommodation || null,
        ticketNumber: ticketNumberValue,
        totalPrice: finalTotalPrice,
        paidAmount,
        tax: totalTax,
        paymentMethod: paymentMethod || 'CASH',
        paymentStatus: finalPaymentStatus,
        paymentType: rawPaymentType,
        status: 'ACTIVE',
        userId: session.user.id,
        clientId,
        assignedToId,

        // Campi specifici per i noleggi
        rentalType: isRental ? rentalType || null : null,
        rentalStartDate: isRental && rentalStartDate ? new Date(rentalStartDate) : null,
        rentalEndDate: isRental && rentalEndDate ? new Date(rentalEndDate) : null,
        licenseType: isRental ? licenseType || null : null,
        insurancePrice: isRental ? insurancePrice || 0 : 0,
        supplementPrice: isRental ? supplementPrice || 0 : 0,
        assistantCommission: isRental ? assistantCommission || 0 : 0,
        assistantCommissionType: isRental ? assistantCommissionType || 'PERCENTAGE' : null,
        needsTransfer: !!needsTransfer,
        commissionPercentage: commissionPercentage || 0
      }
    })

    await createAuditLog(
      session.user.id,
      'CREATE_PARTICIPANT',
      'PARTICIPANT',
      participant.id,
      `Creato partecipante ${participant.id} - ${name} (Totale: €${finalTotalPrice.toFixed(2)})`,
      excursionId || null,
      transferId || null
    )

    // Send confirmation email with attachments if provided and not pending approval
    try {
      if (email && finalPaymentStatus !== 'PENDING_APPROVAL' && (body.pdfAttachmentIT || body.pdfAttachmentEN)) {
        const transporter = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 465,
          secure: true,
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          },
          tls: {
            rejectUnauthorized: false
          }
        })
        
        const attachments: any[] = []
        const safeName = name || `${firstName || ''} ${lastName || ''}`.trim() || 'Cliente'

        if (body.pdfAttachmentIT) {
          attachments.push({
            filename: `Voucher_${safeName}_IT.pdf`,
            content: Buffer.from(body.pdfAttachmentIT, 'base64')
          })
        }
        if (body.pdfAttachmentEN) {
          attachments.push({
            filename: `Voucher_${safeName}_EN.pdf`,
            content: Buffer.from(body.pdfAttachmentEN, 'base64')
          })
        }

        await transporter.sendMail({
          from: `"Corfumania" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: 'Conferma Prenotazione - Corfumania',
          text: `Gentile ${safeName},\n\nLa tua prenotazione è stata registrata. In allegato trovi il voucher (IT/EN).\n\nCordiali saluti,\nTeam Corfumania`,
          attachments
        })
        console.log('[CREATE] Email sent to', email)
      }
    } catch (emailError) {
      console.error('[CREATE] Email sending failed:', emailError)
    }

    let participantWithUser = await prisma.participant.findUnique({
      where: { id: participant.id },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            code: true,
            role: true,
            agencyId: true,
            agency: {
              select: {
                name: true,
                defaultCommission: true,
                commissionType: true
              }
            }
          }
        },
        assignedTo: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            agencyId: true,
            agency: {
              select: {
                name: true,
                defaultCommission: true,
                commissionType: true
              }
            }
          }
        }
      }
    })

    if (!participantWithUser) {
      participantWithUser = {
        ...participant,
        user: {
          firstName: session.user.firstName,
          lastName: session.user.lastName,
          email: session.user.email,
          code: session.user.code,
          role: session.user.role,
          agencyId: session.user.agencyId,
          agency: null,
        },
      }
    }

    const responsePayload = {
      ...mapParticipantForClient(participantWithUser),
      approvalStatus,
      originalPrice,
    }

    return NextResponse.json(responsePayload)
  } catch (error) {
    console.error('Error creating participant:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
