import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'

function buildApiErrorPayload(error: unknown, fallback: string) {
  const details = error instanceof Error ? error.message : String(error)
  const payload: {
    error: string
    details?: string
    code?: string
    meta?: Record<string, unknown>
    hint?: string[]
  } = { error: fallback, details }

  const hints: string[] = []

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    payload.code = error.code
    payload.meta = (error.meta ?? {}) as Record<string, unknown>
  } else if (error instanceof Prisma.PrismaClientInitializationError) {
    payload.code = 'PRISMA_INIT'
  } else if (error instanceof Prisma.PrismaClientRustPanicError) {
    payload.code = 'PRISMA_PANIC'
  } else if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    payload.code = 'PRISMA_UNKNOWN'
  }

  const lower = String(details || '').toLowerCase()
  if (lower.includes('does not exist') || lower.includes('relation') || payload.code === 'P2021') {
    hints.push('Sembra mancare una tabella/colonna nel database: verifica di aver eseguito le migrazioni Prisma.')
    hints.push('Esegui: npx prisma migrate dev (oppure npx prisma migrate deploy in produzione).')
  }
  if (lower.includes("can't reach database") || lower.includes('p1001')) {
    hints.push('Il database non è raggiungibile: verifica host/porta e che il container/servizio sia avviato.')
  }

  if (hints.length > 0) payload.hint = hints
  if (process.env.NODE_ENV !== 'production' && error instanceof Error) {
    payload.meta = { ...(payload.meta || {}), stack: error.stack }
  }

  return payload
}

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const archived = searchParams.get('archived') === 'true'
  const all = searchParams.get('all') === 'true'
  const cutoffParam = searchParams.get('cutoff')
  const now = new Date()
  
  // Use client-provided cutoff date if available, otherwise server-side start of day
  let cutoffDate: Date
  if (cutoffParam) {
    cutoffDate = new Date(cutoffParam)
    console.log('[API] Using client cutoff:', cutoffDate.toISOString())
  } else {
    cutoffDate = new Date(now)
    cutoffDate.setHours(0, 0, 0, 0)
    console.log('[API] Using server cutoff:', cutoffDate.toISOString())
  }

  let currentUserAgencyId: string | null = null
  if (session.user.role !== 'ADMIN') {
    // Fetch user to ensure we have the latest agency association
    try {
      if (session.user.id) {
        const user = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { agencyId: true }
        })
        currentUserAgencyId = user?.agencyId || null
      }
    } catch (e) {
      console.error('Error fetching user agency:', e)
    }
  }


  const whereClause: any = {}
  
  if (id) {
    whereClause.id = id
  } else if (!all) {
    if (archived) {
      whereClause.endDate = { lt: cutoffDate }
    } else {
      whereClause.OR = [
        { endDate: { gte: cutoffDate } },
        { endDate: null }
      ]
    }
  }

  console.log('[API] Excursions Query:', { 
    id, 
    archived, 
    all, 
    cutoff: cutoffDate.toISOString(),
    whereClause: JSON.stringify(whereClause) 
  })

  try {
    const excursionsData = await prisma.excursion.findMany({
      where: whereClause,
      orderBy: { startDate: 'asc' },
      include: {
        priceTiers: {
          orderBy: { sortOrder: 'asc' }
        },
        agencyCommissions: {
          include: {
            agency: true
          }
        },
        participants: {
          where: { paymentType: { not: 'REFUNDED' } },
          select: { 
            adults: true,
            children: true,
            infants: true,
            paidAmount: true,
            paymentType: true,
            paymentStatus: true,
          }
        }
      }
    })

    console.log(`[API] Found ${excursionsData.length} excursions matching criteria`)

    const excursions = excursionsData.map(excursion => {
      const totalParticipants = excursion.participants
        .filter(p => {
          if (!excursion.confirmationDeadline) return true
          if (p.paymentType === 'BALANCE') return true
          return now <= excursion.confirmationDeadline
        })
        .reduce((sum, p) => sum + ((p.adults || 0) + (p.children || 0) + (p.infants || 0)), 0)
      
      // Calculate total collected (sum of deposits/paid amounts)
      // Note: paidAmount field holds the actual paid amount (whether it's deposit or full balance)
      const totalCollected = excursion.participants
        .filter(p => p.paymentStatus !== 'PENDING_APPROVAL' && p.paymentStatus !== 'REJECTED')
        .reduce((sum, p) => {
          const val = typeof p.paidAmount === 'number' ? p.paidAmount : Number(p.paidAmount)
          return sum + (isNaN(val) ? 0 : val)
        }, 0)

      const { participants, agencyCommissions, ...rest } = excursion
      
      const result: any = {
        ...rest,
        _count: {
          participants: totalParticipants
        }
      }

      // Map commissions based on role
      if (session?.user?.role === 'ADMIN') {
        result.totalCollected = totalCollected
        result.commissions = agencyCommissions || []
      } else {
        // Filter commissions for non-admins
        if (currentUserAgencyId && Array.isArray(agencyCommissions)) {
          result.commissions = agencyCommissions.filter((c: any) => c.agencyId === currentUserAgencyId)
        } else {
          result.commissions = []
        }
      }
      
      return result
    })

    return NextResponse.json(excursions)
  } catch (error: any) {
    console.error('Error fetching excursions:', error)
    return NextResponse.json(buildApiErrorPayload(error, 'Errore durante il recupero delle escursioni'), { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const body = await request.json()
    const { name, startDate, endDate, confirmationDeadline, commissions, recurrence, priceAdult, priceChild, priceTiers, transferDepartureLocation, transferDestinationLocation, transferTime, maxParticipants } = body

    // Validation - All fields are optional per user request
    // if (!startDate) {
    //   return NextResponse.json({ error: 'La data di inizio è obbligatoria.' }, { status: 400 })
    // }

    const start = startDate ? new Date(startDate) : null
    const end = endDate ? new Date(endDate) : null
    const deadline = confirmationDeadline ? new Date(confirmationDeadline) : null
    if (start && isNaN(start.getTime())) {
      return NextResponse.json({ error: 'Data/Ora di inizio non valida. Controlla anno, mese e giorno.' }, { status: 400 })
    }
    if (end && isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Data/Ora di fine non valida. Controlla anno, mese e giorno.' }, { status: 400 })
    }
    if (deadline && isNaN(deadline.getTime())) {
      return NextResponse.json({ error: 'Data limite non valida. Controlla anno, mese e giorno.' }, { status: 400 })
    }

    if (start && end && end < start) {
      return NextResponse.json({ error: 'La data di fine non può essere precedente alla data di inizio.' }, { status: 400 })
    }
    if (start && deadline && deadline > start) {
      return NextResponse.json({ error: 'La data di scadenza non può essere successiva alla data di inizio.' }, { status: 400 })
    }

    // Calculate durations for recurrence
    const duration = (start && end) ? end.getTime() - start.getTime() : 0
    const deadlineLead = (start && deadline) ? start.getTime() - deadline.getTime() : 0

    const createExcursion = async (s: Date | null, e: Date | null, d: Date | null) => {
      const tiers = Array.isArray(priceTiers) ? priceTiers : null
      const tiersToCreate =
        tiers && tiers.length > 0
          ? tiers
              .map((t: any, idx: number) => ({
                label: String(t?.label || '').trim(),
                price: parseFloat(String(t?.price || 0)) || 0,
                sortOrder: typeof t?.sortOrder === 'number' ? t.sortOrder : idx,
              }))
              .filter((t: any) => !!t.label)
          : [
              { label: 'Adulti', price: priceAdult ? parseFloat(priceAdult) : 0, sortOrder: 0 },
              { label: 'Bambini', price: priceChild ? parseFloat(priceChild) : 0, sortOrder: 1 },
            ]

      return await prisma.excursion.create({
        data: {
          name: name || undefined,
          startDate: s,
          endDate: e,
          confirmationDeadline: d,
          priceAdult: priceAdult ? parseFloat(priceAdult) : 0,
          priceChild: priceChild ? parseFloat(priceChild) : 0,
          maxParticipants: maxParticipants ? parseInt(maxParticipants) : null,
          transferDepartureLocation,
          transferDestinationLocation,
          transferTime,
          ...(tiersToCreate.length > 0 ? { priceTiers: { create: tiersToCreate } } : {}),
          agencyCommissions: commissions ? {
            create: commissions
              .map((c: any) => ({
                agencyId: c.agencyId,
                commissionPercentage: parseFloat(c.percentage),
                commissionType: c.commissionType || 'PERCENTAGE'
              }))
              .filter((c: any) => !isNaN(c.commissionPercentage))
          } : undefined
        }
      })
    }

    const createdExcursions = []

    if (recurrence && recurrence.endDate && start) {
      const recEnd = new Date(recurrence.endDate)
      recEnd.setHours(23, 59, 59, 999)

      let current = new Date(start)
      
      // Safety limit to prevent infinite loops or massive creation
      let count = 0
      const MAX_EXCURSIONS = 365 

      while (current <= recEnd && count < MAX_EXCURSIONS) {
        let shouldCreate = true
        
        if (recurrence.frequency === 'WEEKLY' && recurrence.days && recurrence.days.length > 0) {
          // recurrence.days might be strings if coming from JSON, ensure they are numbers
          const targetDays = recurrence.days.map((d: any) => Number(d))
          if (!targetDays.includes(current.getDay())) {
            shouldCreate = false
          }
        }

        if (shouldCreate) {
          const newStart = new Date(current)
          const newEnd = end ? new Date(newStart.getTime() + duration) : null
          const newDeadline = deadline ? new Date(newStart.getTime() - deadlineLead) : null
          
          createdExcursions.push(await createExcursion(newStart, newEnd, newDeadline))
          count++
        }

        // Increment 1 day
        current.setDate(current.getDate() + 1)
      }
    } else {
      // Single creation
      createdExcursions.push(await createExcursion(start, end, deadline))
    }

    // Automatically add to templates if it doesn't exist
    try {
      await prisma.excursionTemplate.upsert({
        where: { name },
        update: {},
        create: { name }
      })
    } catch (error) {
      console.error('Failed to auto-save template:', error)
    }

    if (createdExcursions.length > 0) {
      await createAuditLog(
        session.user.id,
        'CREATE_EXCURSION',
        'EXCURSION',
        createdExcursions[0].id,
        `Creata escursione "${name}" ${createdExcursions.length > 1 ? `(e altre ${createdExcursions.length - 1} ricorrenze)` : ''}`,
        createdExcursions[0].id
      )
      return NextResponse.json(createdExcursions[0])
    } else {
      return NextResponse.json({ error: 'Nessuna escursione creata con i criteri selezionati.' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error creating excursion:', error)
    return NextResponse.json(buildApiErrorPayload(error, 'Errore durante la creazione dell\'escursione'), { status: 500 })
  }
}

export async function PUT(request: Request) {
  const session = await getSession()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const body = await request.json()
  const { id, name, startDate, endDate, confirmationDeadline, commissions, recurrence, priceAdult, priceChild, priceTiers, transferDepartureLocation, transferDestinationLocation, transferTime, maxParticipants } = body

  // Validation
  const start = startDate ? new Date(startDate) : undefined
  const end = endDate ? new Date(endDate) : null
  const deadline = confirmationDeadline ? new Date(confirmationDeadline) : null
  if (start && isNaN(start.getTime())) {
    return NextResponse.json({ error: 'Data/Ora di inizio non valida. Controlla anno, mese e giorno.' }, { status: 400 })
  }
  if (end && isNaN(end.getTime())) {
    return NextResponse.json({ error: 'Data/Ora di fine non valida. Controlla anno, mese e giorno.' }, { status: 400 })
  }
  if (deadline && isNaN(deadline.getTime())) {
    return NextResponse.json({ error: 'Data limite non valida. Controlla anno, mese e giorno.' }, { status: 400 })
  }

  if (start && end && end < start) {
    return NextResponse.json({ error: 'La data di fine non può essere precedente alla data di inizio.' }, { status: 400 })
  }
  if (start && deadline && deadline > start) {
    return NextResponse.json({ error: 'La data di scadenza non può essere successiva alla data di inizio.' }, { status: 400 })
  }

  const tiersUpdate =
    Array.isArray(priceTiers)
      ? {
          deleteMany: {},
          create: priceTiers
            .map((t: any, idx: number) => ({
              label: String(t?.label || '').trim(),
              price: parseFloat(String(t?.price || 0)) || 0,
              sortOrder: typeof t?.sortOrder === 'number' ? t.sortOrder : idx,
            }))
            .filter((t: any) => !!t.label)
        }
      : undefined

  const excursion = await prisma.excursion.update({
    where: { id },
    data: {
      name: name || undefined,
      startDate: start,
      endDate: end,
      confirmationDeadline: deadline,
      priceAdult: priceAdult !== undefined ? parseFloat(priceAdult) : undefined,
      priceChild: priceChild !== undefined ? parseFloat(priceChild) : undefined,
      maxParticipants: maxParticipants ? parseInt(maxParticipants) : null,
      transferDepartureLocation,
      transferDestinationLocation,
      transferTime,
      priceTiers: tiersUpdate,
      agencyCommissions: commissions ? {
        deleteMany: {},
        create: commissions
          .map((c: any) => ({
            agencyId: c.agencyId,
            commissionPercentage: parseFloat(c.percentage),
            commissionType: c.commissionType || 'PERCENTAGE'
          }))
          .filter((c: any) => !isNaN(c.commissionPercentage))
      } : undefined
    }
  })

  // Handle Recurrence in Edit
  if (recurrence && recurrence.endDate) {
    const start = startDate ? new Date(startDate) : excursion.startDate
    const end = endDate ? new Date(endDate) : excursion.endDate
    const deadline = confirmationDeadline ? new Date(confirmationDeadline) : excursion.confirmationDeadline

    if (!start) {
        return NextResponse.json({ error: 'La data di inizio è obbligatoria per creare ricorrenze.' }, { status: 400 })
    }

    const duration = end ? end.getTime() - start.getTime() : 0
    const deadlineLead = deadline ? start.getTime() - deadline.getTime() : 0

    const createExcursion = async (s: Date, e: Date | null, d: Date | null) => {
      const tiers = Array.isArray(priceTiers) ? priceTiers : null
      const tiersToCreate =
        tiers && tiers.length > 0
          ? tiers
              .map((t: any, idx: number) => ({
                label: String(t?.label || '').trim(),
                price: parseFloat(String(t?.price || 0)) || 0,
                sortOrder: typeof t?.sortOrder === 'number' ? t.sortOrder : idx,
              }))
              .filter((t: any) => !!t.label)
          : [
              { label: 'Adulti', price: priceAdult !== undefined ? parseFloat(priceAdult) : (excursion.priceAdult || 0), sortOrder: 0 },
              { label: 'Bambini', price: priceChild !== undefined ? parseFloat(priceChild) : (excursion.priceChild || 0), sortOrder: 1 },
            ]

      return await prisma.excursion.create({
        data: {
          name,
          startDate: s,
          endDate: e,
          confirmationDeadline: d,
          priceAdult: priceAdult !== undefined ? parseFloat(priceAdult) : excursion.priceAdult,
          priceChild: priceChild !== undefined ? parseFloat(priceChild) : excursion.priceChild,
          transferDepartureLocation,
          transferDestinationLocation,
          transferTime,
          priceTiers: { create: tiersToCreate },
          agencyCommissions: commissions ? {
            create: commissions
              .map((c: any) => ({
                agencyId: c.agencyId,
                commissionPercentage: parseFloat(c.percentage)
              }))
              .filter((c: any) => !isNaN(c.commissionPercentage))
          } : undefined
        }
      })
    }

    const recEnd = new Date(recurrence.endDate)
    if (isNaN(recEnd.getTime())) {
      return NextResponse.json({ error: 'Data fine ricorrenza non valida. Controlla anno, mese e giorno.' }, { status: 400 })
    }
    recEnd.setHours(23, 59, 59, 999)

    let current = new Date(start)
    current.setDate(current.getDate() + 1) // Start from NEXT day

    let count = 0
    const MAX_EXCURSIONS = 365
    const createdExcursions = []

    while (current <= recEnd && count < MAX_EXCURSIONS) {
      let shouldCreate = true
      
      if (recurrence.frequency === 'WEEKLY' && recurrence.days && recurrence.days.length > 0) {
        const targetDays = recurrence.days.map((d: any) => Number(d))
        if (!targetDays.includes(current.getDay())) {
          shouldCreate = false
        }
      }

      if (shouldCreate) {
        const newStart = new Date(current)
        const newEnd = end ? new Date(newStart.getTime() + duration) : null
        const newDeadline = deadline ? new Date(newStart.getTime() - deadlineLead) : null
        
        createdExcursions.push(await createExcursion(newStart, newEnd, newDeadline))
        count++
      }

      current.setDate(current.getDate() + 1)
    }

      if (createdExcursions.length > 0) {
        await createAuditLog(
          session.user.id,
          'UPDATE_EXCURSION',
          'EXCURSION',
          excursion.id,
          `Modificata escursione "${name}" e create ${createdExcursions.length} ricorrenze future`,
          excursion.id
        )
      return NextResponse.json(excursion)
    }
  }


  await createAuditLog(
    session.user.id,
    'UPDATE_EXCURSION',
    'EXCURSION',
    excursion.id,
    `Modificata escursione "${name}"`,
    excursion.id
  )

  return NextResponse.json(excursion)
}

export async function DELETE(request: Request) {
  const session = await getSession()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const archived = searchParams.get('archived') === 'true'
  const active = searchParams.get('active') === 'true'

  // Try to parse body for bulk IDs
  let bodyIds: string[] = []
  try {
    const body = await request.json()
    if (body.ids && Array.isArray(body.ids)) {
      bodyIds = body.ids
    }
  } catch (e) {
    // No body or invalid json, ignore
  }

  if (bodyIds.length > 0) {
    // Check for participants in any of the selected excursions
    const participantCount = await prisma.participant.count({
      where: { excursionId: { in: bodyIds } }
    })

    if (participantCount > 0) {
      return NextResponse.json({ 
        error: 'Impossibile eliminare: una o più escursioni selezionate contengono partecipanti (attivi, rimborsati o sospesi).' 
      }, { status: 400 })
    }

    // Check for any activity logged on selected excursions (besides creation)
    const activityCount = await prisma.auditLog.count({
      where: {
        excursionId: { in: bodyIds },
        action: { not: 'CREATE_EXCURSION' }
      }
    })

    if (activityCount > 0) {
      return NextResponse.json({
        error: 'Impossibile eliminare: una o più escursioni selezionate hanno attività registrate (modifiche, partecipanti, rimborsi, ecc.).'
      }, { status: 400 })
    }

    // Bulk delete by IDs
    const result = await prisma.excursion.deleteMany({
      where: { id: { in: bodyIds } }
    })
    
    await createAuditLog(
      session.user.id,
      'DELETE_EXCURSION',
      'EXCURSION',
      'BULK',
      `Eliminate ${result.count} escursioni selezionate`
    )
    return NextResponse.json({ count: result.count })
  }

  if (active) {
    // Delete all active
    const now = new Date()
    const result = await prisma.excursion.deleteMany({
      where: {
        OR: [
          { endDate: { gte: now } },
          { endDate: null }
        ],
        participants: {
          none: {}
        },
        auditLogs: {
          none: {
            action: { not: 'CREATE_EXCURSION' }
          }
        }
      }
    })
    
    await createAuditLog(
      session.user.id,
      'DELETE_EXCURSION',
      'EXCURSION',
      'BULK_ACTIVE',
      `Eliminate tutte le ${result.count} escursioni attive`
    )
    return NextResponse.json({ count: result.count })
  }

  if (id) {
    // Delete single excursion
    const excursion = await prisma.excursion.findUnique({
      where: { id },
      include: {
        participants: true,
        auditLogs: {
          select: { action: true }
        }
      }
    })

    if (!excursion) {
      return NextResponse.json({ error: 'Escursione non trovata' }, { status: 404 })
    }

    if (excursion.participants.length > 0) {
      return NextResponse.json({
        error: 'Impossibile eliminare: questa escursione contiene partecipanti (attivi, rimborsati o sospesi).'
      }, { status: 400 })
    }

    const hasActivity = excursion.auditLogs.some(log => log.action !== 'CREATE_EXCURSION')

    if (hasActivity) {
      return NextResponse.json({
        error: 'Impossibile eliminare: su questa escursione sono state registrate operazioni (modifiche, partecipanti, rimborsi, ecc.).'
      }, { status: 400 })
    }

    await prisma.excursion.delete({
      where: { id }
    })

    await createAuditLog(
      session.user.id,
      'DELETE_EXCURSION',
      'EXCURSION',
      id,
      `Eliminata escursione "${excursion.name}"`,
      id
    )

    return NextResponse.json({ success: true })
  } else if (archived) {
    // Clear archive
    const now = new Date()

    const result = await prisma.excursion.deleteMany({
      where: {
        endDate: { lt: now },
        participants: {
          none: {}
        },
        auditLogs: {
          none: {
            action: { not: 'CREATE_EXCURSION' }
          }
        }
      }
    })

    // We can't log individual deletions easily here without fetching first.
    // Let's just return success.
    
    // Maybe log a generic system event? 
    // createAuditLog requires excursionId. If I don't have one, I can't log it easily with current function.
    
    return NextResponse.json({ count: result.count })
  }

  return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 })
}
