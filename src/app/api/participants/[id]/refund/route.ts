import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import nodemailer from 'nodemailer'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  try {
    const { refundMethod, refundAmount, notes, pdfAttachment } = await request.json()

    if (!refundMethod || !refundAmount) {
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 })
    }

    const participant = await prisma.participant.findUnique({
      where: { id }
    })

    if (!participant) {
      return NextResponse.json({ error: 'Partecipante non trovato' }, { status: 404 })
    }

    if (session.user.role !== 'ADMIN' && participant.createdById !== session.user.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
    }

    const methodLabels: Record<string, string> = {
      'CASH': 'Contanti',
      'TRANSFER': 'Bonifico',
      'CARD': 'Carta'
    }

    // 1. Update the participant to REFUNDED status instead of deleting
    await prisma.participant.update({
      where: { id },
      data: {
        paymentType: 'REFUNDED',
        notes: participant.notes 
          ? `${participant.notes}\n[${new Date().toLocaleDateString()}] Rimborsato €${refundAmount} (${methodLabels[refundMethod] || refundMethod}) - ${notes || ''}`
          : `[${new Date().toLocaleDateString()}] Rimborsato €${refundAmount} (${methodLabels[refundMethod] || refundMethod}) - ${notes || ''}`
      }
    })

    // 2. Create Audit Log
    const details = `RIMBORSO: Partecipante ${participant.firstName} ${participant.lastName} rimborsato di €${refundAmount} tramite ${methodLabels[refundMethod] || refundMethod}. Stato aggiornato a REFUNDED.`

    await createAuditLog(
      session.user.id,
      'UPDATE_PARTICIPANT', 
      details,
      participant.excursionId,
      participant.transferId
    )

    // 3. Send Email if PDF is provided
    if (participant.email && pdfAttachment) {
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

        await transporter.sendMail({
          from: `"Corfumania" <${process.env.EMAIL_USER}>`,
          to: participant.email,
          subject: 'Rimborso Effettuato - Corfumania',
          text: `Gentile ${participant.firstName} ${participant.lastName},\n\nTi informiamo che è stato effettuato un rimborso di €${refundAmount}. In allegato trovi il documento aggiornato.\n\nCordiali saluti,\nTeam Corfumania`,
          attachments: [
            {
              filename: `Rimborso_${participant.firstName}_${participant.lastName}.pdf`,
              content: pdfAttachment,
              encoding: 'base64',
            },
          ],
        })
        console.log('Email rimborso inviata a:', participant.email)
      } catch (emailError) {
        console.error('Error sending refund email:', emailError)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error processing refund:', error)
    return NextResponse.json(
      { error: 'Errore durante il rimborso' },
      { status: 500 }
    )
  }
}
