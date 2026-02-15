import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { year } = await request.json()

    if (!year || typeof year !== 'number') {
      return NextResponse.json({ error: 'Anno non valido' }, { status: 400 })
    }

    const clients = await prisma.client.findMany({
      include: {
        participants: true
      }
    })

    const idsToReset = clients
      .filter((client) => {
        if (!client.participants || client.participants.length === 0) {
          return new Date(client.createdAt).getFullYear() === year
        }

        const dates = client.participants.map((p) => {
          let dateStr = p.createdAt as unknown as string
          if (p.excursionId && p.excursion?.startDate) {
            dateStr = p.excursion.startDate as unknown as string
          } else if (p.transferId && p.transfer?.date) {
            dateStr = p.transfer.date as unknown as string
          } else if (p.rentalId) {
            dateStr = p.createdAt as unknown as string
          }
          return new Date(dateStr).getTime()
        })

        const maxDate = Math.max(...dates)
        return new Date(maxDate).getFullYear() === year
      })
      .map((c) => c.id)

    if (idsToReset.length === 0) {
      return NextResponse.json({ success: true, updated: 0 })
    }

    const result = await prisma.client.updateMany({
      where: {
        id: { in: idsToReset }
      },
      data: {
        isManuallyContacted: false,
        lastEmailSentAt: null
      }
    })

    return NextResponse.json({ success: true, updated: result.count })
  } catch (error) {
    console.error('Error resetting client contact status:', error)
    return NextResponse.json({ error: 'Failed to reset client contact status' }, { status: 500 })
  }
}

