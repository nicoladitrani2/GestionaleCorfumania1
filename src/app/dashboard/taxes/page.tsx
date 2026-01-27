import { getSession } from '@/lib/auth'
import { TaxesManager } from './TaxesManager'
import { redirect } from 'next/navigation'

export default async function TaxesPage() {
  const session = await getSession()
  if (!session) {
    redirect('/login')
  }

  return (
    <div className="p-6">
      <TaxesManager 
        currentUserId={session.user.id} 
        userRole={session.user.role}
      />
    </div>
  )
}
