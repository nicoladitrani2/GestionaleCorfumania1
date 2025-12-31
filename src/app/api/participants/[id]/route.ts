import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import nodemailer from 'nodemailer'

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

    // Validation
    if (body.firstName !== undefined && !body.firstName?.trim()) {
      return NextResponse.json({ error: 'Il nome è obbligatorio.' }, { status: 400 })
    }
    if (body.lastName !== undefined && !body.lastName?.trim()) {
      return NextResponse.json({ error: 'Il cognome è obbligatorio.' }, { status: 400 })
    }
    if (body.groupSize !== undefined && (parseInt(body.groupSize) < 1)) {
      return NextResponse.json({ error: 'Il numero di partecipanti deve essere almeno 1.' }, { status: 400 })
    }
    
    // Check expiration logic
    let newIsExpired = false
    if (participant.excursionId) {
      const excursion = await prisma.excursion.findUnique({
        where: { id: participant.excursionId },
        select: { confirmationDeadline: true }
      })

      if (excursion?.confirmationDeadline) {
        const now = new Date()
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

    const updated = await prisma.participant.update({
      where: { id },
      data: {
          firstName: body.firstName,
          lastName: body.lastName,
          nationality: body.nationality,
          dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
          docNumber: body.docNumber,
          docType: body.docType,
          phoneNumber: body.phoneNumber,
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

          groupSize: body.groupSize ? parseInt(body.groupSize) : 1,
          price: body.price !== undefined ? body.price : undefined,
          deposit: body.deposit !== undefined ? body.deposit : undefined,
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

    let details = `Modificato partecipante ${updated.firstName} ${updated.lastName}`
    if (changes.length > 0) {
      details += `: ${changes.join(', ')}`
    }

    await createAuditLog(
      session.user.id,
      'UPDATE_PARTICIPANT',
      details,
      participant.excursionId,
      participant.transferId
    )

    // Send Email if email and PDF are provided (Logic copied from POST)
    if (body.email && body.pdfAttachment) {
      console.log('Tentativo invio email AGGIORNAMENTO a:', body.email);
      
      try {
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
        });

        // Verify connection configuration
        await new Promise((resolve, reject) => {
            transporter.verify(function (error, success) {
                if (error) {
                    console.error('Errore verifica SMTP:', error);
                    reject(error);
                } else {
                    console.log("Server SMTP pronto per l'invio (UPDATE)");
                    resolve(success);
                }
            });
        });

        const info = await transporter.sendMail({
            from: `"Corfumania" <${process.env.EMAIL_USER}>`,
            to: body.email,
            subject: 'Aggiornamento Prenotazione - Corfumania',
            text: `Gentile ${updated.firstName} ${updated.lastName},\n\nIn allegato trovi il riepilogo AGGIORNATO della tua prenotazione.\n\nCordiali saluti,\nTeam Corfumania`,
            attachments: [
                {
                    filename: `Riepilogo_${updated.firstName}_${updated.lastName}_Aggiornato.pdf`,
                    content: Buffer.from(body.pdfAttachment, 'base64')
                }
            ]
        });

        console.log('Email aggiornamento inviata con successo:', info.messageId);

      } catch (emailError: any) {
        console.error('FALLIMENTO INVIO EMAIL AGGIORNAMENTO:', emailError);
        if (emailError.response) {
            console.error('SMTP Response:', emailError.response);
        }
      }
    }

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
