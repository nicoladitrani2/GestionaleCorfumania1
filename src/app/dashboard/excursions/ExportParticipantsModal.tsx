import { useState } from 'react'
import { X, FileDown, CheckSquare, Square } from 'lucide-react'

interface ExportParticipantsModalProps {
  onClose: () => void
  onExport: (selectedFields: string[]) => void
}

export const EXPORT_FIELDS = [
  { id: 'accommodation', label: 'Struttura' },
  { id: 'pickupLocation', label: 'Partenza' },
  { id: 'pickupTime', label: 'Ora Partenza' },
  { id: 'nationality', label: 'Nazionalità' },
  { id: 'docType', label: 'Tipo Documento' },
  { id: 'docNumber', label: 'Numero Documento' },
  { id: 'email', label: 'Email' },
  { id: 'price', label: 'Prezzo' },
  { id: 'deposit', label: 'Acconto' },
  { id: 'paymentType', label: 'Stato Pagamento' },
  { id: 'paymentMethod', label: 'Metodi di Pagamento' },
  { id: 'notes', label: 'Note' },
  { id: 'createdBy', label: 'Inserito da' },
  { id: 'supplier', label: 'Fornitore' },
  { id: 'returnDetails', label: 'Dettagli Ritorno' },
  { id: 'createdAt', label: 'Data Inserimento' }
]

export function ExportParticipantsModal({ onClose, onExport }: ExportParticipantsModalProps) {
  const [selectedFields, setSelectedFields] = useState<string[]>(['nationality', 'notes', 'price', 'deposit', 'paymentType', 'pickupLocation', 'pickupTime'])

  const toggleField = (id: string) => {
    setSelectedFields(prev => 
      prev.includes(id) 
        ? prev.filter(f => f !== id)
        : [...prev, id]
    )
  }

  const handleExport = () => {
    onExport(selectedFields)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex justify-between items-center">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <FileDown className="w-6 h-6" />
            Esporta Lista Partecipanti
          </h3>
          <button 
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-1 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-gray-500 mb-4">
            I seguenti campi sono <strong>obbligatori</strong> e verranno sempre inclusi:
            <br />
            <span className="font-medium text-gray-700">Nome, Cognome, Telefono, Numero Partecipanti</span>
          </p>

          <div className="space-y-3 mb-6">
            <label className="text-sm font-bold text-gray-900 block">Seleziona i campi aggiuntivi:</label>
            <div className="grid grid-cols-2 gap-3">
              {EXPORT_FIELDS.map(field => (
                <div 
                  key={field.id}
                  onClick={() => toggleField(field.id)}
                  className={`
                    flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all
                    ${selectedFields.includes(field.id) 
                      ? 'bg-blue-50 border-blue-200 text-blue-700' 
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}
                  `}
                >
                  {selectedFields.includes(field.id) 
                    ? <CheckSquare className="w-4 h-4 shrink-0" />
                    : <Square className="w-4 h-4 shrink-0" />
                  }
                  <span className="text-sm font-medium">{field.label}</span>
                </div>
              ))}
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
              className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-sm transition-colors text-sm font-medium flex items-center gap-2"
            >
              <FileDown className="w-4 h-4" />
              Esporta PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
