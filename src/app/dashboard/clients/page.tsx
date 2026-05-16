'use client'

import { useState, useEffect } from 'react'
import { Search, RefreshCw, Mail, Phone, Calendar, Clock, ChevronRight, Map, Car, Key, Users, Trash2 } from 'lucide-react'
import { ClientHistoryModal } from './ClientHistoryModal'
import { EmailModal } from './EmailModal'
import { ConfirmationModal } from '../components/ConfirmationModal'

interface ClientParticipant {
  id: string
  name: string
  createdAt: string
  totalPrice: number
  paidAmount: number
  paymentType: string
  adults?: number
  children?: number
  infants?: number
  notes?: string
  rentalStartDate?: string
  excursion?: { id: string; name: string; startDate: string }
  transfer?: { id: string; name: string; date: string }
  rental?: { id: string; name: string; type: string }
  pickupLocation?: string
  dropoffLocation?: string
}

interface Client {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phoneNumber: string | null
  nationality: string | null
  serviceType: string | null
  createdAt: string
  isManuallyContacted: boolean
  lastEmailSentAt: string | null
  _count: {
    participants: number
  }
  associatedNames: string[]
  derivedServiceTypes: string[]
  servicePaxByType?: Record<string, number>
  nextEventStartDate?: string | null
  participants: ClientParticipant[]
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ processed: number, remaining: number } | null>(null)
  const [clientsMode, setClientsMode] = useState<'MARKETING' | 'RUBRICA'>('MARKETING')
  
  // Modal states
  const [historyClient, setHistoryClient] = useState<Client | null>(null)
  const [historyServiceFilter, setHistoryServiceFilter] = useState<'EXCURSION' | 'TRANSFER' | 'RENTAL' | null>(null)
  const [emailClient, setEmailClient] = useState<{ id: string, email: string, name: string } | null>(null)

  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [activeTab, setActiveTab] = useState<'ALL' | 'EXCURSION' | 'TRANSFER' | 'RENTAL'>('ALL')
  const [showResetModal, setShowResetModal] = useState(false)
  const [showCleanupModal, setShowCleanupModal] = useState(false)
  const [cleaningUp, setCleaningUp] = useState(false)
  const [cleanupResult, setCleanupResult] = useState<{ deleted: number } | null>(null)

  useEffect(() => {
    fetchClients()
  }, [])

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients', { cache: 'no-store' })
      if (res.ok) {
        const data: Client[] = await res.json()
        const years = Array.from(new Set(data.map(getLastActivityYear))).sort((a, b) => b - a)
        setClients(data)
        if (years.length > 0) {
          setSelectedYear(years[0])
        }
      }
    } catch (error) {
      console.error('Error fetching clients:', error)
    } finally {
      setLoading(false)
    }
  }

  function getLastActivityYear(client: Client): number {
    if (!client.participants || client.participants.length === 0) {
      return new Date(client.createdAt).getFullYear()
    }

    const dates = client.participants.map(p => {
      let dateStr = p.createdAt
      if (p.excursion?.startDate) dateStr = p.excursion.startDate
      else if (p.transfer?.date) dateStr = p.transfer.date
      else if (p.rentalStartDate) dateStr = p.rentalStartDate
      else if (p.rental) dateStr = p.createdAt
      
      return new Date(dateStr).getTime()
    })

    const maxDate = Math.max(...dates)
    return new Date(maxDate).getFullYear()
  }

  const todayStart = (() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  })()

  const getParticipantEventDate = (p: ClientParticipant): Date | null => {
    const dateStr =
      p.excursion?.startDate ||
      p.transfer?.date ||
      p.rentalStartDate ||
      p.createdAt
    const d = new Date(dateStr)
    return Number.isNaN(d.getTime()) ? null : d
  }

  const isUpcomingParticipant = (p: ClientParticipant): boolean => {
    const d = getParticipantEventDate(p)
    return !!d && d.getTime() >= todayStart.getTime()
  }

  const getRubricaYear = (client: Client): number | null => {
    if (!client.nextEventStartDate) return null
    const d = new Date(client.nextEventStartDate)
    return Number.isNaN(d.getTime()) ? null : d.getFullYear()
  }

  const getServiceTypesForClient = (client: Client): string[] => {
    if (clientsMode !== 'RUBRICA') {
      return client.derivedServiceTypes.length > 0
        ? client.derivedServiceTypes
        : (client.serviceType ? [client.serviceType] : [])
    }

    const types = new Set<string>()
    for (const p of client.participants || []) {
      if (!isUpcomingParticipant(p)) continue
      if (p.excursion) types.add('EXCURSION')
      if (p.transfer) types.add('TRANSFER')
      if (p.rental) types.add('RENTAL')
    }
    return Array.from(types)
  }

  const getUpcomingParticipantsCount = (client: Client): number => {
    const list = client.participants || []
    return list.reduce((sum, p) => sum + (isUpcomingParticipant(p) ? 1 : 0), 0)
  }

  const getUpcomingPaxByType = (client: Client): Record<string, number> => {
    const next: Record<string, number> = { EXCURSION: 0, TRANSFER: 0, RENTAL: 0 }
    for (const p of client.participants || []) {
      if (!isUpcomingParticipant(p)) continue
      const pax = Math.max(1, (p.adults || 0) + (p.children || 0) + (p.infants || 0))
      if (p.excursion) next.EXCURSION += pax
      if (p.transfer) next.TRANSFER += pax
      if (p.rental) next.RENTAL += pax
    }
    return next
  }

  const availableYears =
    clientsMode === 'RUBRICA'
      ? Array.from(new Set(clients.map(getRubricaYear).filter((y): y is number => typeof y === 'number'))).sort((a, b) => b - a)
      : Array.from(new Set(clients.map(getLastActivityYear))).sort((a, b) => b - a)

  const availableYearsKey = availableYears.join(',')

  useEffect(() => {
    if (availableYears.length === 0) return
    if (!availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0])
    }
  }, [clientsMode, availableYearsKey, selectedYear])

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/clients/sync', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setSyncResult({ processed: data.processed, remaining: data.remaining })
        fetchClients()
      }
    } catch (error) {
      console.error('Sync error:', error)
    } finally {
      setSyncing(false)
    }
  }

  const toggleManualContact = async (clientId: string, currentStatus: boolean) => {
    // Optimistic update
    setClients(prev => prev.map(c => 
      c.id === clientId ? { ...c, isManuallyContacted: !currentStatus } : c
    ))

    try {
      await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isManuallyContacted: !currentStatus })
      })
    } catch (error) {
      console.error('Error updating contact status:', error)
      fetchClients() // Revert on error
    }
  }

  const filteredClientsRaw = clients.filter(client => {
    const matchesSearch = client.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (client.email && client.email.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesYear =
      clientsMode === 'RUBRICA'
        ? (getRubricaYear(client) === selectedYear)
        : (getLastActivityYear(client) === selectedYear)

    if (clientsMode === 'RUBRICA' && !client.nextEventStartDate) return false
    if (clientsMode === 'RUBRICA' && getUpcomingParticipantsCount(client) === 0) return false

    const serviceTypes = getServiceTypesForClient(client)

    const matchesTab =
      activeTab === 'ALL'
        ? true
        : serviceTypes.includes(activeTab)

    return matchesSearch && matchesYear && matchesTab
  })

  const filteredClients = [...filteredClientsRaw].sort((a, b) => {
    const aTs = a.nextEventStartDate ? new Date(a.nextEventStartDate).getTime() : Number.POSITIVE_INFINITY
    const bTs = b.nextEventStartDate ? new Date(b.nextEventStartDate).getTime() : Number.POSITIVE_INFINITY
    if (aTs !== bTs) return aTs - bTs
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Anagrafica Clienti</h1>
          <p className="text-sm text-gray-500 mt-1">Elenco di tutti i clienti registrati e storico attività</p>
          {cleanupResult && (
            <p className="text-xs text-green-600 mt-1">
              Prenotazioni eliminate: {cleanupResult.deleted}
            </p>
          )}
          {syncResult && (
            <p className="text-xs text-green-600 mt-1">
              Sincronizzati: {syncResult.processed}. Rimanenti da sincronizzare: {syncResult.remaining}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          {clientsMode === 'RUBRICA' && (
            <button
              onClick={() => setShowCleanupModal(true)}
              disabled={cleaningUp}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg shadow-sm transition-all ${
                cleaningUp
                  ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                  : 'bg-white text-red-700 border border-red-300 hover:bg-red-50 hover:border-red-400'
              }`}
            >
              <Trash2 className={`w-4 h-4 ${cleaningUp ? 'animate-pulse' : ''}`} />
              Elimina prenotazioni passate
            </button>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-all ${
              syncing ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizzazione...' : 'Sincronizza DB'}
          </button>
          {availableYears.length > 0 && (
            <button
              disabled={clientsMode !== 'MARKETING'}
              onClick={() => setShowResetModal(true)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg shadow-sm transition-all ${
                clientsMode !== 'MARKETING'
                  ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                  : 'text-gray-700 bg-white border border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400'
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              Reset contatti anno {selectedYear}
            </button>
          )}
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setClientsMode('MARKETING')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                clientsMode === 'MARKETING' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Clienti
            </button>
            <button
              onClick={() => setClientsMode('RUBRICA')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                clientsMode === 'RUBRICA' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Rubrica
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Cerca per nome, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64 transition-all"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
        {availableYears.length > 0 ? (
          availableYears.map(year => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              className={`px-6 py-3 rounded-full font-bold text-sm whitespace-nowrap transition-all shadow-sm border
                ${selectedYear === year
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-105'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600 hover:shadow-sm'
                }`}
            >
              {year}
            </button>
          ))
        ) : (
          <div className="text-sm text-gray-500 italic px-2">Nessun anno disponibile</div>
        )}
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        {/* Tabs per tipologia servizio */}
        <div className="flex p-1 space-x-1 bg-gray-100/80 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all
              ${activeTab === 'ALL' 
                ? 'bg-white text-gray-900 shadow-sm ring-1 ring-black/5' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
              }`}
          >
            <Users className="w-4 h-4" />
            Tutti
          </button>
          <button
            onClick={() => setActiveTab('EXCURSION')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all
              ${activeTab === 'EXCURSION' 
                ? 'bg-white text-green-700 shadow-sm ring-1 ring-black/5' 
                : 'text-gray-500 hover:text-green-600 hover:bg-green-50'
              }`}
          >
            <Map className="w-4 h-4" />
            Escursioni
          </button>
          <button
            onClick={() => setActiveTab('TRANSFER')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all
              ${activeTab === 'TRANSFER' 
                ? 'bg-white text-blue-700 shadow-sm ring-1 ring-black/5' 
                : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'
              }`}
          >
            <Car className="w-4 h-4" />
            Trasferimenti
          </button>
          <button
            onClick={() => setActiveTab('RENTAL')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all
              ${activeTab === 'RENTAL' 
                ? 'bg-white text-orange-700 shadow-sm ring-1 ring-black/5' 
                : 'text-gray-500 hover:text-orange-600 hover:bg-orange-50'
              }`}
          >
            <Key className="w-4 h-4" />
            Noleggi
          </button>
        </div>

        {/* Legenda */}
        <div className="flex items-center gap-4 text-xs text-gray-600 bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
          <span className="font-semibold text-gray-900">Legenda:</span>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full border border-gray-300 bg-white"></div>
            <span>Da contattare</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full border border-emerald-300 bg-emerald-50"></div>
            <span>Contattato</span>
          </div>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Stato</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Contatti</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Nazionalità</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Servizi (Clicca per Dettagli)</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Prenotazioni</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Data Evento</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Data Registrazione</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-gray-500">
                    <div className="flex justify-center items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      Caricamento clienti...
                    </div>
                  </td>
                </tr>
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-gray-500">
                    Nessun cliente trovato. I clienti verranno salvati automaticamente all&apos;aggiunta di una prenotazione.
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => {
                  const isContacted =
                    clientsMode === 'MARKETING' ? (client.isManuallyContacted || !!client.lastEmailSentAt) : false
                  return (
                    <tr 
                      key={client.id} 
                      className={`transition-colors group border-l-4 ${
                        isContacted 
                          ? 'bg-emerald-50 hover:bg-emerald-100/50 border-emerald-500' 
                          : 'bg-white hover:bg-blue-50/30 border-transparent'
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-2">
                          {clientsMode === 'MARKETING' ? (
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <input 
                                type="checkbox"
                                checked={client.isManuallyContacted ?? false}
                                onChange={() => toggleManualContact(client.id, client.isManuallyContacted)}
                                className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 transition-all cursor-pointer"
                              />
                              <span className={`text-sm font-medium ${client.isManuallyContacted ? 'text-emerald-700' : 'text-gray-500'}`}>
                                {client.isManuallyContacted ? 'Contattato' : 'Da contattare'}
                              </span>
                            </label>
                          ) : (
                            <div className="text-sm text-gray-500 font-medium">—</div>
                          )}
                          {client.lastEmailSentAt && (
                            <div className="flex items-center gap-2 ml-6">
                              <span className="text-xs text-emerald-700 flex items-center gap-1 bg-emerald-100 px-2 py-0.5 rounded-full w-fit border border-emerald-200">
                                <Mail className="w-3 h-3" />
                                Email inviata
                              </span>
                              <span className="text-xs text-gray-700 flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-full w-fit border border-gray-200">
                                <Clock className="w-3 h-3" />
                                {new Date(client.lastEmailSentAt).toLocaleDateString('it-IT')} {new Date(client.lastEmailSentAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900">{client.firstName} {client.lastName}</div>
                        {client.associatedNames && client.associatedNames.length > 0 && (
                          <div className="text-xs text-gray-500 mt-1">
                            anche: {client.associatedNames.join(', ')}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          {client.email ? (
                             <div className="flex items-center gap-2">
                               <span className="text-sm text-gray-900 font-medium">{client.email}</span>
                               <button 
                                 onClick={() => setEmailClient({ id: client.id, email: client.email!, name: `${client.firstName} ${client.lastName}` })}
                                 className="text-blue-600 hover:text-blue-800 p-1 hover:bg-blue-100 rounded transition-colors"
                                 title="Invia Email"
                               >
                                 <Mail className="w-4 h-4" />
                               </button>
                             </div>
                          ) : (
                             <span className="text-xs text-gray-400 italic">Email non presente</span>
                          )}
                          {client.phoneNumber && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Phone className="w-3 h-3" />
                              {client.phoneNumber}
                            </div>
                          )}
                        </div>
                      </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {client.nationality || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-2">
                        {(() => {
                          const types = getServiceTypesForClient(client)
                          const paxByType =
                            clientsMode === 'RUBRICA' ? getUpcomingPaxByType(client) : (client.servicePaxByType || {})

                          return types
                            .filter(Boolean)
                            .map((type, idx) => {
                            const pax = paxByType?.[String(type)] ?? null
                            const label =
                              type === 'EXCURSION'
                                ? 'Escursione'
                                : type === 'TRANSFER'
                                  ? 'Trasferimento'
                                  : type === 'RENTAL'
                                    ? 'Noleggio'
                                    : String(type)
                            const suffix = pax && pax > 0 ? ` (${pax})` : ''
                            return (
                          <button
                            key={idx}
                            onClick={() => {
                              setHistoryClient(client)
                              setHistoryServiceFilter(type as 'EXCURSION' | 'TRANSFER' | 'RENTAL')
                            }}
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide transition-transform hover:scale-105 hover:shadow-sm
                              ${type === 'EXCURSION' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 
                                type === 'TRANSFER' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 
                                'bg-orange-100 text-orange-700 hover:bg-orange-200'}`}
                          >
                            {label}{suffix}
                             <ChevronRight className="w-3 h-3 opacity-50" />
                          </button>
                            )
                          })
                        })()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {clientsMode === 'RUBRICA' ? getUpcomingParticipantsCount(client) : client._count.participants}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {client.nextEventStartDate ? new Date(client.nextEventStartDate).toLocaleDateString('it-IT') : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {new Date(client.createdAt).toLocaleDateString('it-IT')}
                      </div>
                    </td>
                  </tr>
                )
              })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {historyClient && (
        <ClientHistoryModal 
          client={historyClient}
          serviceFilter={historyServiceFilter}
          onClose={() => {
            setHistoryClient(null)
            setHistoryServiceFilter(null)
          }} 
        />
      )}

      {emailClient && (
        <EmailModal
          clientId={emailClient.id}
          clientEmail={emailClient.email}
          clientName={emailClient.name}
          onClose={() => setEmailClient(null)}
          onEmailSent={fetchClients}
        />
      )}

      <ConfirmationModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onConfirm={async () => {
          try {
            const res = await fetch('/api/clients/reset-contact', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ year: selectedYear })
            })

            if (!res.ok) {
              console.error('Failed to reset contact status')
              return
            }

            fetchClients()
          } catch (error) {
            console.error('Error resetting contact status:', error)
          }
        }}
        title="Reset stato contatto"
        message={`Vuoi resettare lo stato di contatto per tutti i clienti dell'anno ${selectedYear}? Potrai ricontattarli nuovamente in futuro.`}
        confirmText="Sì, resetta"
        cancelText="Annulla"
        variant="warning"
      />

      <ConfirmationModal
        isOpen={showCleanupModal}
        onClose={() => setShowCleanupModal(false)}
        onConfirm={async () => {
          setCleaningUp(true)
          setCleanupResult(null)
          try {
            const res = await fetch('/api/clients', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'CLEANUP_PAST_BOOKINGS' })
            })
            const data = await res.json().catch(() => ({} as any))
            if (!res.ok) {
              console.error('Failed to cleanup past bookings', data)
              return
            }
            setCleanupResult({ deleted: Number(data.deleted || 0) })
            fetchClients()
          } catch (error) {
            console.error('Error cleaning up past bookings:', error)
          } finally {
            setCleaningUp(false)
          }
        }}
        title="Elimina prenotazioni passate"
        message="Vuoi eliminare tutte le prenotazioni (escursioni, trasferimenti, noleggi) con data evento già passata? In rubrica resteranno solo i contatti legati a eventi futuri."
        confirmText={cleaningUp ? 'Eliminazione...' : 'Sì, elimina'}
        cancelText="Annulla"
        variant="danger"
      />
    </div>
  )
}
