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
      id: true,
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

  const accounts = user?.email
    ? await prisma.user.findMany({
        where: {
          email: { equals: user.email, mode: 'insensitive' },
          id: { not: user.id },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          code: true,
          role: true,
          isSpecialAssistant: true,
          agency: { select: { name: true } },
        },
        orderBy: [{ role: 'asc' }, { firstName: 'asc' }, { lastName: 'asc' }],
      })
    : []

  return NextResponse.json({
    role: user?.role || session.user.role,
    isSpecialAssistant: computeIsSpecialAssistant(user, user?.agency?.name),
    explicitIsSpecialAssistant: Boolean(user?.isSpecialAssistant),
    agencyName: user?.agency?.name ?? null,
    agencyDefaultCommission: user?.agency?.defaultCommission ?? null,
    agencyCommissionType: user?.agency?.commissionType ?? null,
    accounts: accounts.map(a => ({
      id: a.id,
      firstName: a.firstName,
      lastName: a.lastName,
      code: a.code,
      role: a.role,
      isSpecialAssistant: a.isSpecialAssistant,
      agencyName: a.agency?.name ?? null,
    })),
  })
}
