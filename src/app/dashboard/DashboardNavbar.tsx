'use client'

import Link from 'next/link'
import { LogOut, Home, User } from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'

interface DashboardNavbarProps {
  user: {
    firstName?: string
    lastName?: string
    code?: string
    role?: string
  }
}

export function DashboardNavbar({ user }: DashboardNavbarProps) {
  const router = useRouter()
  const pathname = usePathname()

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const isDashboardRoot = pathname === '/dashboard'

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors">
                Gestionale Corfumania
              </h1>
            </Link>
            
            <div className="hidden md:flex items-center gap-4 ml-6 border-l border-gray-200 pl-6">
              <Link href="/dashboard" className={`text-sm font-medium ${isDashboardRoot ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'} transition-colors`}>
                Dashboard
              </Link>
              <Link href="/dashboard/excursions" className={`text-sm font-medium ${pathname.startsWith('/dashboard/excursions') ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'} transition-colors`}>
                Escursioni
              </Link>
              <Link href="/dashboard/transfers" className={`text-sm font-medium ${pathname.startsWith('/dashboard/transfers') ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'} transition-colors`}>
                Trasferimenti
              </Link>
              {user.role === 'ADMIN' && (
                <>
                  <Link href="/dashboard/users" className={`text-sm font-medium ${pathname.startsWith('/dashboard/users') ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'} transition-colors`}>
                    Assistenti
                  </Link>
                  <Link href="/dashboard/suppliers" className={`text-sm font-medium ${pathname.startsWith('/dashboard/suppliers') ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'} transition-colors`}>
                    Rifornitori
                  </Link>
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-6">
            <div className="flex flex-col items-end">
              <span className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                <span className="hidden md:inline">
                  {user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}` : 'Utente'}
                </span>
                <span className="md:hidden">
                   {user.firstName || 'Utente'}
                </span>
              </span>
              <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full" title="Codice Utente">
                {user.code}
              </span>
            </div>

            <div className="h-8 w-px bg-gray-200 mx-1 md:mx-2 block"></div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-gray-600 hover:text-red-600 px-2 md:px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-red-50"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline">Esci</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
