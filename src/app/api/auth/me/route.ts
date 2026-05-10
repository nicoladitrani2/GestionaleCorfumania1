import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function computeIsSpecialAssistant(user: any, agencyName?: string | null): boolean {
  if (!user) return false
  return user.isSpecialAssistant === true
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
    agencyName: user?.agency?.name ?? null,
    agencyDefaultCommission: user?.agency?.defaultCommission ?? null,
    agencyCommissionType: user?.agency?.commissionType ?? null,
  })
}
