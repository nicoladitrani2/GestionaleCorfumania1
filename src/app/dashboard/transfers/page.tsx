import { getSession } from '@/lib/auth'
import { TransfersManager } from './TransfersManager'
import { redirect } from 'next/navigation'

export default async function TransfersPage() {
  const session = await getSession()
  if (!session) {
    redirect('/login')
  }

  return (
    <div className="p-6">
      <TransfersManager 
        currentUserId={session.user.id} 
        currentUserRole={session.user.role} 
      />
    </div>
  )
}
