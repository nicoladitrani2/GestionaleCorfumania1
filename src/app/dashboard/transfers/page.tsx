import { getSession } from '@/lib/auth'
import { TransfersManager } from './TransfersManager'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function TransfersPage() {
  const session = await getSession()
  if (!session) {
    redirect('/login')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { 
      role: true,
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
  const isSpecialAssistant = !!user?.isSpecialAssistant
  const effectiveAgencyDefaultCommission = user?.agency?.defaultCommission
  const effectiveAgencyCommissionType = user?.agency?.commissionType
  const effectiveRole = String(user?.role || session.user.role || '')

  return (
    <div className="p-6">
      <TransfersManager 
        currentUserId={session.user.id} 
        userRole={effectiveRole}
        userAgencyId={user?.agencyId || undefined}
        agencyDefaultCommission={effectiveAgencyDefaultCommission}
        agencyCommissionType={effectiveAgencyCommissionType}
        currentUserIsSpecialAssistant={isSpecialAssistant}
      />
    </div>
  )
}
