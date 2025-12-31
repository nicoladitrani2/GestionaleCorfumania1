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
  // Set to beginning of today
  now.setHours(0, 0, 0, 0)

  // Check for expired transfers and update participants
  const expiredTransfers = await prisma.transfer.findMany({
    where: {
      date: { lt: now }
    },
    select: { id: true }
  })

  if (expiredTransfers.length > 0) {
    const expiredIds = expiredTransfers.map(t => t.id)
    await prisma.participant.updateMany({
      where: {
        transferId: { in: expiredIds },
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
      whereClause.date = { lt: now }
    } else {
      whereClause.date = { gte: now }
    }
  }

  const transfersData = await prisma.transfer.findMany({
    where: whereClause,
    orderBy: { date: 'asc' },
    include: {
      participants: {
        select: { 
          groupSize: true,
          deposit: true,
          price: true,
          paymentType: true,
          isOption: true,
          isExpired: true
        }
      }
    }
  })

  const transfers = transfersData.map(transfer => {
    // Calculate stats
    let activeParticipants = 0
    let countPaid = 0
    let countDeposit = 0
    let countRefunded = 0
    let countOption = 0
    
    let totalCollected = 0

    transfer.participants.forEach(p => {
        // Skip expired for total count, but keep for history? 
        // User wants separation. Let's count them based on status.
        // Usually expired = deleted logic, but here we have isExpired flag.
        // Assuming we count all relevant ones.
        
        const size = p.groupSize || 1
        const dep = typeof p.deposit === 'number' ? p.deposit : Number(p.deposit)
        const pr = typeof p.price === 'number' ? p.price : Number(p.price)
        
        if (p.paymentType === 'REFUNDED') {
            countRefunded += size
        } else if (p.isOption) {
            countOption += size
            if (!p.isExpired) activeParticipants += size
        } else {
            // Real payments
            if (!p.isExpired) activeParticipants += size
            totalCollected += (isNaN(dep) ? 0 : dep)
            
            if (p.paymentType === 'BALANCE' || (dep >= pr && pr > 0)) {
                countPaid += size
            } else {
                countDeposit += size
            }
        }
    })

    const { participants, ...rest } = transfer
    
    const result: any = {
      ...rest,
      _count: {
        participants: activeParticipants
      },
      stats: {
        paid: countPaid,
        deposit: countDeposit,
        refunded: countRefunded,
        option: countOption
      }
    }

    if (session.user.role === 'ADMIN') {
      result.totalCollected = totalCollected
    }

    return result
  })

  return NextResponse.json(transfers)
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name, date, supplier, pickupLocation, dropoffLocation, endDate } = body

    if (!name || !date || !supplier) {
        return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 })
    }

    const startDate = new Date(date)
    const now = new Date()
    
    // Validate past date (allow 5 minute buffer)
    if (startDate < new Date(now.getTime() - 5 * 60 * 1000)) {
        return NextResponse.json({ error: 'La data di partenza non può essere nel passato.' }, { status: 400 })
    }

    if (endDate && new Date(endDate) < startDate) {
        return NextResponse.json({ error: 'La data di arrivo non può essere precedente alla data di partenza.' }, { status: 400 })
    }

    const transfer = await prisma.transfer.create({
      data: {
        name,
        date: new Date(date),
        endDate: endDate ? new Date(endDate) : undefined,
        pickupLocation,
        dropoffLocation,
        supplier
      }
    })

    await createAuditLog(
        session.user.id,
        'CREATE_TRANSFER',
        `Creato trasferimento: ${name} (${supplier})`,
        undefined,
        transfer.id
    )

    return NextResponse.json(transfer)
  } catch (error: any) {
    console.error('Error creating transfer:', error)
    return NextResponse.json({ error: error.message || 'Errore durante la creazione' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const session = await getSession()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { id, name, date, supplier, pickupLocation, dropoffLocation, endDate } = body

    if (!id) return NextResponse.json({ error: 'ID mancante' }, { status: 400 })

    if (date && endDate) {
        const start = new Date(date)
        const end = new Date(endDate)
        if (end < start) {
            return NextResponse.json({ error: 'La data di arrivo non può essere precedente alla data di partenza.' }, { status: 400 })
        }
    }

    const transfer = await prisma.transfer.update({
      where: { id },
      data: {
        name,
        date: date ? new Date(date) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        pickupLocation,
        dropoffLocation,
        supplier
      }
    })

    // If date is updated to today or future, reactivate expired participants
    if (date) {
      const newDate = new Date(date)
      const now = new Date()
      now.setHours(0, 0, 0, 0)

      if (newDate >= now) {
        await prisma.participant.updateMany({
          where: {
            transferId: id,
            isExpired: true
          },
          data: {
            isExpired: false
          }
        })
      }
    }

    await createAuditLog(
      session.user.id,
      'UPDATE_TRANSFER',
      `Modificato trasferimento: ${name}`,
      undefined,
      transfer.id
    )

    return NextResponse.json(transfer)
  } catch (error) {
    return NextResponse.json({ error: 'Errore durante l\'aggiornamento' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await getSession()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'ID mancante' }, { status: 400 })
  }

  try {
    const transfer = await prisma.transfer.findUnique({ where: { id } })
    if (transfer) {
        await prisma.transfer.delete({ where: { id } })
        
        await createAuditLog(
            session.user.id,
            'DELETE_TRANSFER',
            `Eliminato trasferimento: ${transfer.name}`,
            undefined,
            id
        )
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting transfer:', error)
    return NextResponse.json({ error: 'Errore durante l\'eliminazione' }, { status: 500 })
  }
}
