import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { addRateLimitHeaders, getClientIp, rateLimit } from '@/lib/rateLimit'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const ip = getClientIp(request)
  const rl = rateLimit(`agencies:put:ip:${ip}:admin:${session.user.id}`, 120, 10 * 60 * 1000)
  if (!rl.allowed) {
    return addRateLimitHeaders(NextResponse.json({ error: 'Too Many Requests' }, { status: 429 }), rl, 120)
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { name, defaultCommission, commissionType } = body

    if (!name) {
      return addRateLimitHeaders(NextResponse.json({ error: 'Nome richiesto' }, { status: 400 }), rl, 120)
    }

    const agency = await prisma.agency.update({
      where: { id },
      data: { 
        name,
        defaultCommission: defaultCommission !== undefined ? parseFloat(defaultCommission) : undefined,
        commissionType: commissionType || undefined
      }
    })

    return addRateLimitHeaders(NextResponse.json(agency), rl, 120)
  } catch (error) {
    console.error('Error updating agency:', error)
    return NextResponse.json({ error: 'Errore durante l\'aggiornamento' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const ip = getClientIp(request)
  const rl = rateLimit(`agencies:delete:ip:${ip}:admin:${session.user.id}`, 60, 60 * 60 * 1000)
  if (!rl.allowed) {
    return addRateLimitHeaders(NextResponse.json({ error: 'Too Many Requests' }, { status: 429 }), rl, 60)
  }

  try {
    const { id } = await params
    await prisma.agency.delete({
      where: { id }
    })
    return addRateLimitHeaders(NextResponse.json({ success: true }), rl, 60)
  } catch (error) {
    console.error('Error deleting agency:', error)
    return NextResponse.json({ error: 'Errore durante l\'eliminazione' }, { status: 500 })
  }
}
