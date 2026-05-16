'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Lock, Mail, AlertCircle, User } from 'lucide-react'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [accounts, setAccounts] = useState<any[]>([])
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get('reason') === 'timeout') {
      setError('Sessione scaduta per inattività. Effettua nuovamente l\'accesso.')
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setAccounts([])
    setLoading(true)

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (res.ok) {
        router.push('/dashboard')
        router.refresh()
      } else {
        const data = await res.json()
        if (data?.code === 'MULTIPLE_ACCOUNTS' && Array.isArray(data?.accounts) && data.accounts.length) {
          setAccounts(data.accounts)
          setError('')
        } else {
          setError(data.error || 'Login fallito')
        }
      }
    } catch (err) {
      setError('Errore di connessione')
    } finally {
      setLoading(false)
    }
  }

  const handleChooseAccount = async (userId: string) => {
    const id = String(userId || '').trim()
    if (!id) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, userId: id }),
      })
      if (res.ok) {
        router.push('/dashboard')
        router.refresh()
      } else {
        const data = await res.json()
        setError(data?.error || 'Login fallito')
      }
    } catch {
      setError('Errore di connessione')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="px-8 py-10">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-extrabold text-gray-900">
              Benvenuto
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Accedi al gestionale Corfumania
            </p>
          </div>
          
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2 border border-red-100">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400"
                  placeholder="nome@esempio.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
              >
                {loading ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Accedi'
                )}
              </button>
            </div>
          </form>

          {accounts.length > 0 && (
            <div className="mt-6 border-t border-gray-100 pt-4">
              <div className="text-sm font-semibold text-gray-900 mb-2">
                Seleziona un account
              </div>
              <div className="space-y-2">
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
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => handleChooseAccount(a.id)}
                      disabled={loading}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-left disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{label}</div>
                        <div className="text-xs text-gray-500 truncate">
                          {a.code ? `${a.code} · ` : ''}{roleLabel}{agency}
                        </div>
                      </div>
                      <User className="w-4 h-4 text-gray-400 shrink-0" />
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600">
        <div className="text-white text-xl font-medium animate-pulse">Caricamento...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
