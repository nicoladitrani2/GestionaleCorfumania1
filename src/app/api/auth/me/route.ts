import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function computeIsSpecialAssistant(user: any, agencyName?: string | null): boolean {
  if (!user) return false
  if (user.isSpecialAssistant) return true
  if (String(user.role || '').toUpperCase() === 'ADMIN') return true
  const normalizedAgency = String(agencyName || '').toLowerCase().trim()
  if (normalizedAgency.includes('corfumania') || normalizedAgency.includes('go4sea')) return true
  const haystack = `${user.firstName || ''} ${user.lastName || ''} ${user.email || ''} ${user.code || ''}`
    .toLowerCase()
    .trim()
  return haystack.includes('speciale')
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      firstName: true,
      lastName: true,
      email: true,
      code: true,
      role: true,
      isSpecialAssistant: true,
      agency: {
        select: {
          name: true,
          defaultCommission: true,
          commissionType: true,
        },
      },
    },
  })

  return NextResponse.json({
    role: user?.role || session.user.role,
    isSpecialAssistant: computeIsSpecialAssistant(user, user?.agency?.name),
    explicitIsSpecialAssistant: Boolean(user?.isSpecialAssistant),
    agencyDefaultCommission: user?.agency?.defaultCommission ?? null,
    agencyCommissionType: user?.agency?.commissionType ?? null,
  })
}
