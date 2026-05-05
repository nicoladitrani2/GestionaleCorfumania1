'use client'

import { useEffect, useState } from 'react'
import { ArrivalsImportModal } from './components/ArrivalsImportModal'
import { TaxBookingsList } from './components/TaxBookingsList'
import { FileSpreadsheet, List, Trash2 } from 'lucide-react'
import { ConfirmationModal } from '../components/ConfirmationModal'

interface TaxesManagerProps {
  currentUserId: string
  userRole: string
}

export function TaxesManager({ currentUserId, userRole }: TaxesManagerProps) {
  const [showImport, setShowImport] = useState(false)
  const [showBookings, setShowBookings] = useState(true)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [canImport, setCanImport] = useState<boolean>(userRole === 'ADMIN')

  useEffect(() => {
    if (userRole === 'ADMIN') return
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/auth/me')
        if (!res.ok) return
        const data = await res.json()
        const explicit = Boolean(data?.explicitIsSpecialAssistant)
        if (!cancelled) setCanImport(explicit)
      } catch {
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [userRole])

  const handleImportSuccess = () => {
    setShowImport(false)
    // Force refresh of bookings list if it's open, or just trigger general refresh
    setRefreshTrigger(prev => prev + 1)
  }

  const handleResetTaxes = async () => {
    try {
      const res = await fetch('/api/taxes/reset', { method: 'POST' })
      if (!res.ok) return
      setRefreshTrigger(prev => prev + 1)
    } catch {
    }
  }

  return (
    <div className="space-y-8">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
         <div>
           <h1 className="text-2xl font-bold text-gray-900">Tassa di Soggiorno e Servizi</h1>
          <p className="text-gray-500">Gestione Braccialetti, Tassa di Soggiorno e Cauzioni</p>
         </div>
         <div className="flex gap-2">
           <button 
             onClick={() => setShowBookings(!showBookings)}
             className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors shadow-sm ${showBookings ? 'bg-indigo-700 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
           >
             <List className="w-4 h-4" />
             {showBookings ? 'Nascondi Arrivi' : 'Lista Arrivi & Assegnazioni'}
           </button>
           
           {canImport && (
             <button 
                onClick={() => setShowImport(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
             >
                <FileSpreadsheet className="w-4 h-4" />
                Importa Lista Arrivi
             </button>
           )}

           {userRole === 'ADMIN' && (
             <button
               onClick={() => setResetModalOpen(true)}
               className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors shadow-sm border border-red-100"
             >
               <Trash2 className="w-4 h-4" />
               Reset Dati
             </button>
           )}
         </div>
       </div>

       {showImport && <ArrivalsImportModal onClose={() => setShowImport(false)} onSuccess={handleImportSuccess} />}

       <ConfirmationModal
         isOpen={resetModalOpen}
         onClose={() => setResetModalOpen(false)}
         onConfirm={handleResetTaxes}
         title="Reset Dati"
         message="Eliminerai tutti i dati di Tasse & Non Commissionabile (arrivi, importi e stato pagamenti). Confermi?"
         confirmText="Elimina"
         cancelText="Annulla"
         variant="danger"
       />

       {showBookings && (
           <TaxBookingsList 
             currentUserId={currentUserId} 
             userRole={userRole} 
             refreshTrigger={refreshTrigger}
           />
       )}
    </div>
  )
}
