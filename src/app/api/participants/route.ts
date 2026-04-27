import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import { sendMail } from '@/lib/mailer'

export const dynamic = 'force-dynamic'

function buildApiErrorPayload(error: unknown, fallback: string) {
  const details = error instanceof Error ? error.message : String(error)
  const payload: {
    error: string
    details?: string
    code?: string
    meta?: Record<string, unknown>
    hint?: string[]
  } = { error: fallback, details }

  const hints: string[] = []

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    payload.code = error.code
    payload.meta = (error.meta ?? {}) as Record<string, unknown>
  } else if (error instanceof Prisma.PrismaClientInitializationError) {
    payload.code = 'PRISMA_INIT'
  } else if (error instanceof Prisma.PrismaClientRustPanicError) {
    payload.code = 'PRISMA_PANIC'
  } else if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    payload.code = 'PRISMA_UNKNOWN'
  }

  const lower = String(details || '').toLowerCase()
  if (lower.includes('does not exist') || lower.includes('relation') || payload.code === 'P2021') {
    hints.push('Sembra mancare una tabella/colonna nel database: verifica di aver eseguito le migrazioni Prisma.')
    hints.push('Esegui: npx prisma migrate dev (oppure npx prisma migrate deploy in produzione).')
  }
  if (lower.includes("can't reach database") || lower.includes('p1001')) {
    hints.push('Il database non è raggiungibile: verifica host/porta e che il container/servizio sia avviato.')
  }

  if (hints.length > 0) payload.hint = hints
  if (process.env.NODE_ENV !== 'production' && error instanceof Error) {
    payload.meta = { ...(payload.meta || {}), stack: error.stack }
  }

  return payload
}

const carGrossSuppliers = new Set(
  (process.env.RENTAL_CAR_GROSS_SUPPLIERS || process.env.NEXT_PUBLIC_RENTAL_CAR_GROSS_SUPPLIERS || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
)

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

function normalizeRentalType(raw: any): string | null {
  if (!raw) return null
  const normalized = String(raw).toUpperCase()
  if (normalized === 'SCOOTER' || normalized === 'QUAD') return 'MOTO'
  if (normalized === 'CAR_GROSS') return 'MOTO'
  if (normalized === 'AUTO') return 'CAR'
  if (normalized === 'BARCA') return 'BOAT'
  return normalized
}

function normalizeCountsByTier(raw: unknown): Record<string, number> | null {
  if (!raw || typeof raw !== 'object') return null
  const result: Record<string, number> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = String(key || '').trim()
    if (!id) continue
    const n = typeof value === 'number' ? value : parseInt(String(value || '0'))
    if (!Number.isFinite(n)) continue
    const qty = Math.max(0, Math.floor(n))
    if (qty > 0) result[id] = qty
  }
  return Object.keys(result).length > 0 ? result : null
}

function sumCountsByTier(counts: Record<string, number> | null): number {
  if (!counts) return 0
  return Object.values(counts).reduce((sum, n) => sum + (Number.isFinite(n) ? n : 0), 0)
}

function computeExpectedPriceFromTiers(
  counts: Record<string, number> | null,
  tiers: Array<{ id: string; price: number }> | null | undefined
): number | null {
  if (!counts || !tiers || tiers.length === 0) return null
  const priceById = new Map<string, number>()
  for (const t of tiers) {
    const id = String(t.id || '')
    if (!id) continue
    const price = Number(t.price || 0)
    priceById.set(id, Number.isFinite(price) ? price : 0)
  }
  let total = 0
  let hasAny = false
  for (const [tierId, qty] of Object.entries(counts)) {
    if (!tierId) continue
    const q = Number(qty || 0)
    if (!Number.isFinite(q) || q <= 0) continue
    hasAny = true
    total += q * (priceById.get(tierId) || 0)
  }
  return hasAny ? total : 0
}

