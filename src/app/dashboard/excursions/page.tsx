import { getSession } from '@/lib/auth'
import { ExcursionsManager } from './ExcursionsManager'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function ExcursionsPage() {
  const session = await getSession()
  if (!session) {
    redirect('/login')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { 
      isSpecialAssistant: true,
      agencyId: true,
      agency: {
        select: {
          name: true,
          defaultCommission: true,
          commissionType: true
        }
      }
    }
  })
  const agencyNameLower = String(user?.agency?.name || '').toLowerCase().trim()
  const isSpecialAssistant =
    !!user?.isSpecialAssistant ||
    session.user.role === 'ADMIN' ||
    agencyNameLower.includes('corfumania') ||
    agencyNameLower.includes('go4sea')
  const effectiveAgencyDefaultCommission = isSpecialAssistant ? 10 : user?.agency?.defaultCommission
  const effectiveAgencyCommissionType = isSpecialAssistant ? 'PERCENTAGE' : user?.agency?.commissionType

  return (
    <div className="p-6">
      <ExcursionsManager 
        currentUserId={session.user.id} 
        userRole={session.user.role}
        userAgencyId={user?.agencyId || undefined}
        agencyDefaultCommission={effectiveAgencyDefaultCommission}
        agencyCommissionType={effectiveAgencyCommissionType}
        currentUserIsSpecialAssistant={isSpecialAssistant}
      />
    </div>
  )
}
