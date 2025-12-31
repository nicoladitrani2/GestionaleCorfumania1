'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Users, User, Calendar, Clock, Edit, Home, Map as MapIcon, X, Search, Filter, AlertCircle, History, Euro, Trash2, ChevronDown, Briefcase, ArrowRight } from 'lucide-react'
import { ParticipantForm } from '../excursions/ParticipantForm'
import { ParticipantsList } from './ParticipantsList'
import Link from 'next/link'

interface TransfersManagerProps {
  currentUserId: string
  currentUserRole: string
}

export function TransfersManager({ currentUserId, currentUserRole }: TransfersManagerProps) {
  const [transfers, setTransfers] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState('ACTIVE')
  const [loading, setLoading] = useState(true)
  const [selectedTransfer, setSelectedTransfer] = useState<any>(null)
  
  const [isCreating, setIsCreating] = useState(false)
  const [isAddingParticipant, setIsAddingParticipant] = useState(false)
  const [editingParticipant, setEditingParticipant] = useState<any>(null)
  
  const [viewMode, setViewMode] = useState<'PARTICIPANTS' | 'HISTORY'>('PARTICIPANTS')
  const [newDate, setNewDate] = useState('')
  const [newTransferName, setNewTransferName] = useState('')
  const [newPickupLocation, setNewPickupLocation] = useState('')
  const [newDropoffLocation, setNewDropoffLocation] = useState('')
  const [newEndDate, setNewEndDate] = useState('')
  const [newSupplier, setNewSupplier] = useState('GO4SEA')
  const [suppliers, setSuppliers] = useState<{ id: string, name: string }[]>([])
  
  const [editingTransferId, setEditingTransferId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const [refreshParticipantsTrigger, setRefreshParticipantsTrigger] = useState(0)

  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    fetchTransfers()
    fetchSuppliers()
  }, [activeTab])

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/suppliers')
      if (res.ok) {
        const data = await res.json()
        setSuppliers(data)
      }
    } catch (e) {
      console.error("Failed to fetch suppliers", e)
    }
  }

  // Polling for live updates (every 5 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchTransfers()
    }, 5000)

    return () => clearInterval(interval)
  }, [activeTab])

  useEffect(() => {
    const checkAndFetch = async () => {
      const transferId = searchParams.get('id')
      
      if (!transferId) {
        if (selectedTransfer) setSelectedTransfer(null)
        return
      }

      const found = transfers.find(t => t.id === transferId)
      if (found) {
        setSelectedTransfer(found)
        return
      }

      try {
        const res = await fetch(`/api/transfers?id=${transferId}`)
        if (res.ok) {
          const data = await res.json()
          if (data && data.length > 0) {
             setSelectedTransfer(data[0])
          }
        }
      } catch (e) {
        console.error("Error fetching specific transfer", e)
      }
    }
    
    checkAndFetch()
  }, [searchParams, transfers])

  const fetchTransfers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (activeTab === 'ARCHIVE') params.append('archived', 'true')
      
      const res = await fetch(`/api/transfers?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setTransfers(data)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTransfer = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm(`Sei sicuro di voler eliminare il trasferimento "${name}"? Questa azione è irreversibile.`)) {
      return
    }

    try {
      const res = await fetch(`/api/transfers?id=${id}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        fetchTransfers()
      } else {
        alert('Errore durante l\'eliminazione')
      }
    } catch (e) {
      console.error(e)
      alert('Errore di connessione')
    }
  }

  const handleCreateTransfer = () => {
    setEditingTransferId(null)
    setNewTransferName('')
    setNewDate('')
    setNewPickupLocation('')
    setNewDropoffLocation('')
    setNewEndDate('')
    setNewSupplier(suppliers.length > 0 ? suppliers[0].name : 'GO4SEA')
    setIsCreating(true)
  }

  const toLocalISOString = (dateStr: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const pad = (n: number) => n < 10 ? '0' + n : n
    return date.getFullYear() +
      '-' + pad(date.getMonth() + 1) +
      '-' + pad(date.getDate()) +
      'T' + pad(date.getHours()) +
      ':' + pad(date.getMinutes())
  }

  const handleEditTransfer = (transfer: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingTransferId(transfer.id)
    setNewTransferName(transfer.name)
    setNewDate(toLocalISOString(transfer.date))
    setNewPickupLocation(transfer.pickupLocation || '')
    setNewDropoffLocation(transfer.dropoffLocation || '')
    setNewEndDate(transfer.endDate ? toLocalISOString(transfer.endDate) : '')
    setNewSupplier(transfer.supplier || 'GO4SEA')
    setIsCreating(true)
  }

  const handleSaveTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!newPickupLocation.trim() || !newDropoffLocation.trim()) {
        setError('Inserisci sia il luogo di ritiro che il luogo di deposito.')
        return
    }

    // Validazione date
    const start = new Date(newDate)
    const end = newEndDate ? new Date(newEndDate) : null
    const now = new Date()

    if (!editingTransferId && start < now) {
      setError('La data di partenza non può essere nel passato.')
      return
    }

    if (end && end < start) {
      setError('La data di arrivo non può essere precedente alla data di partenza.')
      return
    }

    try {
      const url = '/api/transfers'
      const method = editingTransferId ? 'PUT' : 'POST'
      
      const generatedName = `${newPickupLocation} -> ${newDropoffLocation}`
      
      const payload = {
        name: generatedName,
        date: newDate,
        endDate: newEndDate || undefined,
        pickupLocation: newPickupLocation,
        dropoffLocation: newDropoffLocation,
        supplier: newSupplier,
      }

      const body = editingTransferId 
        ? { id: editingTransferId, ...payload }
        : payload

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Errore durante il salvataggio')
      }
      
      const savedTransfer = data

      if (editingTransferId && selectedTransfer && editingTransferId === selectedTransfer.id) {
        setSelectedTransfer({
          ...selectedTransfer,
          ...savedTransfer
        })
        setRefreshParticipantsTrigger(prev => prev + 1)
      }

      setIsCreating(false)
      fetchTransfers()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleParticipantSuccess = () => {
    setIsAddingParticipant(false)
    setEditingParticipant(null)
    setRefreshParticipantsTrigger(prev => prev + 1)
    fetchTransfers()
  }

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + 
           date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <>
      {isCreating && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                {editingTransferId ? <Edit className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                {editingTransferId ? 'Modifica Trasferimento' : 'Nuovo Trasferimento'}
              </h3>
              <button 
                onClick={() => setIsCreating(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveTransfer} className="p-6 space-y-5">
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2 border border-red-100">
                   <AlertCircle className="w-4 h-4 shrink-0" />
                   {error}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fornitore</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Briefcase className="h-5 w-5 text-gray-400" />
                  </div>
                  <select
                    value={newSupplier}
                    onChange={(e) => setNewSupplier(e.target.value)}
                    className="block w-full border border-gray-300 rounded-lg p-2.5 pl-10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all appearance-none bg-white"
                  >
                    {suppliers.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                    {suppliers.length === 0 && <option value="GO4SEA">GO4SEA</option>}
                  </select>
                  <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Luogo Ritiro</label>
                  <input
                    type="text"
                    value={newPickupLocation}
                    onChange={(e) => setNewPickupLocation(e.target.value)}
                    required
                    className="block w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                    placeholder="Es. Aeroporto"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Luogo Deposito</label>
                  <input
                    type="text"
                    value={newDropoffLocation}
                    onChange={(e) => setNewDropoffLocation(e.target.value)}
                    required
                    className="block w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                    placeholder="Es. Hotel X"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data e Ora Partenza</label>
                  <input
                    type="datetime-local"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    required
                    className="block w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data e Ora Arrivo (Opz.)</label>
                  <input
                    type="datetime-local"
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="block w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 font-medium shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
                >
                  Salva
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedTransfer ? (
        <div className="space-y-6 animate-in slide-in-from-right duration-300">
          <button 
            onClick={() => router.push('/dashboard/transfers')}
            className="text-gray-500 hover:text-blue-600 font-medium flex items-center gap-2 mb-4 transition-colors px-3 py-2 rounded-lg hover:bg-gray-100 w-fit"
          >
            <Home className="w-4 h-4" />
            Torna alla lista
          </button>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-3xl font-bold text-gray-900">{selectedTransfer.name}</h2>
                  {currentUserRole === 'ADMIN' && (
                    <button 
                      onClick={(e) => handleEditTransfer(selectedTransfer, e)}
                      className="text-gray-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded-full transition-colors"
                      title="Modifica Trasferimento"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg text-blue-800 border border-blue-100">
                    <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-xs text-blue-600 font-semibold uppercase tracking-wider">Partenza</span>
                      <span className="font-medium">{formatDateDisplay(selectedTransfer.date)}</span>
                    </div>
                  </div>
                  
                  {selectedTransfer.endDate && (
                    <div className="flex items-center gap-2 bg-indigo-50 px-3 py-2 rounded-lg text-indigo-800 border border-indigo-100">
                      <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
                      <div className="flex flex-col">
                        <span className="text-xs text-indigo-600 font-semibold uppercase tracking-wider">Arrivo</span>
                        <span className="font-medium">{formatDateDisplay(selectedTransfer.endDate)}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg text-gray-800 border border-gray-100">
                    <Briefcase className="w-4 h-4 text-gray-600 shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Fornitore</span>
                      <span className="font-medium">{selectedTransfer.supplier}</span>
                    </div>
                  </div>

                  {(selectedTransfer.pickupLocation || selectedTransfer.dropoffLocation) && (
                    <div className="flex items-center gap-2 bg-emerald-50 px-3 py-2 rounded-lg text-emerald-800 border border-emerald-100">
                      <MapIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div className="flex flex-col">
                        <span className="text-xs text-emerald-600 font-semibold uppercase tracking-wider">Itinerario</span>
                        <span className="font-medium flex items-center gap-1">
                          {selectedTransfer.pickupLocation || 'N/A'} 
                          <ArrowRight className="w-3 h-3" /> 
                          {selectedTransfer.dropoffLocation || 'N/A'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                 <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-lg border border-gray-100">
                    <Users className="w-5 h-5 text-gray-400" />
                    <div className="flex flex-col">
                        <span className="text-xs text-gray-500 font-medium uppercase">Totale Pax</span>
                        <span className="font-bold text-gray-900 text-lg">
                            {selectedTransfer.participants?.reduce((acc: number, p: any) => acc + (p.groupSize || 1), 0) || 0}
                        </span>
                    </div>
                 </div>
                 <button
                  onClick={() => setIsAddingParticipant(true)}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-2.5 rounded-lg hover:from-blue-700 hover:to-indigo-700 font-medium shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
                >
                  <Plus className="w-5 h-5" />
                  Aggiungi Partecipante
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 border-b border-gray-200">
            <button
              onClick={() => setViewMode('PARTICIPANTS')}
              className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
                viewMode === 'PARTICIPANTS' 
                  ? 'text-blue-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Partecipanti
              {viewMode === 'PARTICIPANTS' && (
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full" />
              )}
            </button>
            {/* Audit log view could be added here later */}
          </div>

          {viewMode === 'PARTICIPANTS' && (
             <ParticipantsList
               transfer={selectedTransfer}
               onEdit={(p) => setEditingParticipant(p)}
               onUpdate={() => setRefreshParticipantsTrigger(prev => prev + 1)}
               refreshTrigger={refreshParticipantsTrigger}
               currentUserId={currentUserId}
               currentUserRole={currentUserRole}
             />
          )}

          {(isAddingParticipant || editingParticipant) && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
                <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex justify-between items-center z-10">
                  <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    {editingParticipant ? <Edit className="w-5 h-5 text-indigo-600" /> : <Users className="w-5 h-5 text-blue-600" />}
                    {editingParticipant ? 'Modifica Partecipante' : 'Nuovo Partecipante'}
                  </h3>
                  <button 
                    onClick={() => {
                      setIsAddingParticipant(false)
                      setEditingParticipant(null)
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div className="p-6">
                  <ParticipantForm
                    onSuccess={handleParticipantSuccess}
                    onCancel={() => {
                      setIsAddingParticipant(false)
                      setEditingParticipant(null)
                    }}
                    initialData={editingParticipant}
                    type="TRANSFER"
                    transferId={selectedTransfer.id}
                    excursionName={selectedTransfer.name}
                    excursionDate={selectedTransfer.date}
                    defaultValues={{
                      pickupLocation: selectedTransfer.pickupLocation || '',
                      dropoffLocation: selectedTransfer.dropoffLocation || '',
                      pickupTime: selectedTransfer.date ? new Date(selectedTransfer.date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '',
                      returnDate: selectedTransfer.endDate ? new Date(selectedTransfer.endDate).toISOString().split('T')[0] : '',
                      // We don't have returnTime in Transfer model, only date.
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6 animate-in slide-in-from-left duration-300">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Gestione Trasferimenti</h1>
                <p className="text-gray-500 text-sm mt-1">Gestisci i trasferimenti e i partecipanti</p>
            </div>
            <button
              onClick={handleCreateTransfer}
              className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-lg hover:bg-gray-800 font-medium shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
            >
              <Plus className="w-5 h-5" />
              Nuovo Trasferimento
            </button>
          </div>

          <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl w-fit">
            {['ACTIVE', 'ARCHIVE'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                  ${activeTab === tab 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}
                `}
              >
                {tab === 'ACTIVE' ? 'Attivi' : 'Archivio'}
              </button>
            ))}
          </div>

          {loading ? (
             <div className="flex justify-center py-12">
               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
             </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {transfers.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-dashed border-gray-300 text-gray-500">
                   <div className="p-4 bg-gray-50 rounded-full mb-4">
                     <MapIcon className="w-8 h-8 text-gray-400" />
                   </div>
                   <p className="text-lg font-medium">Nessun trasferimento trovato</p>
                   <p className="text-sm">Crea un nuovo trasferimento per iniziare</p>
                </div>
              ) : (
                transfers.map((transfer) => (
                  <div 
                    key={transfer.id}
                    onClick={() => {
                        setSelectedTransfer(transfer)
                        // Add to URL
                        const url = new URL(window.location.href)
                        url.searchParams.set('id', transfer.id)
                        window.history.pushState({}, '', url.toString())
                    }}
                    className="group bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2.5 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                        <MapIcon className="w-6 h-6 text-blue-600" />
                      </div>
                      {currentUserRole === 'ADMIN' && (
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button
                             onClick={(e) => handleEditTransfer(transfer, e)}
                             className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                             title="Modifica"
                           >
                             <Edit className="w-4 h-4" />
                           </button>
                           <button
                             onClick={(e) => handleDeleteTransfer(transfer.id, transfer.name, e)}
                             className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                             title="Elimina"
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                        </div>
                      )}
                    </div>

                    <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors line-clamp-1">
                      {transfer.name}
                    </h3>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center text-sm text-gray-500">
                        <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                        {formatDateDisplay(transfer.date)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                      <div className="flex flex-col gap-1 w-full">
                        <div className="flex justify-between items-center w-full">
                           <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {transfer._count?.participants || 0} Pax
                           </span>
                           <span className="text-xs font-medium text-blue-600 group-hover:translate-x-1 transition-transform flex items-center">
                              Gestisci <ChevronDown className="w-3 h-3 ml-1 -rotate-90" />
                           </span>
                        </div>
                        
                        {/* Status Badges */}
                        {transfer.stats && (
                            <div className="flex gap-1 mt-1 flex-wrap">
                                {transfer.stats.paid > 0 && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                                        {transfer.stats.paid} Saldati
                                    </span>
                                )}
                                {transfer.stats.deposit > 0 && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded-full font-medium">
                                        {transfer.stats.deposit} Acconto
                                    </span>
                                )}
                                {transfer.stats.refunded > 0 && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">
                                        {transfer.stats.refunded} Rimb.
                                    </span>
                                )}
                                {transfer.stats.option > 0 && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded-full font-medium">
                                        {transfer.stats.option} Opz.
                                    </span>
                                )}
                            </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </>
  )
}
