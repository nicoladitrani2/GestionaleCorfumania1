'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { ParticipantForm } from '../excursions/ParticipantForm'
import { RentalsList } from './RentalsList'

interface RentalsManagerProps {
  currentUserId: string
  userRole: string
  currentUserSupplierName?: string
  userAgencyId?: string
  agencyDefaultCommission?: number
  agencyCommissionType?: string
}

export function RentalsManager({ 
  currentUserId, 
  userRole, 
  currentUserSupplierName, 
  userAgencyId,
  agencyDefaultCommission,
  agencyCommissionType
}: RentalsManagerProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [editingParticipant, setEditingParticipant] = useState<any>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleSuccess = () => {
    setIsAdding(false)
    setEditingParticipant(null)
    setRefreshTrigger(prev => prev + 1)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestione Noleggi</h1>
          <p className="text-gray-500">Gestisci i noleggi di auto, moto e barche</p>
        </div>
        
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
        >
          <Plus className="w-5 h-5" />
          Nuovo Noleggio
        </button>
      </div>

      <RentalsList 
        currentUserId={currentUserId}
        userRole={userRole}
        refreshTrigger={refreshTrigger}
        onEdit={(p) => setEditingParticipant(p)}
        onUpdate={() => setRefreshTrigger(prev => prev + 1)}
      />

      {(isAdding || editingParticipant) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <ParticipantForm
              onCancel={() => {
                setIsAdding(false)
                setEditingParticipant(null)
              }}
              onSuccess={handleSuccess}
              initialData={editingParticipant}
              type="RENTAL"
              userRole={userRole}
              userAgencyId={userAgencyId}
              agencyDefaultCommission={agencyDefaultCommission}
              agencyCommissionType={agencyCommissionType}
            />
          </div>
        </div>
      )}
    </div>
  )
}
