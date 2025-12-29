import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const archived = searchParams.get('archived') === 'true'
  const now = new Date()

  // Check for expired deadlines and update participants
  const expiredExcursions = await prisma.excursion.findMany({
    where: {
      confirmationDeadline: { lt: now }
    },
    select: { id: true }
  })

  if (expiredExcursions.length > 0) {
    const expiredIds = expiredExcursions.map(e => e.id)
    await prisma.participant.updateMany({
      where: {
        excursionId: { in: expiredIds },
        isExpired: false,
        OR: [
          { isOption: true },
          { paymentType: 'DEPOSIT' }
        ]
      },
      data: { isExpired: true }
    })
  }

  const whereClause: any = {}
  
  if (id) {
    whereClause.id = id
  } else {
    if (archived) {
      whereClause.endDate = { lt: now }
    } else {
      whereClause.OR = [
        { endDate: { gte: now } },
        { endDate: null }
      ]
    }
  }

  const excursionsData = await prisma.excursion.findMany({
    where: whereClause,
    orderBy: { startDate: 'asc' },
    include: {
      participants: {
        where: { isExpired: false },
        select: { groupSize: true }
      }
    }
  })

  const excursions = excursionsData.map(excursion => {
    const totalParticipants = excursion.participants.reduce((sum, p) => sum + (p.groupSize || 1), 0)
    const { participants, ...rest } = excursion
    return {
      ...rest,
      _count: {
        participants: totalParticipants
      }
    }
  })

  return NextResponse.json(excursions)
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const body = await request.json()
  const { name, startDate, endDate, confirmationDeadline } = body

  // Validation
  if (startDate) {
    const start = new Date(startDate)
    if (endDate && new Date(endDate) < start) {
      return NextResponse.json({ error: 'La data di fine non può essere precedente alla data di inizio.' }, { status: 400 })
    }
    if (confirmationDeadline && new Date(confirmationDeadline) > start) {
      return NextResponse.json({ error: 'La data di scadenza non può essere successiva alla data di inizio.' }, { status: 400 })
    }
  }

  const excursion = await prisma.excursion.create({
    data: {
      name,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      confirmationDeadline: confirmationDeadline ? new Date(confirmationDeadline) : null
    }
  })

  await createAuditLog(
    session.user.id,
    excursion.id,
    'CREATE_EXCURSION',
    `Creata escursione "${name}"`
  )

  return NextResponse.json(excursion)
}

export async function PUT(request: Request) {
  const session = await getSession()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const body = await request.json()
  const { id, name, startDate, endDate, confirmationDeadline } = body

  // Validation
  if (startDate) {
    const start = new Date(startDate)
    if (endDate && new Date(endDate) < start) {
      return NextResponse.json({ error: 'La data di fine non può essere precedente alla data di inizio.' }, { status: 400 })
    }
    if (confirmationDeadline && new Date(confirmationDeadline) > start) {
      return NextResponse.json({ error: 'La data di scadenza non può essere successiva alla data di inizio.' }, { status: 400 })
    }
  }

  const excursion = await prisma.excursion.update({
    where: { id },
    data: {
      name,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      confirmationDeadline: confirmationDeadline ? new Date(confirmationDeadline) : null
    }
  })

  // If deadline is extended to the future, reactivate expired participants
  if (confirmationDeadline && new Date(confirmationDeadline) > new Date()) {
    await prisma.participant.updateMany({
      where: {
        excursionId: id,
        isExpired: true
      },
      data: {
        isExpired: false
      }
    })
  }

  await createAuditLog(
    session.user.id,
    excursion.id,
    'UPDATE_EXCURSION',
    `Modificata escursione "${name}"`
  )

  return NextResponse.json(excursion)
}
