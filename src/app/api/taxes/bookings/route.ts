import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session || !session.user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Filter for non-admins
    const whereClause: any = {}
    if (session.user.role !== 'ADMIN') {
        whereClause.assignedToId = session.user.id
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

    const body = await request.json()
    const { bookings } = body

    if (!Array.isArray(bookings)) {
      return new NextResponse('Invalid data format', { status: 400 })
    }

    // Process bookings
    // We use transaction to ensure data integrity
    const results = []
    
    // Using transaction for atomic operations but processing one by one to check state
    await prisma.$transaction(async (tx) => {
        for (const b of bookings) {
            // Validate required fields
            if (!b.nFile || !b.week) {
                console.warn('Skipping booking with missing nFile or week:', b)
                continue
            }

            // Ensure types are correct for Prisma
            const nFileStr = String(b.nFile)
            const weekStr = String(b.week)
            const paxInt = parseInt(String(b.pax || 0), 10)
            const serviceCodeInt = parseInt(String(b.serviceCode || 0), 10)
            const totalAmountFloat = parseFloat(String(b.totalAmount || 0))

            // 1. Check if exists
            const existing = await tx.taxBooking.findUnique({
                where: {
                    nFile_week: {
                        nFile: nFileStr,
                        week: weekStr
                    }
                }
            })

            if (existing) {
                // 2. Check if "locked" (assigned or paid)
                // User requirement: "dati che sono stati già usati, assegnati e pagati non devono essere sovrasritti"
                const isLocked = existing.assignedToId || existing.customerPaid || existing.adminPaid
                
                if (isLocked) {
                    // SKIP update
                    results.push(existing)
                    continue
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
                        rawData: String(b.rawData || '{}')
                    }
                })
                results.push(updated)
            } else {
                // 4. Create new
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
                        assignedToId: session.user.id, // Assign to creator by default
                        rawData: String(b.rawData || '{}')
                    }
                })
                results.push(created)
            }
        }
    }, {
        maxWait: 30000, // increased from 10000
        timeout: 120000  // increased from 20000 (2 mins) to handle large batches
    })

    return NextResponse.json(results)
  } catch (error: any) {
    console.error('Error creating tax bookings:', error)
    // Return the actual error message for debugging
    return new NextResponse(`Internal Server Error: ${error.message}`, { status: 500 })
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
        if (action === 'assign' || action === 'adminPaid') {
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
