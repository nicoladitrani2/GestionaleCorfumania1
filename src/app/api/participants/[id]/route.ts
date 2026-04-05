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
            client: {
                select: {
                    firstName: true,
                    lastName: true,
                    email: true,
                    phoneNumber: true,
                    nationality: true
                }
            },
            excursion: true,
            transfer: true,
            rental: true
        }
    })

    if (!participant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { user, client, ...rest } = participant as any
    const docInfo = decodeDocumentInfo(rest.ticketNumber)
    const fullName = String(rest.name || '').trim()
    const nameParts = fullName ? fullName.split(/\s+/) : []

    const firstName =
        rest.firstName ||
        client?.firstName ||
        nameParts[0] ||
        ''
    const lastName =
        rest.lastName ||
        client?.lastName ||
        (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '') ||
        ''

    const docType = rest.docType || docInfo.docType || ''
    const docNumber = rest.docNumber || docInfo.docNumber || ''

    const paymentType = rest.paymentType || 'BALANCE'

    return NextResponse.json({
        ...rest,
        createdBy: user,
        firstName,
        lastName,
        nationality: rest.nationality || client?.nationality || '',
        docType,
        docNumber,
        phoneNumber: client?.phoneNumber || rest.phone || null,
        email: client?.email || rest.email || null,
        accommodation: rest.roomNumber || null,
        price: rest.totalPrice,
        deposit: rest.paidAmount || 0,
        isOption: paymentType === 'OPTION',
        paymentType
    })
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const participant = await prisma.participant.findUnique({
    where: { id },
    include: {
      client: {
        select: {
          firstName: true,
          lastName: true,
          email: true
        }
      }
    }
  })
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
         if (participant.transferId) {
             const transfer = await prisma.transfer.findUnique({
                 where: { id: participant.transferId },
                 select: { id: true, approvalStatus: true, priceAdult: true, priceChild: true, maxParticipants: true }
             })
             if (transfer && transfer.approvalStatus !== 'APPROVED') {
                 if (session.user.role !== 'ADMIN') {
                     return NextResponse.json({ error: 'Solo gli amministratori possono approvare i trasferimenti.' }, { status: 403 })
                 }
                 const rawPa = body.transferPriceAdult
                 const rawPc = body.transferPriceChild
                 const rawMp = body.transferMaxParticipants

                 if (rawPa === undefined || rawPc === undefined || rawMp === undefined) {
                     return NextResponse.json(
                         {
                             error: 'Per approvare il trasferimento inserisci prezzo adulti, prezzo bambini e massimo partecipanti.',
                             code: 'TRANSFER_APPROVAL_REQUIRED',
                             transfer
                         },
                         { status: 409 }
                     )
                 }

                 const pa = parseFloat(String(rawPa))
                 const pc = parseFloat(String(rawPc))
                 const mp = parseInt(String(rawMp))

                 if (Number.isNaN(pa) || Number.isNaN(pc) || Number.isNaN(mp) || mp <= 0 || (pa <= 0 && pc <= 0) || pa < 0 || pc < 0) {
                     return NextResponse.json(
                         { error: 'Valori non validi: controlla prezzi e massimo partecipanti.' },
                         { status: 400 }
                     )
                 }

                 await prisma.transfer.update({
                     where: { id: transfer.id },
                     data: {
                         approvalStatus: 'APPROVED',
                         priceAdult: pa,
                         priceChild: pc,
                         maxParticipants: mp
                     }
                 })

                 try {
                     await createAuditLog(
                         session.user.id,
                         'APPROVE_TRANSFER',
                         'TRANSFER',
                         transfer.id,
                         `Approvato trasferimento da approvazione partecipante ${participant.id}. Prezzi: Adulti €${pa}, Bambini €${pc}, Max ${mp}.`,
                         null,
                         transfer.id,
                         null
                     )
                 } catch (auditError) {
                     console.error('Audit log failed:', auditError)
                 }
             }
         }
         // Log the approval
         try {
                     await createAuditLog(
                       session.user.id,
                       'APPROVE_PARTICIPANT',
                       'PARTICIPANT',
                       participant.id,
                       `Approvato sconto per partecipante ${participant.id}. Prezzo finale: €${body.price || participant.totalPrice}`,
                       participant.excursionId,
                       participant.transferId,
                       participant.rentalId
                     )
         } catch (auditError) {
             console.error('Audit log failed:', auditError)
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
            participant.transferId,
            participant.rentalId
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

    if (approvalStatus === 'REJECTED') {
      paymentStatus = 'REJECTED'
    }

    if ((participant.excursionId || participant.transferId) && (body.price !== undefined || body.adults !== undefined || body.children !== undefined)) {
      let expectedPrice = 0
      let transferNotApproved = false
      
      if (participant.excursionId) {
          const excursion = await prisma.excursion.findUnique({
            where: { id: participant.excursionId },
            select: { priceAdult: true, priceChild: true }
          })
          if (excursion) {
             expectedPrice = (finalAdults * (excursion.priceAdult || 0)) + (finalChildren * (excursion.priceChild || 0))
          }
      } else if (participant.transferId) {
          const transfer = await prisma.transfer.findUnique({
            where: { id: participant.transferId },
            select: { priceAdult: true, priceChild: true, approvalStatus: true }
          })
          if (transfer) {
             expectedPrice = (finalAdults * (transfer.priceAdult || 0)) + (finalChildren * (transfer.priceChild || 0))
             transferNotApproved = transfer.approvalStatus !== 'APPROVED'
          }
      }

      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true }
      })
      const isAdmin = user?.role === 'ADMIN'

      if (!isAdmin) {
        if (transferNotApproved) {
            approvalStatus = 'PENDING'
            paymentStatus = 'PENDING_APPROVAL'
        } else if (Math.abs(finalTotalPrice - expectedPrice) > 0.01) {
            approvalStatus = 'PENDING'
            // originalPrice could be stored if we had a field for it, but for now we just flag as PENDING
            paymentStatus = 'PENDING_APPROVAL'
        } else {
            // Se il prezzo è corretto, lo stato rimane quello attuale o diventa APPROVED se era PENDING_APPROVAL?
            // Se era PENDING_APPROVAL e ora il prezzo è corretto, dovrebbe auto-approvarsi?
            // User non l'ha specificato, ma "Se un assistente modifica... deve essere richiesta approvazione".
            // Se ripristina il prezzo corretto, forse no.
            // Ma per sicurezza, se era PENDING_APPROVAL, forse meglio lasciarlo tale o resettarlo.
            // Assumiamo che se il prezzo torna "standard", l'approvazione non serve più.
            if (participant.approvalStatus === 'PENDING') {
                approvalStatus = 'APPROVED'
                paymentStatus = 'PENDING' // Reset to pending payment logic (will be handled by applyPaymentLogic)
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
        approvalStatus: approvalStatus ?? participant.approvalStatus,
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
      const oldType = participant.paymentType ? (paymentTypeMap[participant.paymentType] || participant.paymentType) : 'N/A'
      const newType = body.paymentType ? (paymentTypeMap[body.paymentType] || body.paymentType) : 'N/A'
      changes.push(`Tipo Pagamento: ${oldType} -> ${newType}`)
    }
    if (body.paymentMethod !== undefined && body.paymentMethod !== participant.paymentMethod) {
      const oldMethod = participant.paymentMethod ? (paymentMethodMap[participant.paymentMethod] || participant.paymentMethod) : 'N/A'
      const newMethod = body.paymentMethod ? (paymentMethodMap[body.paymentMethod] || body.paymentMethod) : 'N/A'
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

    const recipientEmail = updated.email || participant.client?.email || participant.email
    if (recipientEmail) {
      try {
        const allowSelfSigned =
          process.env.SMTP_ALLOW_SELF_SIGNED === 'true' ||
          process.env.NODE_ENV !== 'production'

        if (allowSelfSigned) {
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
        }

        let transporter

        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
          transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
              user: process.env.EMAIL_USER,
              pass: process.env.EMAIL_PASS
            },
            tls: {
              rejectUnauthorized: !allowSelfSigned
            }
          })
        } else if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
          transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: false,
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS
            },
            tls: allowSelfSigned ? { rejectUnauthorized: false } : undefined
          })
        } else {
          const testAccount = await nodemailer.createTestAccount()
          transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
              user: testAccount.user,
              pass: testAccount.pass
            }
          })
        }

        const attachments: { filename: string; content: Buffer }[] = []
        if (body.pdfAttachmentIT && body.pdfAttachmentEN) {
          attachments.push({
            filename: `Prenotazione_${participant.id}_IT.pdf`,
            content: Buffer.from(body.pdfAttachmentIT, 'base64')
          })
          attachments.push({
            filename: `Prenotazione_${participant.id}_EN.pdf`,
            content: Buffer.from(body.pdfAttachmentEN, 'base64')
          })
        } else if (body.pdfAttachment) {
          attachments.push({
            filename: `Prenotazione_${participant.id}.pdf`,
            content: Buffer.from(body.pdfAttachment, 'base64')
          })
        }

        const safeName =
          `${updated.firstName || participant.firstName || participant.client?.firstName || ''} ${updated.lastName || participant.lastName || participant.client?.lastName || ''}`.trim() ||
          'Cliente'

        const effectiveApprovalStatus = approvalStatus ?? updated.approvalStatus
        const effectivePaymentStatus = updated.paymentStatus

        let subject = 'Aggiornamento Prenotazione - Corfumania'
        let text = `Gentile ${safeName},\n\nLa tua prenotazione è stata aggiornata.\n\n${details}\n\nCordiali saluti,\nTeam Corfumania`

        if (effectiveApprovalStatus === 'REJECTED' || effectivePaymentStatus === 'REJECTED') {
          const paidValue = typeof updated.paidAmount === 'number' ? updated.paidAmount : 0
          const refundLine =
            paidValue > 0.01
              ? `\n\nPer il ritiro dei soldi versati (acconto o saldo) pari a €${paidValue.toFixed(2)}, passa in sede.`
              : ''

          subject = 'Richiesta non approvata - Corfumania'
          text = `Gentile ${safeName},\n\nla tua richiesta non è stata approvata.${refundLine}\n\nPer informazioni contattaci.\n\nCorfumania`
        } else if (effectiveApprovalStatus === 'APPROVED') {
          subject = 'Prenotazione Confermata - Corfumania'
          text = `Gentile ${safeName},\n\nla tua prenotazione è stata confermata.${attachments.length > 0 ? '\nIn allegato trovi il voucher aggiornato.' : ''}\n\nCordiali saluti,\nTeam Corfumania`
        } else if (effectivePaymentStatus === 'PENDING_APPROVAL') {
          subject = 'Prenotazione in Attesa di Approvazione - Corfumania'
          text = `Gentile ${safeName},\n\nabbiamo ricevuto la tua prenotazione ed è in attesa di approvazione.\nRiceverai una conferma definitiva appena possibile.\n\nCordiali saluti,\nTeam Corfumania`
        } else if (updated.paymentType === 'BALANCE') {
          subject = 'Conferma Saldo - Corfumania'
        }

        const from =
          process.env.MAIL_FROM ||
          process.env.EMAIL_USER ||
          process.env.SMTP_USER ||
          'no-reply@localhost'

        await transporter.sendMail({
          from,
          to: recipientEmail,
          subject,
          text,
          attachments: attachments.length > 0 ? attachments : undefined
        })

        try {
          await createAuditLog(
            session.user.id,
            'SEND_PARTICIPANT_EMAIL',
            'PARTICIPANT',
            participant.id,
            `Inviata email (${subject}) a ${recipientEmail}`,
            participant.excursionId,
            participant.transferId,
            participant.rentalId
          )
        } catch (auditError) {
          console.error('Audit log failed:', auditError)
        }
      } catch (emailError) {
        console.error('Error sending participant email:', emailError)
        try {
          await createAuditLog(
            session.user.id,
            'SEND_PARTICIPANT_EMAIL_FAILED',
            'PARTICIPANT',
            participant.id,
            `Invio email fallito: ${(emailError as any)?.message || 'Errore sconosciuto'}`,
            participant.excursionId,
            participant.transferId,
            participant.rentalId
          )
        } catch (auditError) {
          console.error('Audit log failed:', auditError)
        }
      }
    } else {
      try {
        await createAuditLog(
          session.user.id,
          'SEND_PARTICIPANT_EMAIL_SKIPPED',
          'PARTICIPANT',
          participant.id,
          'Email non inviata: destinatario senza email',
          participant.excursionId,
          participant.transferId,
          participant.rentalId
        )
      } catch (auditError) {
        console.error('Audit log failed:', auditError)
      }
    }

    await createAuditLog(
      session.user.id,
      'UPDATE_PARTICIPANT',
      'PARTICIPANT',
      participant.id,
      details,
      participant.excursionId,
      participant.transferId,
      participant.rentalId
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
    participant.transferId,
    participant.rentalId
  )

  return NextResponse.json({ success: true })
}
