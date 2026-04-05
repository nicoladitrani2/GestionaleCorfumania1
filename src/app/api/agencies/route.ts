import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { addRateLimitHeaders, getClientIp, rateLimit } from '@/lib/rateLimit'

export async function GET() {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const agencies = await prisma.agency.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { users: true }
        }
      }
    })
    return NextResponse.json(agencies)
  } catch (error) {
    console.error('Error fetching agencies:', error)
    return NextResponse.json({ error: 'Errore nel recupero delle agenzie' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const ip = getClientIp(req)
  const rl = rateLimit(`agencies:post:ip:${ip}:admin:${session.user.id}`, 60, 10 * 60 * 1000)
  if (!rl.allowed) {
    return addRateLimitHeaders(NextResponse.json({ error: 'Too Many Requests' }, { status: 429 }), rl, 60)
  }

  try {
    const body = await req.json()
    const { name, defaultCommission, commissionType } = body

    if (!name) {
      return addRateLimitHeaders(NextResponse.json({ error: 'Nome richiesto' }, { status: 400 }), rl, 60)
    }

    const existing = await prisma.agency.findUnique({
      where: { name }
    })

    if (existing) {
      return addRateLimitHeaders(NextResponse.json({ error: 'Agenzia già esistente' }, { status: 400 }), rl, 60)
    }

    const agency = await prisma.agency.create({
      data: { 
        name,
        defaultCommission: defaultCommission ? parseFloat(defaultCommission) : 0,
        commissionType: commissionType || 'PERCENTAGE'
      }
    })

    return addRateLimitHeaders(NextResponse.json(agency), rl, 60)
  } catch (error) {
    console.error('Error creating agency:', error)
    return NextResponse.json({ error: 'Errore nella creazione dell\'agenzia' }, { status: 500 })
  }
}
