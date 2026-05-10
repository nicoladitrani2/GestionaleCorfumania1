import { useState, useEffect } from 'react'
import { Euro, CreditCard, Banknote, AlertTriangle, X } from 'lucide-react'

interface RefundModalProps {
  isOpen: boolean
  onClose: () => void
  participant: any
  onConfirm: (participantId: string, amount: number, method: string, notes: string) => Promise<void>
}

export function RefundModal({ isOpen, onClose, participant, onConfirm }: RefundModalProps) {
  const [amount, setAmount] = useState(0)
  const [method, setMethod] = useState<'CASH' | 'DIGITAL'>('CASH')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const maxRefundable = (() => {
    if (!participant) return 0
    const ps = participant.paymentsSummary
    const incoming =
      ps && (ps.incomingCash !== undefined || ps.incomingDigital !== undefined)
        ? Number(ps.incomingCash || 0) + Number(ps.incomingDigital || 0)
        : Number(participant.paidAmount ?? 0)
    const outgoing =
      ps && (ps.outgoingCash !== undefined || ps.outgoingDigital !== undefined)
        ? Number(ps.outgoingCash || 0) + Number(ps.outgoingDigital || 0)
        : 0
    const v = incoming - outgoing
    return Number.isFinite(v) && v > 0 ? v : 0
  })()

  // Update amount when participant changes
  useEffect(() => {
    if (participant) {
      setAmount(maxRefundable)
      setError(null)
    }
  }, [participant, maxRefundable])

  if (!isOpen || !participant) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const v = Number(amount)
    if (!Number.isFinite(v) || v <= 0) {
      setError('Inserisci un importo valido.')
      return
    }
    if (v > maxRefundable + 0.009) {
      setError(`Importo massimo rimborsabile: € ${maxRefundable.toFixed(2)}`)
      return
    }
    setLoading(true)
    try {
      await onConfirm(participant.id, amount, method, notes)
      onClose()
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-red-50 shrink-0">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="font-bold text-lg">Rimborso ed Eliminazione</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
          <div className="p-4 bg-red-50 text-red-800 rounded-lg text-sm border border-red-100">
            Stai per rimborsare ed eliminare <strong>{participant.firstName} {participant.lastName}</strong>.<br/>
            Questa azione è <strong>irreversibile</strong> e rimuoverà il partecipante dalla lista.
          </div>

          <div className="space-y-4">
             {/* Amount Input */}
             <div>
                <label className="block text-sm font-bold text-gray-900 mb-1">Importo da Rimborsare (€)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">€</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={maxRefundable}
                    value={amount}
                    onChange={(e) => {
                      const raw = e.target.value
                      setAmount(raw === '' ? 0 : parseFloat(raw))
                      setError(null)
                    }}
                    className="w-full pl-7 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all text-gray-900 font-medium"
                    required
                  />
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  Massimo rimborsabile: € {maxRefundable.toFixed(2)}
                </div>
                {error ? <div className="mt-2 text-xs font-semibold text-red-700">{error}</div> : null}
             </div>

             {/* Method Selection */}
             <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Metodo di Rimborso</label>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={() => setMethod('CASH')}
                        className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${method === 'CASH' ? 'bg-green-50 border-green-500 text-green-700 ring-1 ring-green-500' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}
                    >
                        <Banknote className="w-5 h-5" />
                        <span className="text-xs font-bold">Contanti</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setMethod('DIGITAL')}
                        className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${method === 'DIGITAL' ? 'bg-blue-50 border-blue-500 text-blue-700 ring-1 ring-blue-500' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}
                    >
                        <CreditCard className="w-5 h-5" />
                        <span className="text-xs font-bold">Digitale</span>
                    </button>
                </div>
             </div>

             {/* Notes */}
             <div>
                <label className="block text-sm font-bold text-gray-900 mb-1">Note (Opzionale)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all h-20 resize-none text-gray-900"
                  placeholder="Dettagli aggiuntivi sul rimborso..."
                />
             </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
            >
                Annulla
            </button>
            <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 font-medium shadow-sm"
            >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Elaborazione...
                  </>
                ) : (
                  <>
                    <Euro className="w-4 h-4" />
                    Conferma Rimborso
                  </>
                )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
