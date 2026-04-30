import { useState } from 'react'
import { X, FileDown, CheckSquare, Square, Filter } from 'lucide-react'

interface ExportRentalsModalProps {
  onClose: () => void
  onExport: (options: {
    agencies: string[]
    suppliers: string[]
    rentalTypes: string[]
    startDate?: string
    endDate?: string
    fields: string[]
  }) => void
  agencies: string[]
  suppliers: string[]
  rentalTypes: string[]
}

export const RENTAL_EXPORT_FIELDS = [
  { id: 'client', label: 'Cliente' },
  { id: 'phoneNumber', label: 'Telefono' },
  { id: 'rentalType', label: 'Tipo Mezzo' },
  { id: 'supplier', label: 'Fornitore' },
  { id: 'rentalStartDate', label: 'Data Inizio' },
  { id: 'rentalEndDate', label: 'Data Fine' },
  { id: 'price', label: 'Prezzo Totale' },
  { id: 'deposit', label: 'Acconto' },
  { id: 'tax', label: 'Tasse' },
  { id: 'paymentType', label: 'Tipo Pagamento' },
  { id: 'paymentStatus', label: 'Stato Pagamento' },
  { id: 'agency', label: 'Agenzia' },
  { id: 'notes', label: 'Note' },
  { id: 'createdAt', label: 'Data Inserimento' },
]

export function ExportRentalsModal({
  onClose,
  onExport,
  agencies,
  suppliers,
  rentalTypes,
}: ExportRentalsModalProps) {
  const [selectedAgencies, setSelectedAgencies] = useState<string[]>([])
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([])
  const [selectedRentalTypes, setSelectedRentalTypes] = useState<string[]>([])
  const [selectedFields, setSelectedFields] = useState<string[]>(RENTAL_EXPORT_FIELDS.map(f => f.id))
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  const toggleValue = (current: string[], value: string) => {
    if (current.includes(value)) {
      return current.filter(v => v !== value)
    }
    return [...current, value]
  }

  const toggleField = (id: string) => {
    setSelectedFields(prev => {
      if (prev.includes(id)) {
        return prev.filter(f => f !== id)
      }
      return [...prev, id]
    })
  }

  const handleExport = () => {
    onExport({
      agencies: selectedAgencies,
      suppliers: selectedSuppliers,
      rentalTypes: selectedRentalTypes,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      fields: selectedFields,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex justify-between items-center">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <FileDown className="w-6 h-6" />
            Esporta Noleggi
          </h3>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-1 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 space-y-6 overflow-y-auto flex-1">
            <div className="flex items-center gap-2 text-sm text-gray-600">
            <Filter className="w-4 h-4 text-blue-500" />
            <span>
              Applica filtri combinati per Agenzia, Fornitore, Tipo Mezzo e Periodo. Se lasci vuoto, non si applica alcun filtro su quel campo.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-800">Operatore / Agenzia</label>
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-2">
                {agencies.length === 0 && (
                  <p className="text-xs text-gray-400 px-1">Nessuna agenzia trovata nei noleggi</p>
                )}
                {agencies.map(name => {
                  const selected = selectedAgencies.includes(name)
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setSelectedAgencies(prev => toggleValue(prev, name))}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs border ${
                        selected
                          ? 'bg-blue-50 border-blue-300 text-blue-700'
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {selected ? (
                        <CheckSquare className="w-3.5 h-3.5" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-gray-400" />
                      )}
                      <span className="truncate">{name}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-800">Fornitori</label>
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-2">
                {suppliers.length === 0 && (
                  <p className="text-xs text-gray-400 px-1">Nessun fornitore trovato nei noleggi</p>
                )}
                {suppliers.map(name => {
                  const selected = selectedSuppliers.includes(name)
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setSelectedSuppliers(prev => toggleValue(prev, name))}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs border ${
                        selected
                          ? 'bg-blue-50 border-blue-300 text-blue-700'
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {selected ? (
                        <CheckSquare className="w-3.5 h-3.5" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-gray-400" />
                      )}
                      <span className="truncate">{name}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-800">Tipologia Mezzo</label>
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-2">
                {rentalTypes.length === 0 && (
                  <p className="text-xs text-gray-400 px-1">Nessuna tipologia trovata</p>
                )}
                {rentalTypes.map(type => {
                  const selected = selectedRentalTypes.includes(type)
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setSelectedRentalTypes(prev => toggleValue(prev, type))}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs border ${
                        selected
                          ? 'bg-blue-50 border-blue-300 text-blue-700'
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {selected ? (
                        <CheckSquare className="w-3.5 h-3.5" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-gray-400" />
                      )}
                      <span className="truncate">
                        {type === 'CAR' ? 'Auto' : type === 'MOTO' ? 'Moto' : type === 'BOAT' ? 'Barca' : type}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-800">Data Inizio (dal)</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-800">Data Fine (al)</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-bold text-gray-900 block">Seleziona i campi da esportare:</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {RENTAL_EXPORT_FIELDS.map(field => {
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

          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium"
          >
            Annulla
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-sm transition-colors text-sm font-medium flex items-center gap-2"
          >
            <FileDown className="w-4 h-4" />
            Esporta PDF
          </button>
        </div>
      </div>
    </div>
  )
}
