import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import nodemailer from 'nodemailer'

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

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    const participant = await prisma.participant.findUnique({
        where: { id },
        include: {
            user: {
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

    const { user, ...rest } = participant as any

    return NextResponse.json({
        ...rest,
        createdBy: user
    })
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const participant = await prisma.participant.findUnique({ where: { id } })
  if (!participant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (session.user.role !== 'ADMIN' && participant.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()

    const now = new Date()
    let newIsExpired = false

    if (participant.excursionId) {
      const excursion = await prisma.excursion.findUnique({
        where: { id: participant.excursionId },
        select: { confirmationDeadline: true }
      })

      if (excursion?.confirmationDeadline) {
        const isDeadlinePassed = new Date(excursion.confirmationDeadline) < now
        const finalPaymentType = body.paymentType || participant.paymentType

        if (isDeadlinePassed && (finalPaymentType === 'OPTION' || finalPaymentType === 'DEPOSIT')) {
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

        if (isTransferPassed && (finalPaymentType === 'OPTION' || finalPaymentType === 'DEPOSIT')) {
          newIsExpired = true
        }
      }
    }

    // Handle Approval Logic (Admin only usually, but checked above)
    // If Approval requested:
    if (body.approvalStatus === 'APPROVED') {
         // Log the approval
         try {
                     await createAuditLog(
                       session.user.id,
                       'APPROVE_PARTICIPANT',
                       'PARTICIPANT',
                       participant.id,
                       `Approvato sconto per partecipante ${participant.id}. Prezzo finale: €${body.price || participant.totalPrice}`,
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
                                filename: `Voucher_${participant.id}_IT.pdf`,
                                content: Buffer.from(body.pdfAttachmentIT, 'base64')
                         })
                         attachments.push({
                                filename: `Voucher_${participant.id}_EN.pdf`,
                                content: Buffer.from(body.pdfAttachmentEN, 'base64')
                         })
                     } else if (body.pdfAttachment) {
                         attachments.push({
                                filename: `Voucher_${participant.id}.pdf`,
                                content: Buffer.from(body.pdfAttachment, 'base64')
                         })
                     }

                     await transporter.sendMail({
                         from: `"Corfumania" <${process.env.EMAIL_USER}>`,
                         to: participant.email,
                         subject: 'Conferma Prenotazione - Corfumania',
                         text: `Gentile Cliente, la tua prenotazione è stata confermata. In allegato trovi il voucher (IT/EN).`,
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
            'PARTICIPANT',
            participant.id,
            `Rifiutato sconto per partecipante ${participant.id}.`,
            participant.excursionId,
            participant.transferId
          )
        } catch (auditError) {
          console.error('Audit log failed:', auditError)
        }
    }

    const isStatusUpdateOnly = body.approvalStatus && Object.keys(body).length <= 3

    if (!isStatusUpdateOnly) {
      const adults = body.adults !== undefined ? parseInt(body.adults) : (participant.adults || 0)
      const children = body.children !== undefined ? parseInt(body.children) : (participant.children || 0)
      const infants = body.infants !== undefined ? parseInt(body.infants) : (participant.infants || 0)

      if ((adults + children + infants) < 1) {
        return NextResponse.json({ error: 'Il numero di partecipanti deve essere almeno 1.' }, { status: 400 })
      }
    }
    
    const finalAdults = body.adults !== undefined ? parseInt(body.adults) : (participant.adults || 0)
    const finalChildren = body.children !== undefined ? parseInt(body.children) : (participant.children || 0)
    const finalInfants = body.infants !== undefined ? parseInt(body.infants) : (participant.infants || 0)

    const finalPaymentType = body.paymentType || participant.paymentType || 'BALANCE'
    const finalTotalPrice = body.price !== undefined ? parseFloat(String(body.price)) : participant.totalPrice
    const finalDeposit = body.deposit !== undefined ? parseFloat(String(body.deposit)) : participant.paidAmount

    let approvalStatus = body.approvalStatus || undefined
    let originalPrice: number | null = null
    let paymentStatus = participant.paymentStatus
    let paidAmount = participant.paidAmount

    if (participant.excursionId && (body.price !== undefined || body.adults !== undefined || body.children !== undefined)) {
      const excursion = await prisma.excursion.findUnique({
        where: { id: participant.excursionId },
        select: { priceAdult: true, priceChild: true }
      })

      if (excursion) {
        const calculatedPrice =
          (finalAdults * (excursion.priceAdult || 0)) +
          (finalChildren * (excursion.priceChild || 0))

        const user = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { role: true }
        })
        const isAdmin = user?.role === 'ADMIN'

        if (!isAdmin) {
          if (finalTotalPrice > calculatedPrice + 0.01) {
            return NextResponse.json({ error: 'Il prezzo non può essere superiore al prezzo di listino.' }, { status: 400 })
          }

          if (finalTotalPrice < calculatedPrice - 0.01) {
            approvalStatus = 'PENDING'
            originalPrice = calculatedPrice
            paymentStatus = 'PENDING_APPROVAL'
          } else {
            approvalStatus = 'APPROVED'
            originalPrice = null
          }
        }
      }
    }

    if (body.approvalStatus === 'REJECTED') {
      paymentStatus = 'REJECTED'
    }

    const applyPaymentLogic = () => {
      if (finalPaymentType === 'BALANCE') {
        paidAmount = finalTotalPrice
        paymentStatus = 'PAID'
      } else if (finalPaymentType === 'DEPOSIT') {
        paidAmount = finalDeposit
        paymentStatus = finalDeposit >= finalTotalPrice - 0.01 ? 'PAID' : 'PARTIAL'
      } else if (finalPaymentType === 'OPTION') {
        paidAmount = 0
        paymentStatus = 'PENDING'
      }
    }

    if (body.approvalStatus === 'APPROVED' && paymentStatus === 'PENDING_APPROVAL') {
      applyPaymentLogic()
    } else if (paymentStatus !== 'PENDING_APPROVAL') {
      applyPaymentLogic()
    }

    const ticketNumberValue = encodeDocumentInfo(body.docType, body.docNumber)

    const updated = await prisma.participant.update({
      where: { id },
      data: {
        ...(isStatusUpdateOnly ? {} : {
          nationality: body.nationality,
          adults: finalAdults,
          children: finalChildren,
          infants: finalInfants,
          phone: body.phoneNumber ?? participant.phone,
          email: body.email ?? participant.email,
          notes: body.notes ?? participant.notes,
          supplier: body.supplier ?? participant.supplier,
          paymentType: finalPaymentType,
          paymentMethod: body.paymentMethod ?? participant.paymentMethod,
          pickupLocation: body.pickupLocation ?? participant.pickupLocation,
          pickupTime: body.pickupTime ?? participant.pickupTime,
          dropoffLocation: body.dropoffLocation ?? participant.dropoffLocation,
          returnPickupLocation: body.returnPickupLocation ?? participant.returnPickupLocation,
          returnDropoffLocation: body.returnDropoffLocation ?? participant.returnDropoffLocation,
          returnDate: body.returnDate ? new Date(body.returnDate) : participant.returnDate,
          returnTime: body.returnTime ?? participant.returnTime,
          roomNumber: body.accommodation !== undefined ? body.accommodation : participant.roomNumber,
          ticketNumber: ticketNumberValue !== null ? ticketNumberValue : participant.ticketNumber,
          tax: body.tax !== undefined ? body.tax : participant.tax,
          totalPrice: finalTotalPrice,

          // Campi specifici per i noleggi
          rentalType: body.rentalType ?? participant.rentalType,
          rentalStartDate: body.rentalStartDate ? new Date(body.rentalStartDate) : participant.rentalStartDate,
          rentalEndDate: body.rentalEndDate ? new Date(body.rentalEndDate) : participant.rentalEndDate,
          licenseType: body.licenseType ?? participant.licenseType,
          insurancePrice: body.insurancePrice !== undefined ? body.insurancePrice : participant.insurancePrice,
          supplementPrice: body.supplementPrice !== undefined ? body.supplementPrice : participant.supplementPrice,
          assistantCommission: body.assistantCommission !== undefined ? body.assistantCommission : participant.assistantCommission,
          assistantCommissionType: body.assistantCommissionType ?? participant.assistantCommissionType,
          needsTransfer: body.needsTransfer !== undefined ? body.needsTransfer : participant.needsTransfer,
          commissionPercentage: body.commissionPercentage !== undefined ? body.commissionPercentage : participant.commissionPercentage,
        }),
        paidAmount,
        paymentStatus,
      }
    })

    let changes: string[] = []
    
    const formatDate = (d: Date | null) => d ? d.toISOString().split('T')[0] : 'N/A'

    const originalDocument = decodeDocumentInfo(participant.ticketNumber)

    if (body.nationality && body.nationality !== participant.nationality) {
      changes.push(`Nazionalità: ${participant.nationality || 'N/A'} -> ${body.nationality}`)
    }
    if (body.docNumber && body.docNumber !== originalDocument.docNumber) {
      changes.push(`Doc: ${originalDocument.docNumber || 'N/A'} -> ${body.docNumber}`)
    }
    if (body.docType && body.docType !== originalDocument.docType) {
      changes.push(`Tipo Doc: ${originalDocument.docType || 'N/A'} -> ${body.docType}`)
    }
    if (body.phoneNumber && body.phoneNumber !== participant.phone) {
      changes.push(`Tel: ${participant.phone || 'N/A'} -> ${body.phoneNumber}`)
    }
    const oldPax = (participant.adults || 0) + (participant.children || 0) + (participant.infants || 0)
    const newPax = ((body.adults !== undefined ? parseInt(body.adults) : participant.adults) || 0) + 
                   ((body.children !== undefined ? parseInt(body.children) : participant.children) || 0) + 
                   ((body.infants !== undefined ? parseInt(body.infants) : participant.infants) || 0)
    
    if (newPax !== oldPax) {
      changes.push(`Persone: ${oldPax} -> ${newPax}`)
    }
    if (body.price !== undefined && body.price !== participant.totalPrice) {
      changes.push(`Prezzo: €${participant.totalPrice} -> €${body.price}`)
    }
    if (body.deposit !== undefined && body.deposit !== participant.paidAmount) {
      changes.push(`Acconto: €${participant.paidAmount} -> €${body.deposit}`)
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
    if (body.accommodation !== undefined && body.accommodation !== participant.roomNumber) {
        changes.push(`Struttura: ${participant.roomNumber || 'N/A'} -> ${body.accommodation}`)
    }

    let details = `Modificato partecipante ${participant.id}`
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
        const safeName = updated.name || 'Cliente'

        if (body.pdfAttachmentIT && body.pdfAttachmentEN) {
             attachments.push({
                    filename: `Prenotazione_${safeName}_IT.pdf`,
                    content: Buffer.from(body.pdfAttachmentIT, 'base64')
             })
             attachments.push({
                    filename: `Booking_${safeName}_EN.pdf`,
                    content: Buffer.from(body.pdfAttachmentEN, 'base64')
             })
        } else if (body.pdfAttachment) {
             attachments.push({
                    filename: `Prenotazione_${safeName}.pdf`,
                    content: Buffer.from(body.pdfAttachment, 'base64')
             })
        }

        await transporter.sendMail({
          from: `"Corfumania" <${process.env.EMAIL_USER}>`,
          to: updated.email,
          subject: subject,
          text: `Gentile ${safeName},\n\nTi inviamo in allegato il documento aggiornato con le ultime modifiche alla tua prenotazione (IT/EN).\n\nCordiali saluti,\nTeam Corfumania`,
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
      'PARTICIPANT',
      participant.id,
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

  if (session.user.role !== 'ADMIN' && participant.userId !== session.user.id) {
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
        const safeName = participant.name || 'Cliente'

        if (body.pdfAttachmentIT && body.pdfAttachmentEN) {
             attachments.push({
                    filename: `Cancellazione_${safeName}_IT.pdf`,
                    content: Buffer.from(body.pdfAttachmentIT, 'base64')
             })
             attachments.push({
                    filename: `Cancellation_${safeName}_EN.pdf`,
                    content: Buffer.from(body.pdfAttachmentEN, 'base64')
             })
        } else if (body.pdfAttachment) {
             attachments.push({
                    filename: `Cancellazione_${safeName}.pdf`,
                    content: Buffer.from(body.pdfAttachment, 'base64')
             })
        }

        await transporter.sendMail({
          from: `"Corfumania" <${process.env.EMAIL_USER}>`,
          to: participant.email,
          subject: 'Cancellazione Prenotazione - Corfumania',
          text: `Gentile ${safeName},\n\nTi informiamo che la tua prenotazione è stata cancellata.\nIn allegato trovi il documento di riepilogo (IT/EN).\n\nCordiali saluti,\nTeam Corfumania`,
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
    'PARTICIPANT',
    participant.id,
    `Eliminato partecipante ${participant.id}`,
    participant.excursionId,
    participant.transferId
  )

  return NextResponse.json({ success: true })
}
