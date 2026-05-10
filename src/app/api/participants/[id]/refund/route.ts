import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import { sendMail } from '@/lib/mailer'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  try {
    const { refundMethod, refundAmount, notes, pdfAttachment, pdfAttachmentIT, pdfAttachmentEN } = await request.json()

    const parsedAmount = Number(refundAmount || 0)
    if (!refundMethod || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 })
    }

    const participant = await prisma.participant.findUnique({
      where: { id },
      include: {
        paymentEvents: {
          select: { direction: true, method: true, amount: true, createdAt: true }
        }
      }
    })

    if (!participant) {
      return NextResponse.json({ error: 'Partecipante non trovato' }, { status: 404 })
    }

    if (session.user.role !== 'ADMIN' && participant.userId !== session.user.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
    }
    
    if (participant.excursionId) {
      const excursion = await prisma.excursion.findUnique({
        where: { id: participant.excursionId },
        select: { confirmationDeadline: true }
      })
      const now = new Date()
      if (excursion?.confirmationDeadline && new Date(excursion.confirmationDeadline) < now && session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Rimborso non consentito dopo la scadenza dell\'escursione' }, { status: 403 })
      }
    }

    const methodLabels: Record<string, string> = {
      'CASH': 'Contanti',
      'TRANSFER': 'Digitale',
      'CARD': 'Digitale',
      'DIGITAL': 'Digitale'
    }

    const bucket = (raw: any): 'CASH' | 'DIGITAL' => {
      const m = String(raw || '').trim().toUpperCase()
      return m === 'CASH' ? 'CASH' : 'DIGITAL'
    }

    const extractRefundsFromNotes = (text: any): number => {
      const notesText = typeof text === 'string' ? text : ''
      if (!notesText) return 0
      let total = 0
      const re = /Rimborsato\s+€\s*([0-9]+(?:[.,][0-9]+)?)\s*\(([^)]+)\)/gi
      let match: RegExpExecArray | null = null
      while ((match = re.exec(notesText)) !== null) {
        const rawAmount = String(match[1] || '').replace(',', '.')
        const amount = parseFloat(rawAmount)
        if (!Number.isFinite(amount) || amount <= 0) continue
        total += amount
      }
      return total
    }

    const events = Array.isArray((participant as any).paymentEvents) ? ((participant as any).paymentEvents as any[]) : []
    let inEventsTotal = 0
    let outEventsTotal = 0
    for (const e of events) {
      const dir = String(e?.direction || '').trim().toUpperCase()
      const amount = Number(e?.amount || 0)
      if (!Number.isFinite(amount) || amount <= 0) continue
      if (dir === 'OUT') outEventsTotal += amount
      else inEventsTotal += amount
    }

    const legacyIncomingTotal = Math.max(0, Number(participant.paidAmount || 0))
    const legacyOutgoingTotal = extractRefundsFromNotes(participant.notes)

    const incomingBase = Math.max(inEventsTotal, legacyIncomingTotal)
    const outgoingBase = Math.max(outEventsTotal, legacyOutgoingTotal)
    const available = Math.max(0, incomingBase - outgoingBase)

    if (parsedAmount > available + 0.009) {
      return NextResponse.json(
        { error: `Importo massimo rimborsabile: € ${available.toFixed(2)}` },
        { status: 400 }
      )
    }

    // 1. Update the participant to REFUNDED status instead of deleting
    await prisma.participant.update({
      where: { id },
      data: {
        paymentType: 'REFUNDED',
        notes: participant.notes 
          ? `${participant.notes}\n[${new Date().toLocaleDateString()}] Rimborsato €${parsedAmount} (${methodLabels[refundMethod] || refundMethod}) - ${notes || ''}`
          : `[${new Date().toLocaleDateString()}] Rimborsato €${parsedAmount} (${methodLabels[refundMethod] || refundMethod}) - ${notes || ''}`
      }
    })

    await prisma.participantPaymentEvent.create({
      data: {
        participantId: participant.id,
        direction: 'OUT',
        method: bucket(refundMethod),
        kind: 'REFUND',
        amount: parsedAmount,
        notes: notes || null,
      }
    })

    // 2. Create Audit Log
    const safeName = participant.name || 'Cliente'
    const details = `RIMBORSO: Partecipante ${safeName} rimborsato di €${parsedAmount} tramite ${methodLabels[refundMethod] || refundMethod}. Stato aggiornato a REFUNDED.`

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

    // 3. Send Email if PDF is provided
    const hasAttachments = (pdfAttachmentIT && pdfAttachmentEN) || pdfAttachment

    if (participant.email && hasAttachments) {
      try {
        const attachments = []
        if (pdfAttachmentIT && pdfAttachmentEN) {
             attachments.push({
                    filename: `Rimborso_${safeName}_IT.pdf`,
                    content: Buffer.from(pdfAttachmentIT, 'base64')
             })
             attachments.push({
                    filename: `Refund_${safeName}_EN.pdf`,
                    content: Buffer.from(pdfAttachmentEN, 'base64')
             })
        } else if (pdfAttachment) {
             attachments.push({
                    filename: `Rimborso_${safeName}.pdf`,
                    content: Buffer.from(pdfAttachment, 'base64')
             })
        }

        await sendMail({
          to: participant.email,
          subject: 'Rimborso Effettuato - Corfumania',
          text: `Gentile ${safeName},\n\nTi informiamo che è stato effettuato un rimborso di €${parsedAmount}. In allegato trovi il documento aggiornato (IT/EN).\n\nCordiali saluti,\nTeam Corfumania`,
          attachments,
        })
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
