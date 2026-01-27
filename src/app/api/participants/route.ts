import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import nodemailer from 'nodemailer'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const excursionId = searchParams.get('excursionId')
  const transferId = searchParams.get('transferId')
  const isRental = searchParams.get('isRental') === 'true'

  if (!excursionId && !transferId && !isRental) return NextResponse.json({ error: 'Excursion ID, Transfer ID, or isRental required' }, { status: 400 })

  const whereClause: any = {}
  if (excursionId) whereClause.excursionId = excursionId
  if (transferId) whereClause.transferId = transferId
  if (isRental) whereClause.isRental = true

  // Auto-expire logic on fetch
  const now = new Date()
  if (excursionId) {
      const excursion = await prisma.excursion.findUnique({
          where: { id: excursionId },
          select: { confirmationDeadline: true }
      })
      if (excursion?.confirmationDeadline && new Date(excursion.confirmationDeadline) < now) {
          await prisma.participant.updateMany({
              where: {
                  excursionId,
                  isExpired: false,
                  OR: [{ isOption: true }, { paymentType: 'DEPOSIT' }]
              },
              data: { isExpired: true }
          })
      }
  } else if (transferId) {
      const transfer = await prisma.transfer.findUnique({
          where: { id: transferId },
          select: { date: true }
      })
      if (transfer) {
          const transferDate = new Date(transfer.date)
          transferDate.setHours(0,0,0,0)
          const today = new Date()
          today.setHours(0,0,0,0)
          
          if (transferDate < today) {
              await prisma.participant.updateMany({
                  where: {
                      transferId,
                      isExpired: false,
                      OR: [{ isOption: true }, { paymentType: 'DEPOSIT' }]
                  },
                  data: { isExpired: true }
              })
          }
      }
  } else if (isRental) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      // Update expired rentals (where rentalStartDate < today)
      // Note: We can't easily filter by date in updateMany with relation/json fields in standard Prisma without raw query or iterating
      // But for rentals, rentalStartDate is a field on Participant.
      
      await prisma.participant.updateMany({
          where: {
              isRental: true,
              rentalStartDate: {
                  lt: today
              },
              isExpired: false,
              OR: [{ isOption: true }, { paymentType: 'DEPOSIT' }]
          },
          data: { isExpired: true }
      })
  }

  const participants = await prisma.participant.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    include: { 
      createdBy: { 
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
      } 
    }
  })

  return NextResponse.json(participants)
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
    
    // DEBUG: Log email data
    console.log('--- DEBUG PARTECIPANTE ---');
    console.log('Email ricevuta:', body.email);
    console.log('PDF allegato (lunghezza):', body.pdfAttachment ? body.pdfAttachment.length : 'MANCANTE');
    console.log('--------------------------');

    if (body.lastName !== undefined && !body.lastName?.trim()) {
      return NextResponse.json({ error: 'Il cognome è obbligatorio.' }, { status: 400 })
    }
    if (body.groupSize !== undefined && (parseInt(body.groupSize) < 1)) {
      return NextResponse.json({ error: 'Il numero di partecipanti deve essere almeno 1.' }, { status: 400 })
    }
    if (!body.excursionId && !body.transferId && !body.isRental) {
      return NextResponse.json({ error: 'ID escursione, trasferimento o flag noleggio mancante.' }, { status: 400 })
    }

    const { 
      excursionId, transferId, firstName, lastName, nationality, dateOfBirth, 
      docNumber, docType, phoneNumber, email, notes, supplier, isOption,
      paymentType, paymentMethod, depositPaymentMethod, balancePaymentMethod,
      groupSize, price, deposit, tax, commissionPercentage, pdfAttachment, pdfAttachmentIT, pdfAttachmentEN,
      pickupLocation, dropoffLocation, pickupTime, returnPickupLocation, returnDate, returnTime,
      isRental, rentalType, rentalStartDate, rentalEndDate, accommodation,
      adults, children, needsTransfer,
      licenseType, insurancePrice, supplementPrice, assistantCommission, assistantCommissionType
    } = body

    // Check expiration logic
    let isExpired = false
    let approvalStatus = 'APPROVED'
    let originalPrice: number | null = null

    if (excursionId) {
        const excursion = await prisma.excursion.findUnique({
          where: { id: excursionId },
          select: { confirmationDeadline: true, priceAdult: true, priceChild: true }
        })

        if (excursion) {
          // Expiration Logic
          if (excursion.confirmationDeadline) {
            const now = new Date()
            const isDeadlinePassed = new Date(excursion.confirmationDeadline) < now
            if (isDeadlinePassed && (isOption || paymentType === 'DEPOSIT')) {
              isExpired = true
            }
          }

          // Approval/Draft Logic
          // Only applies to Excursions for now as requested
          const calculatedPrice = (parseInt(adults || '0') * (excursion.priceAdult || 0)) + 
                                  (parseInt(children || '0') * (excursion.priceChild || 0))
          
          // Use provided price or 0
          const currentPrice = parseFloat(String(price)) || 0

          // Check if user is Admin
          // session.user usually has role if using standard auth, otherwise fetch
          const user = await prisma.user.findUnique({ 
              where: { id: session.user.id },
              select: { role: true } 
          })
          
          const isAdmin = user?.role === 'ADMIN'

          console.log(`[DEBUG_APPROVAL] User: ${session.user.email}, Role: ${user?.role}, CalcPrice: ${calculatedPrice}, CurrPrice: ${currentPrice}`)

          // Validation: Price cannot be higher than calculated for non-admins
          // Allow a small margin of error for floating point, or strict check
          if (!isAdmin && currentPrice > calculatedPrice + 0.01) {
             return NextResponse.json({ error: 'Il prezzo non può essere superiore al prezzo di listino.' }, { status: 400 })
          }

          // If not Admin and price is lower than calculated (discount)
          // We use a small tolerance for float comparison if needed, but < is fine
          if (!isAdmin && currentPrice < calculatedPrice - 0.01) {
              approvalStatus = 'PENDING'
              originalPrice = calculatedPrice
              console.log(`[DEBUG_APPROVAL] Status set to PENDING. Original: ${originalPrice}`)
          }
        }
    } else if (transferId) {
        const transfer = await prisma.transfer.findUnique({
          where: { id: transferId },
          select: { date: true }
        })

        if (transfer) {
          const startOfToday = new Date()
          startOfToday.setHours(0, 0, 0, 0)
          
          // If transfer date is in the past (before today)
          const isTransferPassed = new Date(transfer.date) < startOfToday
          
          if (isTransferPassed && (isOption || paymentType === 'DEPOSIT')) {
            isExpired = true
          }
        }
    } else if (isRental && rentalStartDate) {
        const startOfToday = new Date()
        startOfToday.setHours(0, 0, 0, 0)
        const isRentalPassed = new Date(rentalStartDate) < startOfToday
        if (isRentalPassed && (isOption || paymentType === 'DEPOSIT')) {
            isExpired = true
        }
    }

    // Client Management Logic
    let clientId: string | undefined
    let serviceType = 'EXCURSION'
    if (transferId) serviceType = 'TRANSFER'
    if (isRental) serviceType = 'RENTAL'

    if (email) {
      // Try to find existing client by email
      const existingClient = await prisma.client.findUnique({
        where: { email }
      })
      
      if (existingClient) {
        clientId = existingClient.id
        // Update client details if needed (optional, keeping latest info)
        await prisma.client.update({
          where: { id: existingClient.id },
          data: {
            firstName,
            lastName,
            phoneNumber: phoneNumber || existingClient.phoneNumber,
            nationality: nationality || existingClient.nationality,
            serviceType
          }
        })
      } else {
        // Create new client with email
        const newClient = await prisma.client.create({
          data: {
            firstName,
            lastName,
            email,
            phoneNumber,
            nationality,
            serviceType
          }
        })
        clientId = newClient.id
      }
    } else {
      // No email provided, create a new client entry
      // We don't check for duplicates by name/phone to avoid false positives
      const newClient = await prisma.client.create({
        data: {
          firstName,
          lastName,
          email: null,
          phoneNumber,
          nationality,
          serviceType
        }
      })
      clientId = newClient.id
    }

    const participant = await prisma.participant.create({
      data: {
        excursionId: excursionId || null,
        transferId: transferId || null,
        firstName,
        lastName,
        nationality,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        docNumber,
        docType,
        phoneNumber,
        email,
        notes,
        supplier,
        isOption: isOption || false,
        paymentType,
        paymentMethod: paymentMethod || 'CASH', // Legacy required field
        depositPaymentMethod,
        balancePaymentMethod,
        
        // Transfer fields
        pickupLocation,
        dropoffLocation,
        pickupTime,
        returnPickupLocation,
        returnDate: returnDate ? new Date(returnDate) : null,
        returnTime,

        // Rental fields
        isRental: !!isRental,
        rentalType,
        rentalStartDate: rentalStartDate ? new Date(rentalStartDate) : null,
        rentalEndDate: rentalEndDate ? new Date(rentalEndDate) : null,
        accommodation,
        needsTransfer: !!needsTransfer,

        licenseType: licenseType || null,
        insurancePrice: insurancePrice || 0,
        supplementPrice: supplementPrice || 0,
        assistantCommission: assistantCommission || 0,
        assistantCommissionType: assistantCommissionType || 'PERCENTAGE',

        groupSize: parseInt(groupSize) || 1,
        adults: parseInt(adults) || 1,
        children: parseInt(children) || 0,
        price: price || 0,
        deposit: deposit || 0,
        tax: tax || 0,
        commissionPercentage: commissionPercentage || 0,
        isExpired,
        approvalStatus,
        originalPrice,
        createdById: session.user.id,
        agencyId: session.user.agencyId || null,
        clientId // Link to client
      }
    })

    const paymentMethodMap: Record<string, string> = {
      'CASH': 'Contanti',
      'TRANSFER': 'Bonifico',
      'CARD': 'Carta'
    }

    // For log details, we might want to show split payments
    let methodLabel = paymentMethodMap[paymentMethod] || paymentMethod
    if (depositPaymentMethod) {
        methodLabel = `Acconto: ${paymentMethodMap[depositPaymentMethod] || depositPaymentMethod}`
        if (balancePaymentMethod) {
            methodLabel += `, Saldo: ${paymentMethodMap[balancePaymentMethod] || balancePaymentMethod}`
        }
    }
    
    // Ensure finalGroupSize is defined
    const finalGroupSize = groupSize || (parseInt(adults || '1') + parseInt(children || '0'));

    const details = `Aggiunto partecipante ${firstName} ${lastName} (Adulti: ${adults || 1}, Bambini: ${children || 0}, Totale: ${finalGroupSize}, Prezzo: €${price}, Acconto: €${deposit}, Metodo: ${methodLabel})`

    await createAuditLog(
      session.user.id,
      'CREATE_PARTICIPANT',
      details,
      excursionId || null,
      transferId || null
    )

    // Send Email if email and PDF are provided
    const hasAttachments = (pdfAttachmentIT && pdfAttachmentEN) || pdfAttachment

    if (email && hasAttachments) {
      console.log('Tentativo invio email a:', email);
      console.log('Configurazione email user:', process.env.EMAIL_USER ? 'Presente' : 'Mancante');
      
      try {
        const transporter = nodemailer.createTransport({
                host: 'smtp.gmail.com',
                port: 465,
                secure: true, // true for 465, false for other ports
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                },
                tls: {
                    rejectUnauthorized: false
                }
            });

        // Verify connection configuration
        await new Promise((resolve, reject) => {
            transporter.verify(function (error, success) {
                if (error) {
                    console.error('Errore verifica SMTP:', error);
                    reject(error);
                } else {
                    console.log("Server SMTP pronto per l'invio");
                    resolve(success);
                }
            });
        });

        const attachments = []
        if (pdfAttachmentIT && pdfAttachmentEN) {
             attachments.push({
                    filename: `Riepilogo_${firstName}_${lastName}_IT.pdf`,
                    content: Buffer.from(pdfAttachmentIT, 'base64')
             })
             attachments.push({
                    filename: `Summary_${firstName}_${lastName}_EN.pdf`,
                    content: Buffer.from(pdfAttachmentEN, 'base64')
             })
        } else if (pdfAttachment) {
             attachments.push({
                    filename: `Riepilogo_${firstName}_${lastName}.pdf`,
                    content: Buffer.from(pdfAttachment, 'base64')
             })
        }

        const info = await transporter.sendMail({
            from: `"Corfumania" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Conferma Prenotazione - Corfumania',
            text: `Gentile ${firstName} ${lastName},\n\nIn allegato trovi il riepilogo della tua prenotazione (IT/EN).\n\nCordiali saluti,\nTeam Corfumania`,
            attachments: attachments
        });

        console.log('Email inviata con successo:', info.messageId);

      } catch (emailError: any) {
        console.error('FALLIMENTO INVIO EMAIL:', emailError);
        // Log more details if available
        if (emailError.response) {
            console.error('SMTP Response:', emailError.response);
        }
        // Non blocchiamo la creazione del partecipante, ma logghiamo l'errore grave
      }
    }

    return NextResponse.json(participant)
  } catch (error: any) {
    console.error('Error creating participant:', error)
    
    // Gestione errori Prisma
    if (error.code === 'P2003') {
        return NextResponse.json(
            { error: 'Errore di validazione: L\'escursione, il trasferimento o l\'utente non esistono più. Prova ad aggiornare la pagina.' },
            { status: 400 }
        )
    }

    return NextResponse.json(
      { error: `Errore durante la creazione del partecipante: ${error.message}` },
      { status: 500 }
    )
  }
}
