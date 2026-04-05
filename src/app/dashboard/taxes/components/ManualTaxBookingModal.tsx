import { useState } from 'react'
import { X, Save, AlertCircle } from 'lucide-react'

interface ManualTaxBookingModalProps {
  onClose: () => void
  onSuccess: () => void
}

export function ManualTaxBookingModal({ onClose, onSuccess }: ManualTaxBookingModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    leadName: '',
    week: 'Manuale',
    provenienza: 'PRIVATO', // 1=Privato, 2=Agenzia
    serviceCode: 3, // Default Braccialetto + Tassa
    pax: 1,
    totalAmount: 0,
    paid: false
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Create a unique nFile
      const nFile = `MANUAL_${Date.now()}`

      const payload = {
        bookings: [
          {
            nFile,
            week: formData.week,
            provenienza: formData.provenienza,
            serviceCode: formData.serviceCode,
            pax: Number(formData.pax),
            leadName: formData.leadName,
            totalAmount: Number(formData.totalAmount),
            customerPaid: formData.paid,
            rawData: JSON.stringify({ 
                isManual: true, 
                createdAt: new Date().toISOString(),
                importSource: 'MANUAL',
                participants: []
            })
          }
        ]
      }

      const res = await fetch('/api/taxes/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        throw new Error('Errore durante il salvataggio')
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Errore sconosciuto')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-lg text-gray-800">Nuova Prenotazione Manuale</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Nome Capogruppo</label>
            <input
              required
              type="text"
              value={formData.leadName}
              onChange={e => setFormData({...formData, leadName: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Mario Rossi"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Settimana</label>
              <input
                required
                type="text"
                value={formData.week}
                onChange={e => setFormData({...formData, week: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Es. 30 Giugno"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Provenienza</label>
              <select
                value={formData.provenienza}
                onChange={e => setFormData({...formData, provenienza: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="PRIVATO">Privato</option>
                <option value="AGENZIA">Agenzia</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Pax</label>
              <input
                required
                type="number"
                min="1"
                value={formData.pax}
                onChange={e => setFormData({...formData, pax: Number(e.target.value)})}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Servizio</label>
              <select
                value={formData.serviceCode}
                onChange={e => {
                  const next = Number(e.target.value)
                  setFormData(prev => ({
                    ...prev,
                    serviceCode: next,
                    totalAmount: next === 4 ? 50 : prev.totalAmount
                  }))
                }}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value={1}>Solo Braccialetto</option>
                <option value={2}>Tassa di Soggiorno</option>
                <option value={3}>Braccialetto + Tassa</option>
                <option value={4}>Cauzione</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Importo (€)</label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={formData.totalAmount}
                onChange={e => setFormData({...formData, totalAmount: Number(e.target.value)})}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Stato Pagamento</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={!formData.paid}
                  onChange={() => setFormData({...formData, paid: false})}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">Da Pagare</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={formData.paid}
                  onChange={() => setFormData({...formData, paid: true})}
                  className="text-green-600 focus:ring-green-500"
                />
                <span className="text-sm font-bold text-green-700">Già Pagato</span>
              </label>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
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
  )
}
