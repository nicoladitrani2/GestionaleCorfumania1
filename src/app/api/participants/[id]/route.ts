import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import nodemailer from 'nodemailer'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    const participant = await prisma.participant.findUnique({
        where: { id },
        include: {
            createdBy: {
                select: {
                    firstName: true,
                    lastName: true,
                    code: true
                }
            },
            excursion: true,
            transfer: true
        }
    })

    if (!participant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json(participant)
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const participant = await prisma.participant.findUnique({ where: { id } })
  if (!participant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (session.user.role !== 'ADMIN' && participant.createdById !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()

    // Check expiration logic
    let newIsExpired = false
    const now = new Date()
    
    if (participant.excursionId) {
      const excursion = await prisma.excursion.findUnique({
        where: { id: participant.excursionId },
        select: { confirmationDeadline: true }
      })

      if (excursion?.confirmationDeadline) {
        const isDeadlinePassed = new Date(excursion.confirmationDeadline) < now
        const finalPaymentType = body.paymentType || participant.paymentType
        const finalIsOption = body.isOption !== undefined ? body.isOption : participant.isOption

        if (isDeadlinePassed && (finalIsOption || finalPaymentType === 'DEPOSIT')) {
          newIsExpired = true
        }
      }
    } else if (participant.transferId) {
      const transfer = await prisma.transfer.findUnique({
        where: { id: participant.transferId },
        select: { date: true }
      })

      if (transfer) {
        const startOfToday = new Date()
        startOfToday.setHours(0, 0, 0, 0)
        
        const isTransferPassed = new Date(transfer.date) < startOfToday
        const finalPaymentType = body.paymentType || participant.paymentType
        const finalIsOption = body.isOption !== undefined ? body.isOption : participant.isOption

        if (isTransferPassed && (finalIsOption || finalPaymentType === 'DEPOSIT')) {
          newIsExpired = true
        }
      }
    }

    // Handle Approval Logic (Admin only usually, but checked above)
    // If Approval requested:
    if (body.approvalStatus === 'APPROVED' && participant.approvalStatus === 'PENDING') {
         // Log the approval
         try {
             await createAuditLog(
                session.user.id,
                'APPROVE_PARTICIPANT',
                `Approvato sconto per ${participant.firstName} ${participant.lastName}. Prezzo finale: €${body.price || participant.price}`,
                participant.excursionId,
                participant.transferId
             )
         } catch (auditError) {
             console.error('Audit log failed:', auditError)
         }

            // Send Email if PDF attached
             // ONLY send if Approved and NOT Expired (as per user request: "solo dopo l'approvazione... altrimenti no")
             const hasAttachments = (body.pdfAttachmentIT && body.pdfAttachmentEN) || body.pdfAttachment

             if (hasAttachments && participant.email && !newIsExpired) {
                 try {
                     const transporter = nodemailer.createTransport({
                         host: 'smtp.gmail.com',
                         port: 465,
                         secure: true,
                         auth: {
                             user: process.env.EMAIL_USER,
                             pass: process.env.EMAIL_PASS,
                         },
                     })

                     const attachments = []
                     if (body.pdfAttachmentIT && body.pdfAttachmentEN) {
                         attachments.push({
                                filename: `Voucher_${participant.firstName}_${participant.lastName}_IT.pdf`,
                                content: Buffer.from(body.pdfAttachmentIT, 'base64')
                         })
                         attachments.push({
                                filename: `Voucher_${participant.firstName}_${participant.lastName}_EN.pdf`,
                                content: Buffer.from(body.pdfAttachmentEN, 'base64')
                         })
                     } else if (body.pdfAttachment) {
                         attachments.push({
                                filename: `Voucher_${participant.firstName}_${participant.lastName}.pdf`,
                                content: Buffer.from(body.pdfAttachment, 'base64')
                         })
                     }

                     await transporter.sendMail({
                         from: `"Corfumania" <${process.env.EMAIL_USER}>`,
                         to: participant.email,
                         subject: 'Conferma Prenotazione - Corfumania',
                         text: `Gentile ${participant.firstName}, la tua prenotazione è stata confermata. In allegato trovi il voucher (IT/EN).`,
                         attachments: attachments
                     })
                     console.log(`[APPROVAL] Email sent to ${participant.email}`)
                 } catch (emailError) {
                     console.error('[APPROVAL] Email sending failed:', emailError)
                     // Don't block the approval, but log error
                 }
             }
     }

    // If Rejection requested:
    if (body.approvalStatus === 'REJECTED') {
        // Set as REJECTED and log
        body.approvalStatus = 'REJECTED'
        // User requested that rejected participants should NOT be counted and generate NO revenue/commission
        // We set isExpired to true to ensure they are treated as "non-active" in many places
        // And we might consider zeroing out price/commission if needed, but for now we rely on status.
        // However, to be safe and ensure "nessun conteggio", setting isExpired=true is key.
        newIsExpired = true 
        
        console.log(`[APPROVAL] Rejected discount for ${id}. Status set to REJECTED.`)
        
        // Log the rejection
        try {
            await createAuditLog(
                session.user.id,
                'REJECT_PARTICIPANT',
                `Rifiutato sconto per ${participant.firstName} ${participant.lastName}.`,
                participant.excursionId,
                participant.transferId
            )
        } catch (auditError) {
            console.error('Audit log failed:', auditError)
        }
    }

    // Validation
    // Skip name validation if we are just approving/rejecting (body might be partial)
    const isStatusUpdateOnly = body.approvalStatus && Object.keys(body).length <= 3 // status, pdf, maybe one more

    if (!isStatusUpdateOnly) {
        if (body.firstName !== undefined && !body.firstName?.trim()) {
            return NextResponse.json({ error: 'Il nome è obbligatorio.' }, { status: 400 })
        }
        if (body.lastName !== undefined && !body.lastName?.trim()) {
            return NextResponse.json({ error: 'Il cognome è obbligatorio.' }, { status: 400 })
        }
        if (body.groupSize !== undefined && (parseInt(body.groupSize) < 1)) {
            return NextResponse.json({ error: 'Il numero di partecipanti deve essere almeno 1.' }, { status: 400 })
        }
    }
    
    // Approval Logic for Excursions (only if price or people count changes)
    let approvalStatus = body.approvalStatus || participant.approvalStatus
    let originalPrice = participant.originalPrice

    if (participant.excursionId && (body.price !== undefined || body.adults !== undefined || body.children !== undefined)) {
        const excursion = await prisma.excursion.findUnique({
            where: { id: participant.excursionId },
            select: { priceAdult: true, priceChild: true }
        })

        if (excursion) {
            const finalAdults = body.adults !== undefined ? parseInt(body.adults) : participant.adults
            const finalChildren = body.children !== undefined ? parseInt(body.children) : participant.children
            
            const calculatedPrice = (finalAdults * (excursion.priceAdult || 0)) + 
                                    (finalChildren * (excursion.priceChild || 0))
            
            const finalPrice = body.price !== undefined ? parseFloat(String(body.price)) : participant.price

            // Check if user is Admin
            const user = await prisma.user.findUnique({ 
                where: { id: session.user.id },
                select: { role: true } 
            })
            const isAdmin = user?.role === 'ADMIN'

            console.log(`[DEBUG_APPROVAL_PUT] User: ${session.user.email}, Role: ${user?.role}, CalcPrice: ${calculatedPrice}, FinalPrice: ${finalPrice}`)

            if (!isAdmin) {
                // Validation: Price cannot be higher than calculated
                if (finalPrice > calculatedPrice + 0.01) {
                    return NextResponse.json({ error: 'Il prezzo non può essere superiore al prezzo di listino.' }, { status: 400 })
                }
                
                // If price is lower, mark as pending
                if (finalPrice < calculatedPrice - 0.01) {
                     approvalStatus = 'PENDING'
                     originalPrice = calculatedPrice
                     console.log(`[DEBUG_APPROVAL_PUT] Status set to PENDING. Original: ${originalPrice}`)
                } else {
                     // If price is equal (or somehow correct), reset to APPROVED
                     approvalStatus = 'APPROVED'
                     originalPrice = null 
                }
            }
        }
    }

    const updated = await prisma.participant.update({
      where: { id },
      data: {
          approvalStatus,
          originalPrice,
          // Only update fields if they are present in body (undefined means "do not update" in Prisma)
          // But since we are reading from body which might be partial, we need to be careful.
          // If isStatusUpdateOnly is true, we should NOT update other fields to avoid overwriting with undefined/null if logic was different
          
          ...(isStatusUpdateOnly ? {} : {
              firstName: body.firstName,
              lastName: body.lastName,
              nationality: body.nationality,
              dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
              docNumber: body.docNumber,
              docType: body.docType,
              phoneNumber: body.phoneNumber,
              email: body.email,
              notes: body.notes,
              supplier: body.supplier,
              isOption: body.isOption,
              paymentType: body.paymentType,
              paymentMethod: body.paymentMethod,
              depositPaymentMethod: body.depositPaymentMethod,
              balancePaymentMethod: body.balancePaymentMethod,
              
              // Transfer fields
              pickupLocation: body.pickupLocation,
              dropoffLocation: body.dropoffLocation,
              pickupTime: body.pickupTime,
              returnPickupLocation: body.returnPickupLocation,
              returnDate: body.returnDate ? new Date(body.returnDate) : undefined,
              returnTime: body.returnTime,

              // Rental fields
              isRental: body.isRental,
              rentalType: body.rentalType,
              rentalStartDate: body.rentalStartDate ? new Date(body.rentalStartDate) : undefined,
              rentalEndDate: body.rentalEndDate ? new Date(body.rentalEndDate) : undefined,
              accommodation: body.accommodation,
              needsTransfer: body.needsTransfer !== undefined ? body.needsTransfer : undefined,

              licenseType: body.licenseType,
              insurancePrice: body.insurancePrice,
              supplementPrice: body.supplementPrice,
              assistantCommission: body.assistantCommission,
              assistantCommissionType: body.assistantCommissionType,

              groupSize: body.groupSize !== undefined ? parseInt(body.groupSize) : undefined,
              price: body.price !== undefined ? body.price : undefined,
              deposit: body.deposit !== undefined ? body.deposit : undefined,
              tax: body.tax !== undefined ? body.tax : undefined,
              commissionPercentage: body.commissionPercentage,
          }),
          
          isExpired: newIsExpired
      }
    })

    // Log specific changes
    let changes: string[] = []
    
    // Helper per formattare date
    const formatDate = (d: Date | null) => d ? d.toISOString().split('T')[0] : 'N/A'

    if (body.firstName && body.firstName !== participant.firstName) {
      changes.push(`Nome: ${participant.firstName} -> ${body.firstName}`)
    }
    if (body.lastName && body.lastName !== participant.lastName) {
      changes.push(`Cognome: ${participant.lastName} -> ${body.lastName}`)
    }
    if (body.nationality && body.nationality !== participant.nationality) {
      changes.push(`Nazionalità: ${participant.nationality || 'N/A'} -> ${body.nationality}`)
    }
    if (body.dateOfBirth && formatDate(new Date(body.dateOfBirth)) !== formatDate(participant.dateOfBirth)) {
      changes.push(`Data Nascita: ${formatDate(participant.dateOfBirth)} -> ${formatDate(new Date(body.dateOfBirth))}`)
    }
    if (body.docNumber && body.docNumber !== participant.docNumber) {
      changes.push(`Doc: ${participant.docNumber || 'N/A'} -> ${body.docNumber}`)
    }
    if (body.docType && body.docType !== participant.docType) {
      changes.push(`Tipo Doc: ${participant.docType || 'N/A'} -> ${body.docType}`)
    }
    if (body.phoneNumber && body.phoneNumber !== participant.phoneNumber) {
      changes.push(`Tel: ${participant.phoneNumber || 'N/A'} -> ${body.phoneNumber}`)
    }
    if (body.groupSize !== undefined && parseInt(body.groupSize) !== participant.groupSize) {
      changes.push(`Persone: ${participant.groupSize} -> ${body.groupSize}`)
    }
    if (body.price !== undefined && body.price !== participant.price) {
      changes.push(`Prezzo: €${participant.price} -> €${body.price}`)
    }
    if (body.deposit !== undefined && body.deposit !== participant.deposit) {
      changes.push(`Acconto: €${participant.deposit} -> €${body.deposit}`)
    }
    if (body.isOption !== undefined && body.isOption !== participant.isOption) {
      changes.push(`Opzione: ${participant.isOption ? 'Sì' : 'No'} -> ${body.isOption ? 'Sì' : 'No'}`)
    }
    if (body.supplier !== undefined && body.supplier !== participant.supplier) {
      changes.push(`Fornitore: ${participant.supplier || 'Nessuno'} -> ${body.supplier}`)
    }
    // Helper maps for translation
    const paymentMethodMap: Record<string, string> = {
      'CASH': 'Contanti',
      'TRANSFER': 'Bonifico',
      'CARD': 'Carta'
    }
    const paymentTypeMap: Record<string, string> = {
      'DEPOSIT': 'Acconto',
      'BALANCE': 'Saldo'
    }

    if (body.paymentType !== undefined && body.paymentType !== participant.paymentType) {
      const oldType = paymentTypeMap[participant.paymentType] || participant.paymentType
      const newType = paymentTypeMap[body.paymentType] || body.paymentType
      changes.push(`Tipo Pagamento: ${oldType} -> ${newType}`)
    }
    if (body.paymentMethod !== undefined && body.paymentMethod !== participant.paymentMethod) {
      const oldMethod = paymentMethodMap[participant.paymentMethod] || participant.paymentMethod
      const newMethod = paymentMethodMap[body.paymentMethod] || body.paymentMethod
      changes.push(`Metodo: ${oldMethod} -> ${newMethod}`)
    }
    if (body.notes !== undefined && body.notes !== participant.notes) {
      changes.push(`Note modificate`)
    }
    if (body.pickupLocation !== undefined && body.pickupLocation !== participant.pickupLocation) {
        changes.push(`Pickup: ${participant.pickupLocation || 'N/A'} -> ${body.pickupLocation}`)
    }
    if (body.dropoffLocation !== undefined && body.dropoffLocation !== participant.dropoffLocation) {
        changes.push(`Dropoff: ${participant.dropoffLocation || 'N/A'} -> ${body.dropoffLocation}`)
    }
    if (body.returnDate && formatDate(new Date(body.returnDate)) !== formatDate(participant.returnDate)) {
        changes.push(`Ritorno: ${formatDate(participant.returnDate)} -> ${formatDate(new Date(body.returnDate))}`)
    }

    if (body.rentalType !== undefined && body.rentalType !== participant.rentalType) {
        changes.push(`Tipo Noleggio: ${participant.rentalType || 'N/A'} -> ${body.rentalType}`)
    }
    if (body.rentalStartDate && formatDate(new Date(body.rentalStartDate)) !== formatDate(participant.rentalStartDate)) {
        changes.push(`Inizio Noleggio: ${formatDate(participant.rentalStartDate)} -> ${formatDate(new Date(body.rentalStartDate))}`)
    }
    if (body.rentalEndDate && formatDate(new Date(body.rentalEndDate)) !== formatDate(participant.rentalEndDate)) {
        changes.push(`Fine Noleggio: ${formatDate(participant.rentalEndDate)} -> ${formatDate(new Date(body.rentalEndDate))}`)
    }
    if (body.accommodation !== undefined && body.accommodation !== participant.accommodation) {
        changes.push(`Struttura: ${participant.accommodation || 'N/A'} -> ${body.accommodation}`)
    }

    let details = `Modificato partecipante ${updated.firstName} ${updated.lastName}`
    if (changes.length > 0) {
      details += `: ${changes.join(', ')}`
    }

    // Send Email if email and PDF are provided (for updates like Settle Balance)
    // But skip if we just sent an approval email
    const hasAttachments = (body.pdfAttachmentIT && body.pdfAttachmentEN) || body.pdfAttachment

    if (updated.email && hasAttachments && body.approvalStatus !== 'APPROVED') {
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
            })

        const subject = updated.paymentType === 'BALANCE' 
          ? 'Conferma Saldo - Corfumania' 
          : 'Aggiornamento Prenotazione - Corfumania'

        const attachments = []
        if (body.pdfAttachmentIT && body.pdfAttachmentEN) {
             attachments.push({
                    filename: `Prenotazione_${updated.firstName}_${updated.lastName}_IT.pdf`,
                    content: Buffer.from(body.pdfAttachmentIT, 'base64')
             })
             attachments.push({
                    filename: `Booking_${updated.firstName}_${updated.lastName}_EN.pdf`,
                    content: Buffer.from(body.pdfAttachmentEN, 'base64')
             })
        } else if (body.pdfAttachment) {
             attachments.push({
                    filename: `Prenotazione_${updated.firstName}_${updated.lastName}.pdf`,
                    content: Buffer.from(body.pdfAttachment, 'base64')
             })
        }

        await transporter.sendMail({
          from: `"Corfumania" <${process.env.EMAIL_USER}>`,
          to: updated.email,
          subject: subject,
          text: `Gentile ${updated.firstName} ${updated.lastName},\n\nTi inviamo in allegato il documento aggiornato con le ultime modifiche alla tua prenotazione (IT/EN).\n\nCordiali saluti,\nTeam Corfumania`,
          attachments: attachments,
        })
        console.log('Email aggiornamento inviata a:', updated.email)
      } catch (emailError) {
        console.error('Error sending update email:', emailError)
      }
    }

    await createAuditLog(
      session.user.id,
      'UPDATE_PARTICIPANT',
      details,
      participant.excursionId,
      participant.transferId
    )

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('Error updating participant:', error)
    
    if (error.code === 'P2003') {
        return NextResponse.json(
            { error: 'Errore di validazione: Riferimento non valido. Prova ad aggiornare la pagina.' },
            { status: 400 }
        )
    }

    return NextResponse.json(
      { error: 'Errore durante l\'aggiornamento del partecipante. Riprova più tardi.' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const participant = await prisma.participant.findUnique({ where: { id } })
  if (!participant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (session.user.role !== 'ADMIN' && participant.createdById !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Check for PDF attachment to send cancellation email
  try {
    const body = await request.json()
    const hasAttachments = (body.pdfAttachmentIT && body.pdfAttachmentEN) || body.pdfAttachment

    if (participant.email && hasAttachments) {
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
            })

        const attachments = []
        if (body.pdfAttachmentIT && body.pdfAttachmentEN) {
             attachments.push({
                    filename: `Cancellazione_${participant.firstName}_${participant.lastName}_IT.pdf`,
                    content: Buffer.from(body.pdfAttachmentIT, 'base64')
             })
             attachments.push({
                    filename: `Cancellation_${participant.firstName}_${participant.lastName}_EN.pdf`,
                    content: Buffer.from(body.pdfAttachmentEN, 'base64')
             })
        } else if (body.pdfAttachment) {
             attachments.push({
                    filename: `Cancellazione_${participant.firstName}_${participant.lastName}.pdf`,
                    content: Buffer.from(body.pdfAttachment, 'base64')
             })
        }

        await transporter.sendMail({
          from: `"Corfumania" <${process.env.EMAIL_USER}>`,
          to: participant.email,
          subject: 'Cancellazione Prenotazione - Corfumania',
          text: `Gentile ${participant.firstName} ${participant.lastName},\n\nTi informiamo che la tua prenotazione è stata cancellata.\nIn allegato trovi il documento di riepilogo (IT/EN).\n\nCordiali saluti,\nTeam Corfumania`,
          attachments: attachments,
        })
        console.log('Email cancellazione inviata a:', participant.email)
      } catch (emailError) {
        console.error('Error sending cancellation email:', emailError)
      }
    }
  } catch (e) {
    // Body parsing failed (likely no body), ignore
  }

  await prisma.participant.delete({ where: { id } })

  await createAuditLog(
    session.user.id,
    'DELETE_PARTICIPANT',
    `Eliminato partecipante ${participant.firstName} ${participant.lastName}`,
    participant.excursionId,
    participant.transferId
  )

  return NextResponse.json({ success: true })
}
