'use client'

import { useState } from 'react'
import { TaxParticipantForm } from './components/TaxParticipantForm'
import { TaxParticipantsList } from './components/TaxParticipantsList'
import { ArrivalsImportModal } from './components/ArrivalsImportModal'
import { Plus, X, FileSpreadsheet } from 'lucide-react'

interface TaxesManagerProps {
  currentUserId: string
  userRole: string
}

export function TaxesManager({ currentUserId, userRole }: TaxesManagerProps) {
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleSuccess = () => {
    setShowForm(false)
    setRefreshTrigger(prev => prev + 1)
  }

  return (
    <div className="space-y-8">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
         <div>
           <h1 className="text-2xl font-bold text-gray-900">Tassa di Soggiorno e Servizi</h1>
           <p className="text-gray-500">Gestione Braccialetti, Tassa di Soggiorno e Aria Condizionata</p>
         </div>
         <div className="flex gap-2">
           <button 
             onClick={() => setShowImport(true)}
             className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
           >
             <FileSpreadsheet className="w-4 h-4" />
             Importa Lista Arrivi
           </button>
           <button 
             onClick={() => setShowForm(!showForm)}
             className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
           >
             {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
             {showForm ? 'Chiudi Form' : 'Aggiungi Partecipante'}
           </button>
         </div>
       </div>

       {showImport && <ArrivalsImportModal onClose={() => setShowImport(false)} />}

       {showForm && (
         <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm animate-in slide-in-from-top-4">
           <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-gray-800">Nuovo Inserimento</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
           </div>
           <TaxParticipantForm onSuccess={handleSuccess} onCancel={() => setShowForm(false)} />
         </div>
       )}

       <div className="grid grid-cols-1 gap-12">
          <TaxParticipantsList 
            title="Braccialetto" 
            serviceType="BRACELET" 
            refreshTrigger={refreshTrigger}
            currentUserId={currentUserId}
            userRole={userRole}
          />
          <TaxParticipantsList 
            title="Tassa di Soggiorno" 
            serviceType="CITY_TAX" 
            refreshTrigger={refreshTrigger}
            currentUserId={currentUserId}
            userRole={userRole}
          />
          <TaxParticipantsList 
            title="Aria Condizionata" 
            serviceType="AC" 
            refreshTrigger={refreshTrigger}
            currentUserId={currentUserId}
            userRole={userRole}
          />
       </div>
    </div>
  )
}
