'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Users, Calendar, Clock, Edit, Home, Map as MapIcon, X, Search, Filter, AlertCircle, History, Euro, Trash2, ChevronDown } from 'lucide-react'
import { ParticipantForm } from './ParticipantForm'
import { ParticipantsList } from './ParticipantsList'
import { AuditLogList } from './AuditLogList'
import Link from 'next/link'

interface ExcursionsManagerProps {
  currentUserId: string
  currentUserRole: string
}

export function ExcursionsManager({ currentUserId, currentUserRole }: ExcursionsManagerProps) {
  const [excursions, setExcursions] = useState<any[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState('ACTIVE')
  const [loading, setLoading] = useState(true)
  const [selectedExcursion, setSelectedExcursion] = useState<any>(null)
  
  const [isCreating, setIsCreating] = useState(false)
  const [isAddingParticipant, setIsAddingParticipant] = useState(false)
  const [editingParticipant, setEditingParticipant] = useState<any>(null)
  
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [viewMode, setViewMode] = useState<'PARTICIPANTS' | 'HISTORY'>('PARTICIPANTS')
  const [newStartDate, setNewStartDate] = useState('')
  const [newEndDate, setNewEndDate] = useState('')
  const [newConfirmationDeadline, setNewConfirmationDeadline] = useState('')
  const [newExcursionName, setNewExcursionName] = useState('')
  const [editingExcursionId, setEditingExcursionId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false)

  const [refreshParticipantsTrigger, setRefreshParticipantsTrigger] = useState(0)

  // State for suppliers and commissions
  const [suppliers, setSuppliers] = useState<{ id: string, name: string }[]>([])
  const [commissions, setCommissions] = useState<{ supplierId: string, percentage: string }[]>([])

  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    fetchTemplates()
    fetchSuppliers()
  }, [])

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/suppliers')
      if (res.ok) {
        const data = await res.json()
        setSuppliers(data)
        // Initialize commissions empty, we'll fill it if editing or leave empty
        if (!editingExcursionId) {
             setCommissions(data.map((s: any) => ({ supplierId: s.id, percentage: '' })))
        }
      }
    } catch (e) {
      console.error('Error fetching suppliers:', e)
    }
  }

  useEffect(() => {
    fetchExcursions()
  }, [activeTab])

  // Polling for live updates (every 5 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchExcursions()
    }, 5000)

    return () => clearInterval(interval)
  }, [activeTab]) // Re-run when tab changes

  useEffect(() => {
    const checkAndFetch = async () => {
      const excursionId = searchParams.get('id')
      
      if (!excursionId) {
        // Only clear if we have something selected and it was likely selected via URL
        // But actually, if URL has no ID, we probably should deselect to match URL state
        if (selectedExcursion) setSelectedExcursion(null)
        return
      }

      // Check if already in list
      const found = excursions.find(e => e.id === excursionId)
      if (found) {
        // Only reset creation mode if we're switching to a different excursion
        if (selectedExcursion?.id !== found.id) {
          setIsCreating(false)
        }
        setSelectedExcursion(found)
        return
      }

      // If not in list, fetch it
      try {
        const res = await fetch(`/api/excursions?id=${excursionId}`)
        if (res.ok) {
          const data = await res.json()
          if (data && data.length > 0) {
             setSelectedExcursion(data[0])
             setIsCreating(false)
          }
        }
      } catch (e) {
        console.error("Error fetching specific excursion", e)
      }
    }
    
    checkAndFetch()
  }, [searchParams, excursions])

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/excursions/templates')
      if (res.ok) setTemplates(await res.json())
    } catch (e) { console.error(e) }
  }

  const fetchExcursions = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (activeTab === 'ARCHIVE') params.append('archived', 'true')
      
      const res = await fetch(`/api/excursions?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setExcursions(data)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteExcursion = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm(`Sei sicuro di voler eliminare l'escursione "${name}"? Questa azione è irreversibile.`)) {
      return
    }

    try {
      const res = await fetch(`/api/excursions?id=${id}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        fetchExcursions()
      } else {
        alert('Errore durante l\'eliminazione')
      }
    } catch (e) {
      console.error(e)
      alert('Errore di connessione')
    }
  }

  const handleClearArchive = async () => {
    if (!window.confirm('Sei sicuro di voler svuotare l\'archivio? Tutte le escursioni passate verranno eliminate definitivamente.')) {
      return
    }

    try {
      const res = await fetch(`/api/excursions?archived=true`, {
        method: 'DELETE'
      })

      if (res.ok) {
        fetchExcursions()
      } else {
        alert('Errore durante lo svuotamento dell\'archivio')
      }
    } catch (e) {
      console.error(e)
      alert('Errore di connessione')
    }
  }

  const handleCreateExcursion = () => {
    setEditingExcursionId(null)
    setNewExcursionName('')
    setNewStartDate('')
    setNewEndDate('')
    setNewConfirmationDeadline('')
    setSelectedTemplateId('')
    // Reset commissions
    setCommissions(suppliers.map(s => ({ supplierId: s.id, percentage: '' })))
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

  const handleEditExcursion = (excursion: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingExcursionId(excursion.id)
    setNewExcursionName(excursion.name)
    setNewStartDate(toLocalISOString(excursion.startDate))
    setNewEndDate(toLocalISOString(excursion.endDate))
    setNewConfirmationDeadline(toLocalISOString(excursion.confirmationDeadline))
    setSelectedTemplateId('') // Custom edit
    
    // Populate commissions
    if (excursion.commissions) {
      setCommissions(suppliers.map(s => {
        const comm = excursion.commissions.find((c: any) => c.supplierId === s.id)
        return {
          supplierId: s.id,
          percentage: comm ? comm.commissionPercentage.toString() : ''
        }
      }))
    } else {
      setCommissions(suppliers.map(s => ({ supplierId: s.id, percentage: '' })))
    }
    
    setIsCreating(true)
  }

  const handleDeleteTemplate = async (templateId: string, templateName: string) => {
    if (!window.confirm(`Sei sicuro di voler eliminare il template "${templateName}"?`)) {
      return
    }

    try {
      const res = await fetch(`/api/excursions/templates?id=${templateId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        setTemplates(templates.filter(t => t.id !== templateId))
        setSelectedTemplateId('')
        setNewExcursionName('')
      } else {
        alert('Errore durante l\'eliminazione del template')
      }
    } catch (e) {
      console.error(e)
      alert('Errore di connessione')
    }
  }

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const templateId = e.target.value
    setSelectedTemplateId(templateId)
    
    if (templateId === 'OTHER') {
      setNewExcursionName('')
    } else if (templateId) {
      const template = templates.find(t => t.id === templateId)
      if (template) setNewExcursionName(template.name)
    }
  }

  const handleSaveExcursion = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate dates
    const start = new Date(newStartDate)
    const end = newEndDate ? new Date(newEndDate) : null
    const deadline = newConfirmationDeadline ? new Date(newConfirmationDeadline) : null
    const now = new Date()

    // Controllo data passata (solo per nuovi inserimenti)
    if (!editingExcursionId && start < now) {
      setError('La data di inizio non può essere nel passato.')
      return
    }

    if (end && end < start) {
      setError('La data di fine non può essere precedente alla data di inizio.')
      return
    }

    if (deadline && deadline > start) {
      setError('La data di scadenza non può essere successiva alla data di inizio dell\'escursione.')
      return
    }

    try {
      const url = '/api/excursions'
      const method = editingExcursionId ? 'PUT' : 'POST'
      const payload = {
        name: newExcursionName,
        startDate: newStartDate,
        endDate: newEndDate,
        confirmationDeadline: newConfirmationDeadline || newStartDate, // Default to startDate
        commissions // Add commissions
      }

      const body = editingExcursionId 
        ? { id: editingExcursionId, ...payload }
        : payload

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) throw new Error('Errore durante il salvataggio')
      
      const savedExcursion = await res.json()

      // Update selectedExcursion if we are editing it
      if (editingExcursionId && selectedExcursion && editingExcursionId === selectedExcursion.id) {
        setSelectedExcursion({
          ...selectedExcursion,
          ...savedExcursion
        })
        setRefreshParticipantsTrigger(prev => prev + 1)
      }

      setIsCreating(false)
      fetchExcursions()
      fetchTemplates() // Refresh templates as new one might have been added
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleParticipantSuccess = () => {
    setIsAddingParticipant(false)
    setEditingParticipant(null)
    setRefreshParticipantsTrigger(prev => prev + 1)
    fetchExcursions() // Update counts
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
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 sm:px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                {editingExcursionId ? <Edit className="w-5 h-5 sm:w-6 sm:h-6" /> : <Plus className="w-5 h-5 sm:w-6 sm:h-6" />}
                {editingExcursionId ? 'Modifica Escursione' : 'Nuova Escursione'}
              </h3>
              <button 
                onClick={() => setIsCreating(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveExcursion} className="p-4 sm:p-6 space-y-5">
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2 border border-red-100">
                   <AlertCircle className="w-4 h-4 shrink-0" />
                   {error}
                </div>
              )}
              {!editingExcursionId && (
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-1">Template</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsTemplateDropdownOpen(!isTemplateDropdownOpen)}
                      className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 text-left flex justify-between items-center transition-all text-base md:text-sm"
                    >
                      <span className="truncate">
                        {selectedTemplateId === 'OTHER' 
                          ? 'Altro (inserisci manuale)' 
                          : templates.find(t => t.id === selectedTemplateId)?.name || 'Seleziona template...'}
                      </span>
                      <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isTemplateDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isTemplateDropdownOpen && (
                      <>
                        <div 
                          className="fixed inset-0 z-10" 
                          onClick={() => setIsTemplateDropdownOpen(false)} 
                        />
                        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                          <ul className="py-1 text-sm text-gray-900">
                            <li 
                              className="px-4 py-2 hover:bg-gray-50 cursor-pointer text-gray-400 italic"
                              onClick={() => {
                                setSelectedTemplateId('')
                                setNewExcursionName('')
                                setIsTemplateDropdownOpen(false)
                              }}
                            >
                              Nessuna selezione
                            </li>
                            {templates.map((t) => (
                              <li key={t.id} className="flex items-center justify-between hover:bg-gray-50 group border-t border-gray-50">
                                <div 
                                  className="flex-grow px-4 py-2.5 cursor-pointer"
                                  onClick={() => {
                                    setSelectedTemplateId(t.id)
                                    setNewExcursionName(t.name)
                                    setIsTemplateDropdownOpen(false)
                                  }}
                                >
                                  {t.name}
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteTemplate(t.id, t.name)
                                  }}
                                  className="mr-2 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                  title="Elimina template"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </li>
                            ))}
                            <li 
                              className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer text-blue-600 font-medium border-t border-gray-100 flex items-center gap-2"
                              onClick={() => {
                                setSelectedTemplateId('OTHER')
                                setNewExcursionName('')
                                setIsTemplateDropdownOpen(false)
                              }}
                            >
                              <Plus className="w-4 h-4" />
                              Altro (inserisci manuale)
                            </li>
                          </ul>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-1">Nome Escursione</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MapIcon className="h-5 w-5 text-gray-500" />
                  </div>
                  <input
                    type="text"
                    value={newExcursionName}
                    onChange={(e) => setNewExcursionName(e.target.value)}
                    required
                    className="block w-full border border-gray-300 rounded-lg p-2.5 pl-10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-base md:text-sm text-gray-900 placeholder-gray-500"
                    placeholder="Es. Tour dell'Isola"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-1">Inizio</label>
                  <input
                    type="datetime-local"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    required
                    className="block w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-base md:text-sm text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-1">Fine</label>
                  <input
                    type="datetime-local"
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="block w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-base md:text-sm text-gray-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-1">Data Limite Conferma</label>
                <input
                  type="datetime-local"
                  value={newConfirmationDeadline}
                  onChange={(e) => setNewConfirmationDeadline(e.target.value)}
                  className="block w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-base md:text-sm text-gray-900"
                />
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Se vuoto, usa data inizio.
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Commissioni Fornitori (%)</label>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-3 max-h-40 overflow-y-auto">
                  {suppliers.length === 0 && <p className="text-sm text-gray-500 italic">Nessun fornitore disponibile.</p>}
                  {suppliers.map(supplier => (
                    <div key={supplier.id} className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-gray-700 truncate flex-1" title={supplier.name}>{supplier.name}</span>
                      <div className="relative w-24">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          placeholder="0"
                          value={commissions.find(c => c.supplierId === supplier.id)?.percentage || ''}
                          onChange={(e) => {
                            const val = e.target.value
                            setCommissions(prev => prev.map(c => 
                              c.supplierId === supplier.id ? { ...c, percentage: val } : c
                            ))
                          }}
                          className="block w-full border border-gray-300 rounded-md py-1 px-2 text-right pr-6 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                        <span className="absolute right-2 top-1.5 text-gray-400 text-xs">%</span>
                      </div>
                    </div>
                  ))}
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

      {selectedExcursion ? (
        <div className="space-y-6 animate-in slide-in-from-right duration-300">
          <button 
            onClick={() => router.push('/dashboard/excursions')}
            className="text-gray-500 hover:text-blue-600 font-medium flex items-center gap-2 mb-4 transition-colors px-3 py-2 rounded-lg hover:bg-gray-100 w-fit"
          >
            <Home className="w-4 h-4" />
            Torna alla lista
          </button>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-3xl font-bold text-gray-900">{selectedExcursion.name}</h2>
                  {currentUserRole === 'ADMIN' && (
                    <button 
                      onClick={(e) => handleEditExcursion(selectedExcursion, e)}
                      className="text-gray-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded-full transition-colors"
                      title="Modifica Escursione"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg text-blue-800 border border-blue-100">
                    <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-xs text-blue-600 font-semibold uppercase tracking-wide">Inizio</span>
                      <span className="font-medium font-mono">{formatDateDisplay(selectedExcursion.startDate)}</span>
                    </div>
                  </div>
                  {selectedExcursion.endDate && (
                    <div className="flex items-center gap-2 bg-indigo-50 px-3 py-2 rounded-lg text-indigo-800 border border-indigo-100">
                      <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
                      <div className="flex flex-col">
                        <span className="text-xs text-indigo-600 font-semibold uppercase tracking-wide">Fine</span>
                        <span className="font-medium font-mono">{formatDateDisplay(selectedExcursion.endDate)}</span>
                      </div>
                    </div>
                  )}
                  {selectedExcursion.confirmationDeadline && (
                    <div className="flex items-center gap-2 bg-amber-50 px-3 py-2 rounded-lg text-amber-800 border border-amber-100">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                      <div className="flex flex-col">
                        <span className="text-xs text-amber-600 font-semibold uppercase tracking-wide">Scadenza</span>
                        <span className="font-medium font-mono">{formatDateDisplay(selectedExcursion.confirmationDeadline)}</span>
                      </div>
                    </div>
                  )}
                  {/* Commission Display for Assistants */}
                  {currentUserRole !== 'ADMIN' && selectedExcursion.commissions && selectedExcursion.commissions.length > 0 && (
                     <div className="flex items-center gap-2 bg-emerald-50 px-3 py-2 rounded-lg text-emerald-800 border border-emerald-100">
                      <Euro className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div className="flex flex-col">
                        <span className="text-xs text-emerald-600 font-semibold uppercase tracking-wide">La tua Commissione</span>
                        <span className="font-medium font-mono">{selectedExcursion.commissions[0].commissionPercentage}%</span>
                      </div>
                    </div>
                  )}
                  {currentUserRole === 'ADMIN' && (selectedExcursion.totalCollected !== undefined) && (
                    <div className="flex items-center gap-2 bg-green-50 px-3 py-2 rounded-lg text-green-800 border border-green-100">
                      <Euro className="w-4 h-4 text-green-600 shrink-0" />
                      <div className="flex flex-col">
                        <span className="text-xs text-green-600 font-semibold uppercase tracking-wide">Incasso</span>
                        <span className="font-medium font-mono">€ {selectedExcursion.totalCollected.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setIsAddingParticipant(true)}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 flex items-center gap-2 shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 font-medium whitespace-nowrap"
              >
                <Plus className="w-5 h-5" />
                Aggiungi Partecipante
              </button>
            </div>
          </div>

          <div className="flex gap-4 border-b border-gray-200">
            <button
              onClick={() => setViewMode('PARTICIPANTS')}
              className={`pb-3 px-1 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
                viewMode === 'PARTICIPANTS'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Users className="w-4 h-4" />
              Partecipanti
            </button>
            <button
              onClick={() => setViewMode('HISTORY')}
              className={`pb-3 px-1 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
                viewMode === 'HISTORY'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <History className="w-4 h-4" />
              Cronologia
            </button>
          </div>

          {(isAddingParticipant || editingParticipant) && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 sm:p-4 animate-in fade-in duration-200">
              <div className="w-full max-w-5xl h-full sm:h-[90vh] bg-white sm:rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
                <ParticipantForm
                  excursionId={selectedExcursion.id}
                  excursionName={selectedExcursion.name}
                  excursionDate={selectedExcursion.startDate}
                  initialData={editingParticipant}
                  onSuccess={handleParticipantSuccess}
                  onCancel={() => {
                    setIsAddingParticipant(false)
                    setEditingParticipant(null)
                  }}
                />
              </div>
            </div>
          )}

          {viewMode === 'PARTICIPANTS' ? (
            <ParticipantsList 
              excursion={selectedExcursion}
              key={refreshParticipantsTrigger}
              refreshTrigger={refreshParticipantsTrigger}
              onEdit={setEditingParticipant}
              onUpdate={fetchExcursions}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
            />
          ) : (
            <AuditLogList excursionId={selectedExcursion.id} />
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <Link href="/dashboard" className="text-gray-500 hover:text-blue-600 flex items-center gap-1 text-sm font-medium transition-colors">
              <Home className="w-4 h-4" />
              Home
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-gray-900 font-medium text-sm">Escursioni</span>
          </div>

          <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Filter className="w-5 h-5 text-blue-600" />
              </div>
              <nav className="flex gap-2">
                <button
                  onClick={() => setActiveTab('ACTIVE')}
                  className={`py-2 px-4 rounded-lg font-medium text-sm transition-all ${
                    activeTab === 'ACTIVE'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  In Programma
                </button>
                <button
                  onClick={() => setActiveTab('ARCHIVE')}
                  className={`py-2 px-4 rounded-lg font-medium text-sm transition-all ${
                    activeTab === 'ARCHIVE'
                      ? 'bg-gray-800 text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Archivio
                </button>
              </nav>
            </div>

            {currentUserRole === 'ADMIN' && (
              <div className="flex gap-2">
                {activeTab === 'ARCHIVE' && excursions.length > 0 && (
                  <button
                    onClick={handleClearArchive}
                    className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 flex items-center gap-2 shadow-sm transition-all font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
                    Svuota Archivio
                  </button>
                )}
                <button
                  onClick={handleCreateExcursion}
                  className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 flex items-center gap-2 shadow-sm hover:shadow transition-all transform hover:-translate-y-0.5 font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Nuova Escursione
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {excursions.map((excursion) => (
              <div 
                key={excursion.id} 
                className="group bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-200 flex flex-col overflow-hidden hover:-translate-y-1"
              >
                <div className="p-6 flex-grow cursor-pointer" onClick={() => router.push(`/dashboard/excursions?id=${excursion.id}`)}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                        <MapIcon className="w-6 h-6 text-blue-600" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 line-clamp-2 group-hover:text-blue-600 transition-colors pt-1">
                        {excursion.name}
                      </h3>
                    </div>
                    {currentUserRole === 'ADMIN' && (
                      <div className="flex gap-1">
                        {activeTab === 'ARCHIVE' && (
                          <button 
                            onClick={(e) => handleDeleteExcursion(excursion.id, excursion.name, e)}
                            className="text-gray-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-full transition-colors"
                            title="Elimina Escursione"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <button 
                          onClick={(e) => handleEditExcursion(excursion, e)}
                          className="text-gray-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded-full transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-3 text-sm text-gray-600 mt-4">
                    <div className="flex flex-col gap-2 p-3 rounded-lg bg-gray-50 border border-gray-100">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-blue-600 uppercase w-10">Inizio</span>
                        <span className="font-mono text-gray-800">{formatDateDisplay(excursion.startDate)}</span>
                      </div>
                      {excursion.endDate && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-indigo-600 uppercase w-10">Fine</span>
                          <span className="font-mono text-gray-800">{formatDateDisplay(excursion.endDate)}</span>
                        </div>
                      )}
                      {excursion.confirmationDeadline && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-amber-600 uppercase w-10">Scad.</span>
                          <span className="font-mono text-gray-800">{formatDateDisplay(excursion.confirmationDeadline)}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                      <div className="flex -space-x-2 overflow-hidden">
                        <div className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-blue-100 flex items-center justify-center">
                          <Users className="h-4 w-4 text-blue-600" />
                        </div>
                      </div>
                      <span className="font-medium text-gray-700 ml-2">
                        {excursion._count?.participants || 0} Partecipanti
                      </span>
                      {currentUserRole === 'ADMIN' && (excursion.totalCollected !== undefined) && (
                        <div className="ml-auto flex items-center gap-1 bg-green-50 px-2 py-1 rounded text-green-700 border border-green-100">
                          <Euro className="w-3 h-3" />
                          <span className="font-mono font-medium text-sm">
                            {excursion.totalCollected.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                  <button
                    onClick={() => router.push(`/dashboard/excursions?id=${excursion.id}`)}
                    className="w-full py-2.5 px-4 bg-white border border-gray-200 rounded-lg shadow-sm text-sm font-semibold text-gray-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 flex items-center justify-center gap-2 transition-all"
                  >
                    <Users className="w-4 h-4" />
                    Gestisci Partecipanti
                  </button>
                </div>
              </div>
            ))}
            
            {excursions.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-gray-500 bg-white rounded-xl border-2 border-dashed border-gray-300">
                <div className="p-4 bg-gray-50 rounded-full mb-4">
                  <Search className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">Nessuna escursione trovata</h3>
                <p className="text-gray-500 mt-1">Non ci sono escursioni in questa sezione al momento.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
