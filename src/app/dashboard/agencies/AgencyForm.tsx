'use client'

import { useState, useEffect } from 'react'
import { X, Save, Briefcase } from 'lucide-react'
import type { Agency } from './AgenciesManager'

interface AgencyFormProps {
  agency: Agency | null
  onClose: () => void
  onSubmit: () => void
}

export function AgencyForm({ agency, onClose, onSubmit }: AgencyFormProps) {
  const [name, setName] = useState('')
  const [defaultCommission, setDefaultCommission] = useState('')
  const [commissionType, setCommissionType] = useState('PERCENTAGE')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (agency) {
      setName(agency.name)
      setDefaultCommission(agency.defaultCommission ? agency.defaultCommission.toString() : '')
      setCommissionType((agency as any).commissionType || 'PERCENTAGE')
    } else {
      setName('')
      setDefaultCommission('')
      setCommissionType('PERCENTAGE')
    }
  }, [agency])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const url = agency ? `/api/agencies/${agency.id}` : '/api/agencies'
      const method = agency ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name, 
          defaultCommission,
          commissionType
        })
      })

      if (res.ok) {
        onSubmit()
      } else {
        const data = await res.json()
        setError(data.error || 'Errore nel salvataggio')
      }
    } catch {
      setError('Errore di connessione')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all animate-in zoom-in-95 duration-200">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 sm:px-6 py-4 flex justify-between items-center">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Briefcase className="w-5 h-5" />
            {agency ? 'Modifica Agenzia' : 'Nuova Agenzia'}
          </h2>
          <button onClick={onClose} className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-1 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-900">Nome Agenzia</label>
              <input
                type="text"
                required
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                placeholder="Nome Agenzia"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-900">Tipo Commissione</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="commissionType"
                    value="PERCENTAGE"
                    checked={commissionType === 'PERCENTAGE'}
                    onChange={(e) => setCommissionType(e.target.value)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="text-sm text-gray-700">Percentuale (%)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="commissionType"
                    value="FIXED"
                    checked={commissionType === 'FIXED'}
                    onChange={(e) => setCommissionType(e.target.value)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="text-sm text-gray-700">Fisso (€ per persona)</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-900">
                {commissionType === 'PERCENTAGE' ? 'Commissione Default (%)' : 'Commissione Default (€)'}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max={commissionType === 'PERCENTAGE' ? "100" : undefined}
                  step={commissionType === 'PERCENTAGE' ? "0.1" : "0.5"}
                  required
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow pr-8"
                  placeholder="0"
                  value={defaultCommission}
                  onChange={(e) => setDefaultCommission(e.target.value)}
                />
                <span className="absolute right-3 top-2.5 text-gray-500 font-medium">
                  {commissionType === 'PERCENTAGE' ? '%' : '€'}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Questa impostazione verrà usata come default per le nuove escursioni, noleggi e trasferimenti.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm text-center font-medium">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-70 flex items-center gap-2"
              >
                {loading ? 'Salvataggio...' : (
                  <>
                    <Save className="w-4 h-4" />
                    Salva
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