function computeRentalBreakdown(p: any) {
  if (!p?.rentalId) return null

  const rawRentalType = p.rentalType || p.rental?.type
  const rentalType = normalizeRentalType(rawRentalType)
  const gross = Number(p.totalPrice || 0)
  const tax = Number(p.tax || 0)
  const insurance = Number(p.insurancePrice || 0)
  const supplement = Number(p.supplementPrice || 0)

  const supplierName = String(p.supplier || '').trim().toLowerCase()
  const operator = p.assignedTo || p.user
  const operatorAgencyName = String(operator?.agency?.name || '').trim().toLowerCase()
  const referenceAgencyName = String(p.agency?.name || operatorAgencyName).trim().toLowerCase()
  const isGo4Sea = referenceAgencyName.includes('go4sea')
  const excludedCosts =
    rentalType === 'CAR'
      ? (Math.max(0, insurance) + Math.max(0, tax) + Math.max(0, supplement))
      : 0

  const commissionBase = rentalType === 'CAR' ? Math.max(0, gross - excludedCosts) : Math.max(0, gross)

  const commissionTotal = commissionBase * 0.2
  const agentShare = commissionBase * 0.05
  const companyShare = commissionBase * (isGo4Sea ? 0.05 : 0.15)
  const go4SeaShare = isGo4Sea ? commissionBase * 0.1 : 0
  const supplierOut = Math.max(0, gross - commissionTotal)

  const companyNow = rentalType === 'BOAT' ? companyShare : 0
  const companyFuture = rentalType === 'BOAT' ? 0 : companyShare

  return {
    rentalType,
    rentalGross: gross,
    rentalExcludedCosts: excludedCosts,
    rentalCommissionBase: commissionBase,
    rentalCommissionTotal: commissionTotal,
    rentalAgentShare: agentShare,
    rentalCompanyShare: companyShare,
    rentalGo4SeaShare: go4SeaShare,
    rentalSupplierOut: supplierOut,
    rentalCompanyNow: companyNow,
    rentalCompanyFuture: companyFuture,
    rentalIsGo4Sea: isGo4Sea
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
  const rentalBreakdown = computeRentalBreakdown(p)

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
    ...(rentalBreakdown || {})
  }
}

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
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
        client: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
            nationality: true,
          }
        },
        agency: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    const mapped = participants.map(mapParticipantForClient)

    return NextResponse.json(mapped)
  } catch (error) {
    console.error('Error fetching participants:', error)
    return NextResponse.json(buildApiErrorPayload(error, 'Errore durante il recupero dei partecipanti'), { status: 500 })
  }
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
      countsByTier,
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
      assignedToId: rawAssignedToId,
      agencyId
    } = body

    const name = `${firstName || ''} ${lastName || ''}`.trim()
    const totalPrice = parseFloat(String(price)) || 0
    const totalTax = parseFloat(String(tax)) || 0
    const depositAmount = parseFloat(String(deposit || 0)) || 0

    const normalizedCountsByTier = normalizeCountsByTier(countsByTier)
    const paxFromTiers = sumCountsByTier(normalizedCountsByTier)
    const paxFromLegacy = (parseInt(adults) || 0) + (parseInt(children) || 0) + (parseInt(infants) || 0)
    const paxTotal = paxFromTiers > 0 ? paxFromTiers : paxFromLegacy
    
    // Check Max Participants
    if (excursionId) {
      const excursion = await prisma.excursion.findUnique({
        where: { id: excursionId },
        select: { maxParticipants: true }
      })
      if (excursion?.maxParticipants) {
        const currentStats = await prisma.participant.aggregate({
          where: {
            excursionId,
            status: 'ACTIVE',
            paymentType: { not: 'REFUNDED' },
            approvalStatus: { not: 'REJECTED' }
          },
          _sum: { adults: true, children: true, infants: true }
        })
        const currentTotal = (currentStats._sum.adults || 0) + (currentStats._sum.children || 0) + (currentStats._sum.infants || 0)
        const newTotal = paxTotal
        
        if (currentTotal + newTotal > excursion.maxParticipants) {
          return NextResponse.json({ error: `Numero massimo di partecipanti raggiunto (${excursion.maxParticipants}).` }, { status: 400 })
        }
      }
    } else if (transferId) {
      const transfer = await prisma.transfer.findUnique({
        where: { id: transferId },
        select: { maxParticipants: true }
      })
      if (transfer?.maxParticipants) {
        const currentStats = await prisma.participant.aggregate({
          where: {
            transferId,
            status: 'ACTIVE',
            paymentType: { not: 'REFUNDED' },
            approvalStatus: { not: 'REJECTED' }
          },
          _sum: { adults: true, children: true, infants: true }
        })
        const currentTotal = (currentStats._sum.adults || 0) + (currentStats._sum.children || 0) + (currentStats._sum.infants || 0)
        const newTotal = paxTotal
        
        if (currentTotal + newTotal > transfer.maxParticipants) {
          return NextResponse.json({ error: `Numero massimo di partecipanti raggiunto (${transfer.maxParticipants}).` }, { status: 400 })
        }
      }
    }

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
        select: { priceAdult: true, priceChild: true, priceTiers: { select: { id: true, price: true } } }
      })
      if (excursion) {
        const calculatedFromTiers = computeExpectedPriceFromTiers(normalizedCountsByTier, excursion.priceTiers)
        const adultsNum = parseInt(adults) || 0
        const childrenNum = parseInt(children) || 0
        const calculatedLegacy = (adultsNum * (excursion.priceAdult || 0)) + (childrenNum * (excursion.priceChild || 0))
        const calculated = calculatedFromTiers ?? calculatedLegacy
        if (finalTotalPrice <= 0) finalTotalPrice = calculated
        const isAdmin = session.user.role === 'ADMIN'
        if (!isAdmin && Math.abs(finalTotalPrice - calculated) > 0.01) {
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
        select: { priceAdult: true, priceChild: true, approvalStatus: true, priceTiers: { select: { id: true, price: true } } }
      })
      if (transfer) {
        if (transfer.approvalStatus === 'REJECTED') {
          return NextResponse.json(
            { error: 'Trasferimento rifiutato: non è possibile aggiungere partecipanti.' },
            { status: 400 }
          )
        }
        const calculatedFromTiers = computeExpectedPriceFromTiers(normalizedCountsByTier, transfer.priceTiers)
        const adultsNum = parseInt(adults) || 0
        const childrenNum = parseInt(children) || 0
        const calculatedLegacy = (adultsNum * (transfer.priceAdult || 0)) + (childrenNum * (transfer.priceChild || 0))
        const calculated = calculatedFromTiers ?? calculatedLegacy
        if (finalTotalPrice <= 0) finalTotalPrice = calculated
        const isAdmin = session.user.role === 'ADMIN'
        
        // Transfer Not Approved OR Price too low -> Pending Approval
        if (transfer.approvalStatus !== 'APPROVED') {
             finalPaymentStatus = 'PENDING_APPROVAL'
             approvalStatus = 'PENDING'
             originalPrice = calculated
        } else if (!isAdmin && Math.abs(finalTotalPrice - calculated) > 0.01) {
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

    if (isRental) {
      paidAmount = depositAmount
      if (finalPaymentStatus === 'PENDING') {
        finalPaymentStatus = 'PAID'
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
        adults: paxFromTiers > 0 ? paxFromTiers : (parseInt(adults) || 0),
        children: paxFromTiers > 0 ? 0 : (parseInt(children) || 0),
        infants: paxFromTiers > 0 ? 0 : (parseInt(infants) || 0),
        ...(normalizedCountsByTier ? { countsByTier: normalizedCountsByTier } : {}),
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
        commissionPercentage: commissionPercentage || 0,
        agencyId,
        approvalStatus: approvalStatus || 'APPROVED'
      }
    })

    await createAuditLog(
      session.user.id,
      'CREATE_PARTICIPANT',
      'PARTICIPANT',
      participant.id,
      `Creato partecipante ${participant.id} - ${name} (Totale: €${finalTotalPrice.toFixed(2)})`,
      excursionId || null,
      transferId || null,
      resolvedRentalId
    )

    const notifyAdminUserIds = Array.isArray((body as any).notifyAdminUserIds)
      ? (body as any).notifyAdminUserIds.map((x: any) => String(x)).filter(Boolean)
      : []

    if (
      session.user.role !== 'ADMIN' &&
      (finalPaymentStatus === 'PENDING_APPROVAL' || approvalStatus === 'PENDING')
    ) {
      const admins = await prisma.user.findMany({
        where: notifyAdminUserIds.length > 0 ? { id: { in: notifyAdminUserIds }, role: 'ADMIN' } : { role: 'ADMIN' },
        select: { email: true },
      })

      const eventName = excursionId ? 'Escursione' : transferId ? 'Trasferimento' : resolvedRentalId ? 'Noleggio' : 'Prenotazione'
      const safeName = name || `${firstName || ''} ${lastName || ''}`.trim() || 'Cliente'
      const requestedLine = `Totale richiesto: €${finalTotalPrice.toFixed(2)}`
      const requester = `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || session.user.email || session.user.id

      const text = [
        'Richiesta in attesa di approvazione.',
        `Tipo: ${eventName}`,
        `Cliente: ${safeName}`,
        requestedLine,
        `Richiedente: ${requester}`,
        `ID partecipante: ${participant.id}`,
      ].filter(Boolean).join('\n')

      const adminEmails = admins
        .map(a => a.email)
        .filter((e): e is string => typeof e === 'string' && e.trim().length > 0)
      if (adminEmails.length === 0) {
        try {
          await createAuditLog(
            session.user.id,
            'NOTIFY_ADMINS_SKIPPED',
            'PARTICIPANT',
            participant.id,
            'Notifica admin non inviata: nessun destinatario valido',
            excursionId || null,
            transferId || null,
            resolvedRentalId
          )
        } catch {}
      }

      let okCount = 0
      let failCount = 0
      for (const to of adminEmails) {
        try {
          await sendMail({
            to,
            subject: `Approvazione richiesta: ${eventName}`,
            text,
          })
          okCount += 1
        } catch {
          failCount += 1
        }
      }

      try {
        await createAuditLog(
          session.user.id,
          'NOTIFY_ADMINS_APPROVAL',
          'PARTICIPANT',
          participant.id,
          `Notifica admin inviata: ok=${okCount}, fail=${failCount}`,
          excursionId || null,
          transferId || null,
          resolvedRentalId
        )
      } catch {}
    }

    // Send confirmation email to participant (attachments optional)
    try {
      // Send if email exists AND (payment is not pending OR it is a transfer pending approval)
      // Actually, user requested email for transfer pending approval.
      // And existing logic was: if email && finalPaymentStatus !== 'PENDING_APPROVAL'
      // We need to allow email for PENDING_APPROVAL if it's a Transfer (or generally if requested?)
      // User said: "Email Transfer Non Approvati... deve indicare chiaramente che è in attesa"
      
      const shouldSend = !!email
      
      if (shouldSend) {
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
        
        let subject = 'Conferma Prenotazione - Corfumania'
        let text = `Gentile ${safeName},\n\nLa tua prenotazione è stata registrata. In allegato trovi il voucher (IT/EN).\n\nCordiali saluti,\nTeam Corfumania`
        
        if (finalPaymentStatus === 'PENDING_APPROVAL') {
             const paidLine = paidAmount > 0.01 ? `Hai versato: €${paidAmount.toFixed(2)}\n` : ''
             subject = 'Prenotazione in Attesa di Approvazione / Reservation Pending Approval - Corfumania'
             text = `Gentile ${safeName},\n\nLa tua prenotazione è stata ricevuta ed è in attesa di approvazione.\n${paidLine}Totale prenotazione: €${finalTotalPrice.toFixed(2)}\nRiceverai una conferma definitiva appena possibile.\n\nIn allegato trovi i dettagli della richiesta.\n\nCordiali saluti,\nTeam Corfumania\n\n---\n\nDear ${safeName},\n\nYour reservation has been received and is pending approval.\n${paidAmount > 0.01 ? `Paid: €${paidAmount.toFixed(2)}\n` : ''}Total: €${finalTotalPrice.toFixed(2)}\nYou will receive a final confirmation as soon as possible.\n\nPlease find attached the request details.\n\nBest regards,\nCorfumania Team`
        }

        const result = await sendMail({
          to: email,
          subject,
          text,
          attachments: attachments.length > 0 ? attachments : undefined,
        })
        try {
          await createAuditLog(
            session.user.id,
            'SEND_PARTICIPANT_EMAIL',
            'PARTICIPANT',
            participant.id,
            `Inviata email (${subject}) a ${email}${result.previewUrl ? ` (preview: ${result.previewUrl})` : ''}`,
            excursionId || null,
            transferId || null,
            resolvedRentalId
          )
        } catch {}
      }
    } catch (emailError) {
      try {
        await createAuditLog(
          session.user.id,
          'SEND_PARTICIPANT_EMAIL_FAILED',
          'PARTICIPANT',
          participant.id,
          `Invio email fallito: ${(emailError as any)?.message || 'Errore sconosciuto'}`,
          excursionId || null,
          transferId || null,
          resolvedRentalId
        )
      } catch {}
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
        assignedTo: null
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
    return NextResponse.json(buildApiErrorPayload(error, 'Errore durante il salvataggio del partecipante'), { status: 500 })
  }
}
