import { X, Trash2, RotateCcw } from 'lucide-react'

interface DeleteChoiceModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirmDelete: () => void
  onRequestRefund: () => void
  participantName: string
}

export function DeleteChoiceModal({ 
  isOpen, 
  onClose, 
  onConfirmDelete, 
  onRequestRefund,
  participantName 
}: DeleteChoiceModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="text-lg font-bold text-gray-800">Gestione Cancellazione</h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-200 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🤔</span>
            </div>
            <h4 className="text-xl font-semibold text-gray-900 mb-2">
              Cosa vuoi fare con {participantName}?
            </h4>
            <p className="text-gray-500 text-sm">
              Puoi eliminare definitivamente il partecipante o procedere con un rimborso mantenendo lo storico.
            </p>
          </div>

          <div className="grid gap-3">
            <button
              onClick={onRequestRefund}
              className="flex items-center justify-center gap-3 w-full p-4 bg-white border-2 border-orange-100 hover:border-orange-500 text-gray-700 hover:text-orange-700 rounded-xl transition-all group"
            >
              <div className="p-2 bg-orange-50 text-orange-600 rounded-lg group-hover:scale-110 transition-transform">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div className="text-left flex-1">
                <div className="font-semibold">Procedi al Rimborso</div>
                <div className="text-xs text-gray-500">Sposta in lista rimborsati e registra il rimborso</div>
              </div>
            </button>

            <button
              onClick={onConfirmDelete}
              className="flex items-center justify-center gap-3 w-full p-4 bg-white border-2 border-red-100 hover:border-red-500 text-gray-700 hover:text-red-700 rounded-xl transition-all group"
            >
              <div className="p-2 bg-red-50 text-red-600 rounded-lg group-hover:scale-110 transition-transform">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="text-left flex-1">
                <div className="font-semibold">Elimina Definitivamente</div>
                <div className="text-xs text-gray-500">Rimuove completamente il partecipante dal database</div>
              </div>
            </button>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-center">
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 font-medium text-sm hover:underline"
          >
            Annulla operazione
          </button>
        </div>
      </div>
    </div>
  )
}
