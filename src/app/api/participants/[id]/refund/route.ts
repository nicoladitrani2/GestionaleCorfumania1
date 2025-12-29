import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  try {
    const { refundMethod, refundAmount, notes } = await request.json()

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

    // 1. Delete the participant
    await prisma.participant.delete({
      where: { id }
    })

    // 2. Create Audit Log
    const methodLabels: Record<string, string> = {
      'CASH': 'Contanti',
      'TRANSFER': 'Bonifico',
      'CARD': 'Carta'
    }

    const details = `RIMBORSO: Partecipante ${participant.firstName} ${participant.lastName} rimborsato di €${refundAmount} tramite ${methodLabels[refundMethod] || refundMethod}. ${notes ? `Note: ${notes}. ` : ''}Partecipante eliminato.`

    await createAuditLog(
      session.user.id,
      participant.excursionId,
      'DELETE_PARTICIPANT', // Using DELETE_PARTICIPANT category but with specific refund details
      details
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error processing refund:', error)
    return NextResponse.json(
      { error: 'Errore durante il rimborso' },
      { status: 500 }
    )
  }
}
