import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

function redactAuditDetails(details: unknown): string {
  const text = typeof details === 'string' ? details : String(details || '')
  return text
    .replace(/€\s*([0-9]+(?:[.,][0-9]+)?)/g, '€ —')
    .replace(/\b(CASH|DIGITAL|TRANSFER|CARD)\b/gi, 'METODO_NASCOSTO')
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const { id } = await params

  try {
    let canViewFinancials = false
    if (session.user.id) {
      const operator = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, isSpecialAssistant: true },
      })
      canViewFinancials = String(operator?.role || '').toUpperCase() === 'ADMIN' || !!operator?.isSpecialAssistant
    }

    const logs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { rentalId: id },
          {
            entityType: 'RENTAL',
            entityId: id,
          },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (canViewFinancials) return NextResponse.json(logs)
    const redacted = logs.map(l => ({
      ...l,
      details: redactAuditDetails((l as any).details),
    }))
    return NextResponse.json(redacted)
  } catch (error) {
    return NextResponse.json(
      { error: 'Errore nel recupero della cronologia' },
      { status: 500 }
    )
  }
}
