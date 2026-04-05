import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import type { Prisma } from '@prisma/client'
import { createAuditLog } from '@/lib/audit'
import { addRateLimitHeaders, getClientIp, rateLimit } from '@/lib/rateLimit'
import { enforceSameOrigin } from '@/lib/csrf'

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session?.user) return new NextResponse('Unauthorized', { status: 401 })
    if (session.user.role !== 'ADMIN') return new NextResponse('Forbidden', { status: 403 })

    const csrf = enforceSameOrigin(request)
    if (csrf) return csrf

    const ip = getClientIp(request)
    const rl = rateLimit(`taxes:reset:ip:${ip}:admin:${session.user.id}`, 5, 60 * 60 * 1000)
    if (!rl.allowed) {
      return addRateLimitHeaders(new NextResponse('Too Many Requests', { status: 429 }), rl, 5)
    }

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.taxBookingBackup.deleteMany({})
      await tx.taxImportBatch.deleteMany({})
      const deletedBookings = await tx.taxBooking.deleteMany({})
      const deletedParticipants = await tx.participant.deleteMany({
        where: {
          specialServiceType: {
            in: ['BRACELET', 'CITY_TAX', 'AC'],
          },
        },
      })
      return { deletedBookings: deletedBookings.count, deletedParticipants: deletedParticipants.count }
    })

    await createAuditLog(
      session.user.id,
      'TAXES_RESET',
      'TAX',
      'ALL',
      `Reset tasse: deletedBookings=${result.deletedBookings}, deletedParticipants=${result.deletedParticipants}`
    )
    return addRateLimitHeaders(NextResponse.json({ success: true, ...result }), rl, 5)
  } catch (error) {
    console.error('Error resetting taxes:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

