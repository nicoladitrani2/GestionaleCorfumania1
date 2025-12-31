import { getSession } from '@/lib/auth'
import { DashboardNavbar } from './DashboardNavbar'
import { redirect } from 'next/navigation'
import { AutoLogout } from './AutoLogout'
import PWAInstallPrompt from './PWAInstallPrompt'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  
  if (!session) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AutoLogout />
      <DashboardNavbar user={session.user} />
      <PWAInstallPrompt />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}
