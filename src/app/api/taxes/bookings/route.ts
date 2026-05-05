import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { addRateLimitHeaders, getClientIp, rateLimit } from '@/lib/rateLimit'
import { enforceSameOrigin } from '@/lib/csrf'

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session || !session.user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Filter for non-admins
    const whereClause: any = {}
    if (session.user.role !== 'ADMIN') {
      const u = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { isSpecialAssistant: true },
      })
      if (!u?.isSpecialAssistant) {
        whereClause.assignedToId = session.user.id
      }
    }

    const bookings = await prisma.taxBooking.findMany({
      where: whereClause,
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        week: 'asc' // Sort by week by default
      }
    })

    return NextResponse.json(bookings)
  } catch (error) {
    console.error('Error fetching tax bookings:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session || !session.user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }
    const actor =
      session.user.role === 'ADMIN'
        ? { canImport: true, key: `admin:${session.user.id}` }
        : await (async () => {
            const u = await prisma.user.findUnique({
              where: { id: session.user.id },
              select: { isSpecialAssistant: true },
            })
            const can = Boolean(u?.isSpecialAssistant)
            return { canImport: can, key: `special:${session.user.id}` }
          })()

    if (!actor.canImport) return new NextResponse('Forbidden', { status: 403 })

    const csrf = enforceSameOrigin(request)
    if (csrf) return csrf

    const ip = getClientIp(request)
    const rl = rateLimit(`tax-bookings:post:ip:${ip}:${actor.key}`, 120, 10 * 60 * 1000)
    if (!rl.allowed) {
      return addRateLimitHeaders(new NextResponse('Too Many Requests', { status: 429 }), rl, 120)
    }

    let body: any = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }
    const { bookings } = body

    if (!Array.isArray(bookings)) {
      return new NextResponse('Invalid data format', { status: 400 })
    }

    // Process bookings
    // We use transaction to ensure data integrity
    const results: any[] = []
    
    // Using transaction for atomic operations but processing one by one to check state
    await prisma.$transaction(async (tx) => {
        for (const b of bookings) {
            // Validate required fields
            if (!b.nFile || !b.week) {
                continue
            }

            // Ensure types are correct for Prisma
            const nFileStr = String(b.nFile)
            const weekStr = String(b.week)
            const paxInt = parseInt(String(b.pax || 0), 10)
            const serviceCodeInt = parseInt(String(b.serviceCode || 0), 10)
            let totalAmountFloat = parseFloat(String(b.totalAmount || 0))
            const importBatchId = b.importBatchId ? String(b.importBatchId) : null

            // 1. Check if exists
            const existing = await tx.taxBooking.findFirst({
                where: {
                    nFile: nFileStr,
                    week: weekStr,
                    serviceCode: serviceCodeInt
                }
            })

            if (existing) {
                // 2. Check if "locked" (assigned or paid)
                // User requirement: "dati che sono stati già usati, assegnati e pagati non devono essere sovrasritti"
                const isLocked =
                  existing.serviceCode === 4
                    ? (existing.customerPaid || existing.adminPaid || existing.depositStatus !== 'PENDING')
                    : (!!existing.assignedToId || existing.customerPaid || existing.adminPaid)
                
                if (isLocked) {
                    // SKIP update
                    results.push(existing)
                    continue
                }

                const rawForSource = String(b.rawData || existing.rawData || '{}')
                let importSource = ''
                try {
                    const parsed = JSON.parse(rawForSource || '{}')
                    importSource = String(parsed?.importSource || '')
                } catch {
                    importSource = ''
                }

                if (importSource === 'EXCEL' && serviceCodeInt === 4) {
                  totalAmountFloat = Math.max(0, paxInt) * 50
                }

                const shouldClearAssignedTo =
                  importSource === 'EXCEL' &&
                  existing.assignedToId === session.user.id &&
                  !existing.customerPaid &&
                  !existing.adminPaid &&
                  (existing.serviceCode !== 4 || String(existing.depositStatus || 'PENDING').toUpperCase() === 'PENDING')

                if (importSource === 'EXCEL' && importBatchId) {
                    const snapshot = JSON.stringify({
                        provenienza: existing.provenienza,
                        serviceCode: existing.serviceCode,
                        pax: existing.pax,
                        leadName: existing.leadName,
                        room: existing.room,
                        totalAmount: existing.totalAmount,
                        assignedToId: existing.assignedToId,
                        customerPaid: existing.customerPaid,
                        adminPaid: existing.adminPaid,
                        rawData: existing.rawData,
                        depositStatus: existing.depositStatus,
                        depositProcessedAt: existing.depositProcessedAt ? existing.depositProcessedAt.toISOString() : null,
                    })

                    await tx.taxBookingBackup.upsert({
                        where: { taxBookingId_batchId: { taxBookingId: existing.id, batchId: importBatchId } },
                        create: {
                            taxBookingId: existing.id,
                            batchId: importBatchId,
                            prevImportBatchId: existing.importBatchId,
                            snapshot,
                        },
                        update: {},
                    })
                }

                // 3. Update if not locked
                const updated = await tx.taxBooking.update({
                    where: { id: existing.id },
                    data: {
                        provenienza: String(b.provenienza || ''),
                        serviceCode: serviceCodeInt,
                        pax: paxInt,
                        leadName: String(b.leadName || ''),
                        room: b.room ? String(b.room) : null,
                        totalAmount: totalAmountFloat,
                        rawData: String(b.rawData || '{}'),
                        depositStatus: String(b.depositStatus || existing.depositStatus || 'PENDING'),
                        depositProcessedAt: b.depositProcessedAt ? new Date(String(b.depositProcessedAt)) : existing.depositProcessedAt,
                        importBatchId: importSource === 'EXCEL' ? importBatchId : existing.importBatchId,
                        ...(shouldClearAssignedTo ? { assignedToId: null } : {})
                    }
                })
                results.push(updated)
            } else {
                // 4. Create new
                const rawForSource = String(b.rawData || '{}')
                try {
                  const parsed = JSON.parse(rawForSource || '{}')
                  const importSource = String(parsed?.importSource || '')
                  if (importSource === 'EXCEL' && serviceCodeInt === 4) {
                    totalAmountFloat = Math.max(0, paxInt) * 50
                  }
                } catch {
                }
                const created = await tx.taxBooking.create({
                    data: {
                        nFile: nFileStr,
                        week: weekStr,
                        provenienza: String(b.provenienza || ''),
                        serviceCode: serviceCodeInt,
                        pax: paxInt,
                        leadName: String(b.leadName || ''),
                        room: b.room ? String(b.room) : null,
                        totalAmount: totalAmountFloat,
                        customerPaid: b.customerPaid === true,
                        assignedToId: null,
                        rawData: String(b.rawData || '{}'),
                        depositStatus: String(b.depositStatus || 'PENDING'),
                        depositProcessedAt: b.depositProcessedAt ? new Date(String(b.depositProcessedAt)) : null,
                        importBatchId
                    }
                })
                results.push(created)
            }

            if (serviceCodeInt !== 4) {
                const raw = String(b.rawData || '{}')
                let importSource = ''
                try {
                    const parsed = JSON.parse(raw || '{}')
                    importSource = String(parsed?.importSource || '')
                } catch {
                    importSource = ''
                }

                if (importSource !== 'EXCEL') {
                    continue
                }
                if (!importBatchId) {
                    continue
                }

                const existingDeposit = await tx.taxBooking.findFirst({
                    where: {
                        nFile: nFileStr,
                        week: weekStr,
                        serviceCode: 4
                    },
                    select: {
                        id: true,
                        pax: true,
                        totalAmount: true,
                        assignedToId: true,
                        customerPaid: true,
                        adminPaid: true,
                        depositStatus: true,
                        rawData: true,
                        importBatchId: true,
                    }
                })

                const depositTotal = Math.max(0, paxInt) * 50
                if (!existingDeposit) {
                    let depositRaw = '{}'
                    try {
                        const parsed = JSON.parse(raw || '{}')
                        depositRaw = JSON.stringify({
                            ...parsed,
                            depositAmountPerPax: 50,
                            depositAmountTotal: depositTotal,
                        })
                    } catch {
                        depositRaw = JSON.stringify({ depositAmountPerPax: 50, depositAmountTotal: depositTotal })
                    }

                    const existingAssignedToId = existing?.assignedToId || null

                    await tx.taxBooking.create({
                        data: {
                            nFile: nFileStr,
                            week: weekStr,
                            provenienza: String(b.provenienza || ''),
                            serviceCode: 4,
                            pax: paxInt,
                            leadName: String(b.leadName || ''),
                            room: b.room ? String(b.room) : null,
                            totalAmount: depositTotal,
                            assignedToId: existingAssignedToId,
                            rawData: depositRaw,
                            depositStatus: 'PENDING',
                            depositProcessedAt: null,
                            importBatchId
                        }
                    })
                } else {
                    const isLocked =
                      existingDeposit.customerPaid ||
                      existingDeposit.adminPaid ||
                      (existingDeposit.depositStatus && String(existingDeposit.depositStatus).toUpperCase() !== 'PENDING')

                    if (!isLocked) {
                        let nextRaw = String(existingDeposit.rawData || '{}')
                        try {
                            const parsed = JSON.parse(nextRaw || '{}')
                            nextRaw = JSON.stringify({
                                ...parsed,
                                depositAmountPerPax: 50,
                                depositAmountTotal: depositTotal,
                            })
                        } catch {
                            nextRaw = JSON.stringify({ depositAmountPerPax: 50, depositAmountTotal: depositTotal })
                        }

                        await tx.taxBooking.update({
                            where: { id: existingDeposit.id },
                            data: {
                                pax: paxInt,
                                totalAmount: depositTotal,
                                rawData: nextRaw,
                                importBatchId: existingDeposit.importBatchId || importBatchId,
                            }
                        })
                    }
                }
            }
        }
    }, {
        maxWait: 30000, // increased from 10000
        timeout: 120000  // increased from 20000 (2 mins) to handle large batches
    })

    return addRateLimitHeaders(NextResponse.json(results), rl, 120)
  } catch (error: any) {
    console.error('Error creating tax bookings:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession()
    if (!session || !session.user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const body = await request.json()
    const { id, ids, action, value } = body

    if ((!id && !ids) || !action) {
      return new NextResponse('Missing required fields', { status: 400 })
    }

    // Authorization check
    // Admin can do anything
    // Assistant can only update 'customerPaid' if assigned to them
    
    // Batch Update for Admin only
    if (ids && Array.isArray(ids)) {
        if (session.user.role !== 'ADMIN') {
            return new NextResponse('Forbidden: Batch update is admin only', { status: 403 })
        }

        if (action === 'assign') {
             const assignedToId = value === '' ? null : value
             await prisma.taxBooking.updateMany({
                 where: { id: { in: ids } },
                 data: { assignedToId }
             })
             return new NextResponse('Batch update success', { status: 200 })
        }
        
        return new NextResponse('Invalid batch action', { status: 400 })
    }

    // Single Update logic
    const booking = await prisma.taxBooking.findUnique({
        where: { id }
    })

    if (!booking) {
        return new NextResponse('Booking not found', { status: 404 })
    }

    if (session.user.role !== 'ADMIN') {
        // Check permissions for non-admin
        if (action === 'assign' || action === 'adminPaid' || action === 'depositStatus') {
             return new NextResponse('Forbidden', { status: 403 })
        }
        if (action === 'customerPaid') {
            if (booking.assignedToId !== session.user.id) {
                 return new NextResponse('Forbidden: You are not assigned to this booking', { status: 403 })
            }
        }
    }

    let updateData = {}
    
    switch (action) {
        case 'assign':
            updateData = { assignedToId: value === '' ? null : value }
            break
        case 'customerPaid':
            updateData = { customerPaid: Boolean(value) }
            break
        case 'adminPaid':
            updateData = { adminPaid: Boolean(value) }
            break
        case 'depositStatus': {
            const next = String(value || '')
            if (!['PENDING', 'RETURNED', 'RETAINED'].includes(next)) {
              return new NextResponse('Invalid deposit status', { status: 400 })
            }
            updateData = {
              depositStatus: next,
              depositProcessedAt: next === 'PENDING' ? null : new Date()
            }
            break
        }
        default:
            return new NextResponse('Invalid action', { status: 400 })
    }

    const updated = await prisma.taxBooking.update({
        where: { id },
        data: updateData,
        include: {
            assignedTo: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true
                }
            }
        }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating tax booking:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession()
    if (!session || !session.user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const deleteAll = searchParams.get('all') === 'true'

    if (!id && !deleteAll) {
      return new NextResponse('Missing ID or all=true', { status: 400 })
    }

    // Check if user is admin
    if (session.user.role !== 'ADMIN') {
        // Non-admins cannot bulk delete
        if (deleteAll) {
            return new NextResponse('Unauthorized', { status: 403 })
        }
        
        // Check if booking is assigned
        const booking = await prisma.taxBooking.findUnique({
            where: { id: id! },
            select: { assignedToId: true }
        })
        
        // Allow deletion if:
        // 1. It is unassigned (legacy/error)
        // 2. It is assigned to the current user (self-correction)
        if (booking?.assignedToId && booking.assignedToId !== session.user.id) {
            return new NextResponse('Non puoi eliminare una prenotazione assegnata ad altri.', { status: 403 })
        }
    }

    if (deleteAll) {
        // Delete all UNASSIGNED and UNPAID bookings
        // This is a safety measure to prevent accidental data loss of active work
        const result = await prisma.taxBooking.deleteMany({
            where: {
                assignedToId: null,
                customerPaid: false,
                adminPaid: false
            }
        })
        return new NextResponse(`Deleted ${result.count} bookings`, { status: 200 })
    }

    await prisma.taxBooking.delete({
      where: { id: id! }
    })

    return new NextResponse('Deleted', { status: 200 })
  } catch (error) {
    console.error('Error deleting tax booking:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
