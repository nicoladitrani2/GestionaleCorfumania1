import { getSession } from '@/lib/auth'
import { RentalsManager } from './RentalsManager'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export default async function RentalsPage() {
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
          defaultCommission: true,
          commissionType: true
        }
      }
    }
  })
  const effectiveRole = String(user?.role || session.user.role || '')

  return (
    <div className="p-6">
      <RentalsManager 
        currentUserId={session.user.id} 
        userRole={effectiveRole}
        currentUserIsSpecialAssistant={!!user?.isSpecialAssistant}
        userAgencyId={user?.agencyId || undefined}
        agencyDefaultCommission={user?.agency?.defaultCommission}
        agencyCommissionType={user?.agency?.commissionType}
      />
    </div>
  )
}
