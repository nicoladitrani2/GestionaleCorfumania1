'use client'

import { useState, useEffect } from 'react'
import { Save, X, User, Calendar, Home, CheckSquare, Square } from 'lucide-react'

interface TaxParticipantFormProps {
  onSuccess: () => void
  onCancel: () => void
  initialData?: any
  isEditing?: boolean
}

export function TaxParticipantForm({ onSuccess, onCancel, initialData, isEditing = false }: TaxParticipantFormProps) {
  const [formData, setFormData] = useState({
    firstName: initialData?.firstName || '',
    lastName: initialData?.lastName || '',
    dateOfBirth: initialData?.dateOfBirth ? new Date(initialData.dateOfBirth).toISOString().split('T')[0] : '',
    nationality: initialData?.nationality || 'IT',
    roomNumber: initialData?.roomNumber || '',
    selectedServices: initialData?.selectedServices || [] as string[]
  })
  
  // If editing, we might need to populate selectedServices based on the participant's actual service
  // But wait, the form is designed to add a NEW participant with services.
  // Editing a participant usually means editing ONE participant entry which corresponds to ONE service type in the DB logic (since we create one participant record per service usually, or do we?)
  // Let's check the API logic.
  // The API creates one participant per service selected.
  // So when editing, we are editing a SINGLE participant record which has a SINGLE specialServiceType.
  // So `selectedServices` in edit mode should probably just be that one service, and maybe we disable changing the service type to avoid complex logic of deleting/creating records.
  
  useEffect(() => {
    if (isEditing && initialData?.specialServiceType) {
      setFormData(prev => ({
        ...prev,
        selectedServices: [initialData.specialServiceType]
      }))
    }
  }, [isEditing, initialData])
  
  const [prices, setPrices] = useState({
    BRACELET: 0,
    CITY_TAX: 2,
    AC: 5
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Calculate Bracelet price based on DOB
  useEffect(() => {
    if (formData.dateOfBirth) {
      const dob = new Date(formData.dateOfBirth)
      const ageDifMs = Date.now() - dob.getTime()
      const ageDate = new Date(ageDifMs)
      const age = Math.abs(ageDate.getUTCFullYear() - 1970)
      
      setPrices(prev => ({
        ...prev,
        BRACELET: age < 12 ? 5 : 10
      }))
    } else {
       setPrices(prev => ({
        ...prev,
        BRACELET: 10 // Default adult
      }))
    }
  }, [formData.dateOfBirth])

  const toggleService = (service: string) => {
    setFormData(prev => ({
      ...prev,
      selectedServices: prev.selectedServices.includes(service)
        ? prev.selectedServices.filter(s => s !== service)
        : [...prev.selectedServices, service]
    }))
  }

  const getTotalPrice = () => {
    return formData.selectedServices.reduce((acc, service) => {
      return acc + (prices as any)[service]
    }, 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!formData.firstName || !formData.lastName) {
      setError('Nome e Cognome sono obbligatori')
      return
    }

    if (formData.selectedServices.length === 0) {
      setError('Seleziona almeno un servizio')
      return
    }

    setLoading(true)

    try {
      const url = isEditing ? `/api/taxes/${initialData.id}` : '/api/taxes'
      const method = isEditing ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        onSuccess()
      } else {
        const msg = await res.text()
        setError(msg || 'Errore durante il salvataggio')
      }
    } catch (err) {
      console.error(err)
      setError('Errore di connessione')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-800">{isEditing ? 'Modifica Partecipante' : 'Aggiungi Servizio Extra'}</h2>
            <p className="text-sm text-gray-500">Tassa di soggiorno e non commissionabile</p>
          </div>
          <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <User className="w-4 h-4 text-blue-500" />
                Nome
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={e => setFormData({...formData, firstName: e.target.value})}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                placeholder="Mario"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <User className="w-4 h-4 text-transparent" />
                Cognome
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={e => setFormData({...formData, lastName: e.target.value})}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                placeholder="Rossi"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-orange-500" />
                Data di Nascita
              </label>
              <input
                type="date"
                value={formData.dateOfBirth}
                onChange={e => setFormData({...formData, dateOfBirth: e.target.value})}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              />
              <p className="text-xs text-gray-400">Necessaria per calcolo costo Braccialetto</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Home className="w-4 h-4 text-purple-500" />
                Numero Stanza (Opzionale)
              </label>
              <input
                type="text"
                value={formData.roomNumber}
                onChange={e => setFormData({...formData, roomNumber: e.target.value})}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                placeholder="Es. 104"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-gray-800 border-b pb-2">Seleziona Servizi</h3>
            
            <div className="grid grid-cols-1 gap-3">
              {/* Braccialetto */}
              <div 
                className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                  formData.selectedServices.includes('BRACELET') 
                    ? 'bg-blue-50 border-blue-200 shadow-sm' 
                    : 'bg-white border-gray-200 hover:border-blue-300'
                } ${isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => !isEditing && toggleService('BRACELET')}
              >
                <div className="flex items-center gap-3">
                  {formData.selectedServices.includes('BRACELET') 
                    ? <CheckSquare className="w-5 h-5 text-blue-600" /> 
                    : <Square className="w-5 h-5 text-gray-400" />
                  }
                  <div>
                    <p className="font-medium text-gray-900">Braccialetto</p>
                    <p className="text-sm text-gray-500">Accesso servizi resort</p>
                  </div>
                </div>
                <p className="font-bold text-blue-700">€ {prices.BRACELET.toFixed(2)}</p>
              </div>

              {/* Tassa Soggiorno */}
              <div 
                className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                  formData.selectedServices.includes('CITY_TAX') 
                    ? 'bg-blue-50 border-blue-200 shadow-sm' 
                    : 'bg-white border-gray-200 hover:border-blue-300'
                } ${isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => !isEditing && toggleService('CITY_TAX')}
              >
                <div className="flex items-center gap-3">
                  {formData.selectedServices.includes('CITY_TAX') 
                    ? <CheckSquare className="w-5 h-5 text-blue-600" /> 
                    : <Square className="w-5 h-5 text-gray-400" />
                  }
                  <div>
                    <p className="font-medium text-gray-900">Tassa di Soggiorno</p>
                    <p className="text-sm text-gray-500">Costo per stanza</p>
                  </div>
                </div>
                <p className="font-bold text-blue-700">€ {prices.CITY_TAX.toFixed(2)}</p>
              </div>

              {/* Aria Condizionata */}
              <div 
                className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                  formData.selectedServices.includes('AC') 
                    ? 'bg-blue-50 border-blue-200 shadow-sm' 
                    : 'bg-white border-gray-200 hover:border-blue-300'
                } ${isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => !isEditing && toggleService('AC')}
              >
                <div className="flex items-center gap-3">
                  {formData.selectedServices.includes('AC') 
                    ? <CheckSquare className="w-5 h-5 text-blue-600" /> 
                    : <Square className="w-5 h-5 text-gray-400" />
                  }
                  <div>
                    <p className="font-medium text-gray-900">Aria Condizionata</p>
                    <p className="text-sm text-gray-500">Supplemento stanza</p>
                  </div>
                </div>
                <p className="font-bold text-blue-700">€ {prices.AC.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
             <div>
               <p className="text-sm text-gray-500">Totale stimato</p>
               <p className="text-2xl font-bold text-gray-900">€ {getTotalPrice().toFixed(2)}</p>
             </div>
             <div className="flex gap-3">
               <button
                 type="button"
                 onClick={onCancel}
                 className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-200 transition-all"
               >
                 Annulla
               </button>
               <button
                 type="submit"
                 disabled={loading}
                 className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/30"
               >
                 <Save className="w-4 h-4" />
                 {loading ? 'Salvataggio...' : 'Salva'}
               </button>
             </div>
          </div>
        </form>
      </div>
    </div>
  )
}
