import { getSession } from '@/lib/auth'
import { ExcursionsManager } from './ExcursionsManager'
import { redirect } from 'next/navigation'

export default async function ExcursionsPage() {
  const session = await getSession()
  if (!session) {
    redirect('/login')
  }

  return (
    <div className="p-6">
      <ExcursionsManager 
        currentUserId={session.user.id} 
        currentUserRole={session.user.role} 
      />
    </div>
  )
}
