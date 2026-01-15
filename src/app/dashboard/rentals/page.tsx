import { getSession } from '@/lib/auth'
import { RentalsManager } from './RentalsManager'
import { redirect } from 'next/navigation'

export default async function RentalsPage() {
  const session = await getSession()
  if (!session) {
    redirect('/login')
  }

  return (
    <div className="p-6">
      <RentalsManager 
        currentUserId={session.user.id} 
        userRole={session.user.role} 
        currentUserSupplierName={session.user.supplierName}
      />
    </div>
  )
}
