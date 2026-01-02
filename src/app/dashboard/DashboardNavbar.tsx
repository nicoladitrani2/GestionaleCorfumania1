'use client'

import Link from 'next/link'
import { LogOut, Home, User, Menu, X } from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'
import { useState } from 'react'

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

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
            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
            >
              {isMobileMenuOpen ? (
                <X className="block h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="block h-6 w-6" aria-hidden="true" />
              )}
            </button>

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
      
      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white">
            <Link
              href="/dashboard"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`block px-3 py-2 rounded-md text-base font-medium ${
                isDashboardRoot
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              Dashboard
            </Link>
            <Link
              href="/dashboard/excursions"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`block px-3 py-2 rounded-md text-base font-medium ${
                pathname.startsWith('/dashboard/excursions')
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              Escursioni
            </Link>
            <Link
              href="/dashboard/transfers"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`block px-3 py-2 rounded-md text-base font-medium ${
                pathname.startsWith('/dashboard/transfers')
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              Trasferimenti
            </Link>
            {user.role === 'ADMIN' && (
              <>
                <Link
                  href="/dashboard/users"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`block px-3 py-2 rounded-md text-base font-medium ${
                    pathname.startsWith('/dashboard/users')
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  Assistenti
                </Link>
                <Link
                  href="/dashboard/suppliers"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`block px-3 py-2 rounded-md text-base font-medium ${
                    pathname.startsWith('/dashboard/suppliers')
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  Rifornitori
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
