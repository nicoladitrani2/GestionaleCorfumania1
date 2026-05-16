'use client'

import Link from 'next/link'
import { LogOut, Home, User, Menu, X, ChevronDown, Check } from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

interface DashboardNavbarProps {
  user: {
    id?: string
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
  const [accounts, setAccounts] = useState<any[]>([])
  const [accountsOpen, setAccountsOpen] = useState(false)
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const [currentAccountId, setCurrentAccountId] = useState<string | null>(user.id ? String(user.id) : null)
  const [switchError, setSwitchError] = useState<string>('')

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        const list = Array.isArray(data?.accounts) ? data.accounts : []
        setAccounts(list)
        const id = typeof data?.userId === 'string' ? data.userId : null
        if (id) setCurrentAccountId(id)
      } catch {}
    }
    run()
  }, [])

  useEffect(() => {
    if (user?.id) setCurrentAccountId(String(user.id))
  }, [user?.id])

  const handleSwitchAccount = async (userId: string) => {
    const id = String(userId || '').trim()
    if (!id) return
    if (currentAccountId && id === currentAccountId) return
    setSwitchError('')
    setSwitchingId(id)
    try {
      const res = await fetch('/api/auth/switch-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: id }),
      })
      if (res.ok) {
        setAccountsOpen(false)
        setCurrentAccountId(id)
        router.refresh()
        return
      }
      try {
        const data = await res.json()
        const msg = typeof data?.error === 'string' ? data.error : 'Impossibile cambiare account.'
        setSwitchError(msg)
      } catch {
        setSwitchError('Impossibile cambiare account.')
      }
    } finally {
      setSwitchingId(null)
    }
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
              <Link href="/dashboard/rentals" className={`text-sm font-medium ${pathname.startsWith('/dashboard/rentals') ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'} transition-colors`}>
                Noleggi
              </Link>
              <Link href="/dashboard/clients" className={`text-sm font-medium ${pathname.startsWith('/dashboard/clients') ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'} transition-colors`}>
                Clienti
              </Link>
              <Link href="/dashboard/taxes" className={`text-sm font-medium ${pathname.startsWith('/dashboard/taxes') ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'} transition-colors`}>
                Tasse & Extra
              </Link>
              {user.role === 'ADMIN' && (
                <>
                  <Link href="/dashboard/reports" className={`text-sm font-medium ${pathname.startsWith('/dashboard/reports') ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'} transition-colors`}>
                    Reports
                  </Link>
                  <Link href="/dashboard/users" className={`text-sm font-medium ${pathname.startsWith('/dashboard/users') ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'} transition-colors`}>
                    Assistenti
                  </Link>
                  <Link href="/dashboard/suppliers" className={`text-sm font-medium ${pathname.startsWith('/dashboard/suppliers') ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'} transition-colors`}>
                    Fornitori
                  </Link>
                  <Link href="/dashboard/agencies" className={`text-sm font-medium ${pathname.startsWith('/dashboard/agencies') ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'} transition-colors`}>
                    Agenzie
                  </Link>
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-6">
            <div className="relative">
              <button
                type="button"
                onClick={() => accounts.length ? setAccountsOpen(v => !v) : undefined}
                className={`flex flex-col items-end ${accounts.length ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <span className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600" />
                  <span className="hidden md:inline">
                    {user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}` : 'Utente'}
                  </span>
                  <span className="md:hidden">
                     {user.firstName || 'Utente'}
                  </span>
                  {accounts.length > 0 && (
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${accountsOpen ? 'rotate-180' : ''}`} />
                  )}
                </span>
                <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full" title="Codice Utente">
                  {user.code}
                </span>
              </button>

              {accountsOpen && accounts.length > 0 && (
                <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-50">
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50">
                    Cambia account
                  </div>
                  {switchError && (
                    <div className="px-3 py-2 text-xs text-red-700 bg-red-50 border-b border-red-100">
                      {switchError}
                    </div>
                  )}
                  <div className="py-1">
                    {accounts.map((a: any) => {
                      const label = `${a.firstName || ''} ${a.lastName || ''}`.trim() || a.code || 'Account'
                      const role = String(a.role || '').toUpperCase()
                      const roleLabel =
                        role === 'ADMIN'
                          ? 'Admin'
                          : a.isSpecialAssistant
                          ? 'Speciale'
                          : 'Standard'
                      const agency = a.agencyName ? ` · ${a.agencyName}` : ''
                      const isCurrent = currentAccountId ? String(a.id) === String(currentAccountId) : false
                      const disabled = switchingId === String(a.id) || isCurrent
                      return (
                        <button
                          key={a.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => handleSwitchAccount(a.id)}
                          className={`w-full text-left px-3 py-2 flex items-center justify-between gap-3 hover:bg-gray-50 ${
                            disabled ? 'opacity-60 cursor-not-allowed' : ''
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">{label}</div>
                            <div className="text-xs text-gray-500 truncate">
                              {a.code ? `${a.code} · ` : ''}{roleLabel}{agency}
                            </div>
                          </div>
                          <Check className={`w-4 h-4 ${isCurrent ? 'text-emerald-600' : 'text-transparent'}`} />
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
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
            <Link
              href="/dashboard/rentals"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`block px-3 py-2 rounded-md text-base font-medium ${
                pathname.startsWith('/dashboard/rentals')
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              Noleggi
            </Link>
            {user.role === 'ADMIN' && (
              <>
                <Link
                  href="/dashboard/reports"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`block px-3 py-2 rounded-md text-base font-medium ${
                    pathname.startsWith('/dashboard/reports')
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  Reports
                </Link>
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
                  Fornitori
                </Link>
                <Link
                  href="/dashboard/agencies"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`block px-3 py-2 rounded-md text-base font-medium ${
                    pathname.startsWith('/dashboard/agencies')
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  Agenzie
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
