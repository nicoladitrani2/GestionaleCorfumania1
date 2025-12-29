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

  if (!excursionId) return NextResponse.json({ error: 'Excursion ID required' }, { status: 400 })

  const participants = await prisma.participant.findMany({
    where: { excursionId },
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
    if (!body.excursionId) {
      return NextResponse.json({ error: 'ID escursione mancante.' }, { status: 400 })
    }

    const { 
      excursionId, firstName, lastName, nationality, dateOfBirth, 
      docNumber, docType, phoneNumber, email, notes, supplier, isOption,
      paymentType, paymentMethod, groupSize, price, deposit, pdfAttachment
    } = body

    const participant = await prisma.participant.create({
      data: {
        excursionId,
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
        isOption,
        paymentType,
        paymentMethod,
        groupSize: parseInt(groupSize) || 1,
        price: price || 0,
        deposit: deposit || 0,
        createdById: session.user.id
      }
    })

    const paymentMethodMap: Record<string, string> = {
      'CASH': 'Contanti',
      'TRANSFER': 'Bonifico',
      'CARD': 'Carta'
    }

    const methodLabel = paymentMethodMap[paymentMethod] || paymentMethod
    const details = `Aggiunto partecipante ${firstName} ${lastName} (Gruppo: ${groupSize}, Prezzo: €${price}, Acconto: €${deposit}, Metodo: ${methodLabel})`

    await createAuditLog(
      session.user.id,
      excursionId,
      'CREATE_PARTICIPANT',
      details
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
            subject: 'Conferma Prenotazione Escursione - Corfumania',
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
            { error: 'Errore di validazione: L\'escursione o l\'utente non esistono più. Prova ad aggiornare la pagina.' },
            { status: 400 }
        )
    }

    return NextResponse.json(
      { error: `Errore durante la creazione del partecipante: ${error.message}` },
      { status: 500 }
    )
  }
}
