import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import nodemailer from 'nodemailer'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const excursionId = searchParams.get('excursionId')
  const transferId = searchParams.get('transferId')

  if (!excursionId && !transferId) return NextResponse.json({ error: 'Excursion ID or Transfer ID required' }, { status: 400 })

  const whereClause: any = {}
  if (excursionId) whereClause.excursionId = excursionId
  if (transferId) whereClause.transferId = transferId

  const participants = await prisma.participant.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    include: { createdBy: { select: { firstName: true, lastName: true, email: true, code: true } } }
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
    if (!body.excursionId && !body.transferId) {
      return NextResponse.json({ error: 'ID escursione o trasferimento mancante.' }, { status: 400 })
    }

    const { 
      excursionId, transferId, firstName, lastName, nationality, dateOfBirth, 
      docNumber, docType, phoneNumber, email, notes, supplier, isOption,
      paymentType, paymentMethod, depositPaymentMethod, balancePaymentMethod,
      groupSize, price, deposit, pdfAttachment,
      pickupLocation, dropoffLocation, pickupTime, returnPickupLocation, returnDate, returnTime
    } = body

    // Check expiration logic
    let isExpired = false
    if (excursionId) {
        const excursion = await prisma.excursion.findUnique({
          where: { id: excursionId },
          select: { confirmationDeadline: true }
        })

        if (excursion?.confirmationDeadline) {
          const now = new Date()
          const isDeadlinePassed = new Date(excursion.confirmationDeadline) < now
          if (isDeadlinePassed && (isOption || paymentType === 'DEPOSIT')) {
            isExpired = true
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

        groupSize: parseInt(groupSize) || 1,
        price: price || 0,
        deposit: deposit || 0,
        isExpired,
        createdById: session.user.id
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

    const details = `Aggiunto partecipante ${firstName} ${lastName} (Gruppo: ${groupSize}, Prezzo: €${price}, Acconto: €${deposit}, Metodo: ${methodLabel})`

    await createAuditLog(
      session.user.id,
      'CREATE_PARTICIPANT',
      details,
      excursionId || null,
      transferId || null
    )

    // Send Email if email and PDF are provided
    if (email && pdfAttachment) {
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

        const info = await transporter.sendMail({
            from: `"Corfumania" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Conferma Prenotazione - Corfumania',
            text: `Gentile ${firstName} ${lastName},\n\nIn allegato trovi il riepilogo della tua prenotazione.\n\nCordiali saluti,\nTeam Corfumania`,
            attachments: [
                {
                    filename: `Riepilogo_${firstName}_${lastName}.pdf`,
                    content: Buffer.from(pdfAttachment, 'base64')
                }
            ]
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
