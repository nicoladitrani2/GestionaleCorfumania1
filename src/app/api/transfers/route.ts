import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import { sendMail } from '@/lib/mailer'

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

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const archived = searchParams.get('archived') === 'true'
    const pending = searchParams.get('pending') === 'true'
    const rejected = searchParams.get('rejected') === 'true'
    const capacityPending = searchParams.get('capacityPending') === 'true'
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    let currentUserAgencyId: string | null = null
    if (session.user.role !== 'ADMIN') {
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
    } else {
      if (capacityPending) {
        whereClause.date = { gte: now }
        whereClause.approvalStatus = { not: 'REJECTED' }
        whereClause.capacityRequests = { some: { status: 'PENDING' } }
      } else if (pending) {
        whereClause.approvalStatus = 'PENDING'
      } else if (rejected) {
        whereClause.approvalStatus = 'REJECTED'
      } else if (archived) {
        whereClause.date = { lt: now }
        whereClause.approvalStatus = { not: 'REJECTED' }
      } else {
        whereClause.date = { gte: now }
        whereClause.approvalStatus = { not: 'REJECTED' }
      }
    }

    const transfersData = await prisma.transfer.findMany({
      where: whereClause,
      orderBy: { date: 'asc' },
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
          select: { 
            adults: true,
            children: true,
            infants: true,
            paidAmount: true,
            totalPrice: true,
            paymentType: true,
            paymentStatus: true
          }
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true
          }
        },
        approvedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        rejectedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        capacityRequests: {
          where: { status: 'PENDING' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            requestedBy: {
              select: { id: true, firstName: true, lastName: true, email: true, role: true }
            }
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

      const transferDate = transfer.date
      const transferDeadline = transfer.confirmationDeadline
      const isTransferInPast = transferDate < now

      transfer.participants.forEach(p => {
        // Escludi completamente partecipanti con pagamento in attesa di approvazione
        if (p.paymentStatus === 'PENDING_APPROVAL' || p.paymentStatus === 'REJECTED') return

        const size = (p.adults || 0) + (p.children || 0) + (p.infants || 0)
        const dep = typeof p.paidAmount === 'number' ? p.paidAmount : Number(p.paidAmount)
        const pr = typeof p.totalPrice === 'number' ? p.totalPrice : Number(p.totalPrice)
        const isOption = p.paymentType === 'OPTION'
        const isExpired = (() => {
          if (p.paymentType === 'REFUNDED') return false
          if (p.paymentType === 'BALANCE') return false
          if (!transferDeadline) {
            return isTransferInPast && (isOption || p.paymentType === 'DEPOSIT')
          }
          return now > transferDeadline && (isOption || p.paymentType === 'DEPOSIT')
        })()
        
        if (p.paymentType === 'REFUNDED') {
            countRefunded += size
        } else if (isOption) {
            countOption += size
            if (!isExpired) activeParticipants += size
        } else {
            // Real payments
            if (!isExpired) activeParticipants += size
            
            // Only count revenue if transfer is APPROVED
            if (transfer.approvalStatus === 'APPROVED') {
                totalCollected += (isNaN(dep) ? 0 : dep)
            }
            
            if (p.paymentType === 'BALANCE' || (dep >= pr && pr > 0)) {
                countPaid += size
            } else {
                countDeposit += size
            }
        }
      })

    const { id: transferId, participants, agencyCommissions, createdBy, capacityRequests, approvedBy, rejectedBy, ...rest } = transfer
    
    const result: any = {
      id: transferId,
      ...rest,
      _count: {
        participants: activeParticipants
      },
      stats: {
        paid: countPaid,
        deposit: countDeposit,
        refunded: countRefunded,
        option: countOption
      },
      createdBy,
      approvedBy,
      rejectedBy,
      pendingCapacityRequest: Array.isArray(capacityRequests) && capacityRequests.length > 0 ? capacityRequests[0] : null
    }

    if (session.user.role === 'ADMIN') {
      result.totalCollected = totalCollected
      result.commissions = agencyCommissions || []
    } else {
        if (currentUserAgencyId && Array.isArray(agencyCommissions)) {
            result.commissions = agencyCommissions.filter((c: any) => c.agencyId === currentUserAgencyId)
        } else {
            result.commissions = []
        }
    }

    return result
  })

    return NextResponse.json(transfers)
  } catch (error) {
    console.error('Error fetching transfers:', error)
    return NextResponse.json(buildApiErrorPayload(error, 'Errore durante il recupero dei trasferimenti'), { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name, date, supplier, pickupLocation, dropoffLocation, endDate, commissions, priceAdult, priceChild, priceTiers, confirmationDeadline, maxParticipants } = body

    if (!name || !date || !supplier) {
        return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 })
    }

    const startDate = new Date(date)
    if (isNaN(startDate.getTime())) {
      return NextResponse.json(
        { error: 'Data/Ora di partenza non valida. Controlla anno, mese e giorno.' },
        { status: 400 }
      )
    }
    const now = new Date()
    
    // Per coerenza con le escursioni:
    // - gli ADMIN possono creare trasferimenti anche con data nel passato
    // - per gli altri utenti blocchiamo date nel passato (con 5 minuti di tolleranza)
    if (session.user.role !== 'ADMIN') {
      if (startDate < new Date(now.getTime() - 5 * 60 * 1000)) {
        return NextResponse.json(
          { error: 'La data di partenza non può essere nel passato.' },
          { status: 400 }
        )
      }
    }

    if (endDate) {
      const end = new Date(endDate)
      if (isNaN(end.getTime())) {
        return NextResponse.json(
          { error: 'Data/Ora di arrivo non valida. Controlla anno, mese e giorno.' },
          { status: 400 }
        )
      }
      if (end < startDate) {
        return NextResponse.json({ error: 'La data di arrivo non può essere precedente alla data di partenza.' }, { status: 400 })
      }
    }

    if (confirmationDeadline) {
      const deadline = new Date(confirmationDeadline)
      if (isNaN(deadline.getTime())) {
        return NextResponse.json(
          { error: 'Data limite acconti non valida. Controlla anno, mese e giorno.' },
          { status: 400 }
        )
      }
      if (deadline > startDate) {
        return NextResponse.json(
          { error: 'La data limite non può essere successiva alla data di partenza.' },
          { status: 400 }
        )
      }
    }

    const parsedMaxParticipants =
      maxParticipants !== undefined && maxParticipants !== null && String(maxParticipants).trim() !== ''
        ? parseInt(String(maxParticipants), 10)
        : null

    if (session.user.role !== 'ADMIN') {
      if (!parsedMaxParticipants || !Number.isFinite(parsedMaxParticipants) || parsedMaxParticipants <= 0) {
        return NextResponse.json(
          { error: 'Inserisci il numero di partecipanti richiesto per questo trasferimento (necessario per l’approvazione).' },
          { status: 400 }
        )
      }
    }

    const approvalStatus = session.user.role === 'ADMIN' ? 'APPROVED' : 'PENDING'

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

    const transfer = await prisma.transfer.create({
      data: {
        name,
        date: new Date(date),
        endDate: endDate ? new Date(endDate) : undefined,
        confirmationDeadline: confirmationDeadline ? new Date(confirmationDeadline) : null,
        pickupLocation,
        dropoffLocation,
        supplier,
        priceAdult: priceAdult ? parseFloat(priceAdult) : 0,
        priceChild: priceChild ? parseFloat(priceChild) : 0,
        maxParticipants: parsedMaxParticipants,
        approvalStatus,
        createdById: session.user.id,
        priceTiers: {
          create: tiersToCreate
        },
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

    await createAuditLog(
      session.user.id,
      'CREATE_TRANSFER',
      'TRANSFER',
      transfer.id,
      `Creato trasferimento: ${name} (${supplier})`,
      undefined,
      transfer.id
    )

    if (approvalStatus === 'PENDING') {
      try {
        const admins = await prisma.user.findMany({
          where: { role: 'ADMIN' },
          select: { email: true },
        })
        const adminEmails = admins
          .map(a => a.email)
          .filter((e): e is string => typeof e === 'string' && e.trim().length > 0)

        const requester =
          `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || session.user.email || session.user.id
        const transferDate = transfer.date ? new Date(transfer.date).toLocaleString('it-IT') : ''
        const text = [
          'Nuovo trasferimento in attesa di approvazione.',
          `Nome: ${transfer.name}`,
          transferDate ? `Data: ${transferDate}` : '',
          `Fornitore: ${transfer.supplier || '-'}`,
          typeof transfer.maxParticipants === 'number' ? `Posti richiesti: ${transfer.maxParticipants}` : '',
          `Richiedente: ${requester}`,
          `ID: ${transfer.id}`,
        ].filter(Boolean).join('\n')

        let okCount = 0
        let failCount = 0
        for (const to of adminEmails) {
          try {
            await sendMail({
              to,
              subject: `Trasferimento da approvare: ${transfer.name}`,
              text,
            })
            okCount += 1
          } catch {
            failCount += 1
          }
        }

        await createAuditLog(
          session.user.id,
          'NOTIFY_ADMINS_TRANSFER_PENDING',
          'TRANSFER',
          transfer.id,
          `Notifica admin creazione trasferimento: ok=${okCount}, fail=${failCount}`,
          undefined,
          transfer.id
        )
      } catch (e: any) {
        try {
          await createAuditLog(
            session.user.id,
            'NOTIFY_ADMINS_TRANSFER_PENDING_FAILED',
            'TRANSFER',
            transfer.id,
            `Notifica admin creazione trasferimento fallita: ${e?.message || 'Errore sconosciuto'}`,
            undefined,
            transfer.id
          )
        } catch {}
      }
    }

    return NextResponse.json(transfer)
  } catch (error: any) {
    console.error('Error creating transfer:', error)
    return NextResponse.json(buildApiErrorPayload(error, 'Errore durante la creazione del trasferimento'), { status: 500 })
  }
}

export async function PUT(request: Request) {
  const session = await getSession()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { id, name, date, supplier, pickupLocation, dropoffLocation, returnPickupLocation, endDate, commissions, approvalStatus, priceAdult, priceChild, priceTiers, confirmationDeadline, maxParticipants, capacityRequestId, capacityDecision } = body

    if (capacityRequestId) {
      if (capacityDecision !== 'APPROVED' && capacityDecision !== 'REJECTED') {
        return NextResponse.json({ error: 'Decisione non valida' }, { status: 400 })
      }

      const req = await prisma.transferCapacityRequest.findUnique({
        where: { id: String(capacityRequestId) },
        include: {
          transfer: {
            select: { id: true, name: true, date: true, supplier: true, maxParticipants: true }
          },
          requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } }
        }
      })

      if (!req) return NextResponse.json({ error: 'Richiesta non trovata' }, { status: 404 })
      if (req.status !== 'PENDING') {
        return NextResponse.json({ error: 'Richiesta già gestita' }, { status: 400 })
      }

      const decidedAt = new Date()
      const updatedRequest = await prisma.transferCapacityRequest.update({
        where: { id: req.id },
        data: {
          status: capacityDecision,
          decidedById: session.user.id,
          decidedAt
        }
      })

      if (capacityDecision === 'APPROVED') {
        await prisma.transfer.update({
          where: { id: req.transferId },
          data: {
            maxParticipants: req.requestedMaxParticipants
          }
        })
      }

      await createAuditLog(
        session.user.id,
        capacityDecision === 'APPROVED' ? 'APPROVE_TRANSFER_CAPACITY' : 'REJECT_TRANSFER_CAPACITY',
        'TRANSFER',
        req.transferId,
        `Gestita richiesta posti: ${capacityDecision} (richiesti=${req.requestedMaxParticipants})`,
        undefined,
        req.transferId
      )

      return NextResponse.json({
        success: true,
        request: updatedRequest,
        transferId: req.transferId,
        requestedMaxParticipants: req.requestedMaxParticipants,
        decision: capacityDecision
      })
    }

    if (!id) return NextResponse.json({ error: 'ID mancante' }, { status: 400 })

    const existing = await prisma.transfer.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        date: true,
        approvalStatus: true,
        createdBy: { select: { email: true, firstName: true, lastName: true } },
      },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (date) {
      const start = new Date(date)
      if (isNaN(start.getTime())) {
        return NextResponse.json(
          { error: 'Data/Ora di partenza non valida. Controlla anno, mese e giorno.' },
          { status: 400 }
        )
      }

      if (endDate) {
        const end = new Date(endDate)
        if (isNaN(end.getTime())) {
          return NextResponse.json(
            { error: 'Data/Ora di arrivo non valida. Controlla anno, mese e giorno.' },
            { status: 400 }
          )
        }
        if (end < start) {
          return NextResponse.json({ error: 'La data di arrivo non può essere precedente alla data di partenza.' }, { status: 400 })
        }
      }

      if (confirmationDeadline) {
        const deadline = new Date(confirmationDeadline)
        if (isNaN(deadline.getTime())) {
          return NextResponse.json(
            { error: 'Data limite acconti non valida. Controlla anno, mese e giorno.' },
            { status: 400 }
          )
        }
        if (deadline > start) {
          return NextResponse.json(
            { error: 'La data limite non può essere successiva alla data di partenza.' },
            { status: 400 }
          )
        }
      }
    } else {
      if (endDate || confirmationDeadline) {
        return NextResponse.json(
          { error: 'Inserisci la data/ora di partenza prima di impostare arrivo o data limite.' },
          { status: 400 }
        )
      }
    }

    const updateData: any = {
      name,
      date: date ? new Date(date) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      confirmationDeadline: confirmationDeadline ? new Date(confirmationDeadline) : undefined,
      pickupLocation,
      dropoffLocation,
      returnPickupLocation,
      supplier,
      maxParticipants: maxParticipants ? parseInt(maxParticipants) : null
    }

    if (typeof approvalStatus === 'string') {
      updateData.approvalStatus = approvalStatus
      if (approvalStatus === 'APPROVED') {
        updateData.approvedById = session.user.id
        updateData.approvedAt = new Date()
        updateData.rejectedById = null
        updateData.rejectedAt = null
      } else if (approvalStatus === 'REJECTED') {
        updateData.rejectedById = session.user.id
        updateData.rejectedAt = new Date()
      }
    }

    if (priceAdult !== undefined) {
      updateData.priceAdult = parseFloat(priceAdult)
    }
    if (priceChild !== undefined) {
      updateData.priceChild = parseFloat(priceChild)
    }

    if (commissions) {
        updateData.agencyCommissions = {
            deleteMany: {},
            create: commissions
              .map((c: any) => ({
                agencyId: c.agencyId,
                commissionPercentage: parseFloat(c.percentage),
                commissionType: c.commissionType || 'PERCENTAGE'
              }))
              .filter((c: any) => !isNaN(c.commissionPercentage))
        }
    }

    if (Array.isArray(priceTiers)) {
      updateData.priceTiers = {
        deleteMany: {},
        create: priceTiers
          .map((t: any, idx: number) => ({
            label: String(t?.label || '').trim(),
            price: parseFloat(String(t?.price || 0)) || 0,
            sortOrder: typeof t?.sortOrder === 'number' ? t.sortOrder : idx,
          }))
          .filter((t: any) => !!t.label)
      }
    }

    const transfer = await prisma.transfer.update({
      where: { id },
      data: updateData,
      include: {
        priceTiers: { orderBy: { sortOrder: 'asc' } },
        agencyCommissions: { include: { agency: true } },
      }
    })

    await createAuditLog(
      session.user.id,
      'UPDATE_TRANSFER',
      'TRANSFER',
      transfer.id,
      `Modificato trasferimento: ${name}`,
      undefined,
      transfer.id
    )

    if (
      typeof approvalStatus === 'string' &&
      existing.approvalStatus !== transfer.approvalStatus &&
      (transfer.approvalStatus === 'APPROVED' || transfer.approvalStatus === 'REJECTED') &&
      existing.createdBy?.email
    ) {
      const createdByName =
        `${existing.createdBy.firstName || ''} ${existing.createdBy.lastName || ''}`.trim() || 'Utente'
      const transferName = transfer.name || existing.name || 'Trasferimento'
      const transferDate = transfer.date ? new Date(transfer.date).toLocaleString('it-IT') : ''

      const subject =
        transfer.approvalStatus === 'APPROVED'
          ? `Trasferimento approvato: ${transferName}`
          : `Trasferimento rifiutato: ${transferName}`

      const text =
        transfer.approvalStatus === 'APPROVED'
          ? `Ciao ${createdByName},\n\nil trasferimento "${transferName}" (${transferDate}) è stato approvato.\n\nPrezzi:\n- Adulti: €${(typeof transfer.priceAdult === 'number' ? transfer.priceAdult : 0).toFixed(2)}\n- Bambini: €${(typeof transfer.priceChild === 'number' ? transfer.priceChild : 0).toFixed(2)}\n\nPuoi procedere con le prenotazioni.\n\nCorfumania`
          : `Ciao ${createdByName},\n\nil trasferimento "${transferName}" (${transferDate}) è stato rifiutato.\n\nCorfumania`

      try {
        await sendMail({
          to: existing.createdBy.email,
          subject,
          text,
        })
        await createAuditLog(
          session.user.id,
          'SEND_TRANSFER_APPROVAL_EMAIL',
          'TRANSFER',
          transfer.id,
          `Inviata email approvazione trasferimento a ${existing.createdBy.email}`,
          undefined,
          transfer.id
        )
      } catch (e: any) {
        await createAuditLog(
          session.user.id,
          'SEND_TRANSFER_APPROVAL_EMAIL_FAILED',
          'TRANSFER',
          transfer.id,
          `Invio email approvazione trasferimento fallito: ${e?.message || 'Errore sconosciuto'}`,
          undefined,
          transfer.id
        )
      }
    }

    return NextResponse.json(transfer)
  } catch (error: any) {
    console.error('Error updating transfer:', error)
    return NextResponse.json(
      { error: error?.message || 'Errore durante l\'aggiornamento' },
      { status: 500 }
    )
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
        // Check for participants
        const participantCount = await prisma.participant.count({
            where: { transferId: id }
        })

        if (participantCount > 0) {
            return NextResponse.json({ 
                error: 'Impossibile eliminare il trasferimento: sono presenti partecipanti (attivi, rimborsati o sospesi).' 
            }, { status: 400 })
        }

        await prisma.transfer.delete({ where: { id } })
        
        await createAuditLog(
          session.user.id,
          'DELETE_TRANSFER',
          'TRANSFER',
          id,
          `Eliminato trasferimento: ${transfer.name}`,
          undefined,
          id
        )
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting transfer:', error)
    return NextResponse.json(buildApiErrorPayload(error, 'Errore durante l\'eliminazione del trasferimento'), { status: 500 })
  }
}
