import { getSession } from '@/lib/auth'
import { TransfersManager } from './TransfersManager'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export default async function TransfersPage() {
  const session = await getSession()
  if (!session) {
    redirect('/login')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { 
      agencyId: true,
      agency: {
        select: {
          defaultCommission: true,
          commissionType: true
        }
      }
    }
  })

  return (
    <div className="p-6">
      <TransfersManager 
        currentUserId={session.user.id} 
        userRole={session.user.role}
        userAgencyId={user?.agencyId || undefined}
        agencyDefaultCommission={user?.agency?.defaultCommission}
        agencyCommissionType={user?.agency?.commissionType}
      />
    </div>
  )
}
