import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { UsersManager } from './UsersManager'

export default async function UsersPage() {
  const session = await getSession()
  if (!session) {
    redirect('/login')
  }

  // Only Admin can manage users
  if (session.user.role !== 'ADMIN') {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-bold text-red-600">Accesso Negato</h2>
        <p className="text-gray-600">Non hai i permessi per accedere a questa pagina.</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <UsersManager currentUserId={session.user.id} />
    </div>
  )
}
