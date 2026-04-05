import { useMemo, useState } from 'react'
import { X, FileDown, CheckSquare, Square } from 'lucide-react'

export type ExportTaxBookingsFormat = 'PDF' | 'CSV'

export const TAX_EXPORT_FIELDS = [
  { id: 'section', label: 'Sezione' },
  { id: 'week', label: 'Settimana' },
  { id: 'nFile', label: 'N File' },
  { id: 'provenienza', label: 'Provenienza' },
  { id: 'service', label: 'Servizio' },
  { id: 'pax', label: 'Pax' },
  { id: 'leadName', label: 'Capogruppo' },
  { id: 'agencyName', label: 'Agenzia' },
  { id: 'hotel', label: 'Hotel' },
  { id: 'inDate', label: 'IN' },
  { id: 'outDate', label: 'OUT' },
  { id: 'bracelet', label: 'Braccialetto' },
  { id: 'cityTax', label: 'Tassa di soggiorno' },
  { id: 'total', label: 'Totale' },
  { id: 'depositIn', label: 'Cauzione entrata' },
  { id: 'depositOut', label: 'Cauzione uscita' },
  { id: 'depositNet', label: 'Cauzione netto' },
  { id: 'depositStatus', label: 'Cauzione esito' },
  { id: 'assistant', label: 'Assistente' },
  { id: 'customerPaid', label: 'Incassato' },
  { id: 'adminPaid', label: 'Versato admin' },
]

export interface ExportTaxBookingsOptions {
  format: ExportTaxBookingsFormat
  includeServices: boolean
  includeDeposits: boolean
  fields: string[]
}

interface ExportTaxBookingsModalProps {
  title: string
  defaultFormat: ExportTaxBookingsFormat
  onClose: () => void
  onExport: (options: ExportTaxBookingsOptions) => void
}

export function ExportTaxBookingsModal({ title, defaultFormat, onClose, onExport }: ExportTaxBookingsModalProps) {
  const [format, setFormat] = useState<ExportTaxBookingsFormat>(defaultFormat)
  const [includeServices, setIncludeServices] = useState(true)
  const [includeDeposits, setIncludeDeposits] = useState(true)
  const [selectedFields, setSelectedFields] = useState<string[]>(TAX_EXPORT_FIELDS.map(f => f.id))

  const canExport = useMemo(() => {
    if (!includeServices && !includeDeposits) return false
    if (selectedFields.length === 0) return false
    return true
  }, [includeServices, includeDeposits, selectedFields])

  const toggleField = (id: string) => {
    setSelectedFields(prev => {
      if (prev.includes(id)) return prev.filter(f => f !== id)
      return [...prev, id]
    })
  }

  const handleExport = () => {
    if (!canExport) return
    onExport({
      format,
      includeServices,
      includeDeposits,
      fields: selectedFields,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex justify-between items-center">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <FileDown className="w-6 h-6" />
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-1 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-800 block">Formato</label>
              <select
                value={format}
                onChange={e => setFormat(e.target.value as ExportTaxBookingsFormat)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="PDF">PDF</option>
                <option value="CSV">CSV</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-800 block">Sezioni</label>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setIncludeServices(v => !v)}
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-xs
                    ${includeServices ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}
                  `}
                >
                  {includeServices ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-gray-400" />}
                  <span className="font-medium">Servizi (braccialetto/tassa)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIncludeDeposits(v => !v)}
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-xs
                    ${includeDeposits ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}
                  `}
                >
                  {includeDeposits ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-gray-400" />}
                  <span className="font-medium">Cauzioni</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-800 block">Preset</label>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedFields(TAX_EXPORT_FIELDS.map(f => f.id))}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-xs text-gray-700 hover:bg-gray-50 text-left"
                >
                  Seleziona tutto
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFields(['week', 'nFile', 'provenienza', 'service', 'pax', 'leadName', 'total', 'depositIn', 'depositOut', 'depositNet', 'depositStatus'])}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-xs text-gray-700 hover:bg-gray-50 text-left"
                >
                  Solo essenziali
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-bold text-gray-900 block">Seleziona i campi da esportare:</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {TAX_EXPORT_FIELDS.map(field => {
                const isSelected = selectedFields.includes(field.id)
                return (
                  <button
                    key={field.id}
                    type="button"
                    onClick={() => toggleField(field.id)}
                    className={`
                      flex items-center gap-2 p-3 rounded-lg border text-left text-xs
                      ${isSelected
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}
                    `}
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 shrink-0 text-gray-400" />
                    )}
                    <span className="font-medium">{field.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium"
            >
              Annulla
            </button>
            <button
              onClick={handleExport}
              disabled={!canExport}
              className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-sm transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50"
            >
              <FileDown className="w-4 h-4" />
              Esporta
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
