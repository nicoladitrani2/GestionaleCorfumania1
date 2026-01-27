'use client'

import { useState, useEffect } from 'react'
import { Search, RefreshCw, Mail, Phone, Calendar, Clock, ChevronRight, Map, Car, Key, Users, CheckCircle } from 'lucide-react'
import { ClientHistoryModal } from './ClientHistoryModal'
import { EmailModal } from './EmailModal'

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
  participants: any[]
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ processed: number, remaining: number } | null>(null)
  
  // Modal states
  const [historyClient, setHistoryClient] = useState<Client | null>(null)
  const [emailClient, setEmailClient] = useState<{ id: string, email: string, name: string } | null>(null)

  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [activeTab, setActiveTab] = useState<'ALL' | 'EXCURSION' | 'TRANSFER' | 'RENTAL'>('ALL')

  useEffect(() => {
    fetchClients()
  }, [])

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setClients(data)
      }
    } catch (error) {
      console.error('Error fetching clients:', error)
    } finally {
      setLoading(false)
    }
  }

  const getLastActivityYear = (client: Client): number => {
    if (!client.participants || client.participants.length === 0) {
      return new Date(client.createdAt).getFullYear()
    }

    const dates = client.participants.map(p => {
      let dateStr = p.createdAt
      if (p.excursion?.startDate) dateStr = p.excursion.startDate
      else if (p.transfer?.date) dateStr = p.transfer.date
      else if (p.isRental && p.rentalStartDate) dateStr = p.rentalStartDate
      
      return new Date(dateStr).getTime()
    })

    const maxDate = Math.max(...dates)
    return new Date(maxDate).getFullYear()
  }

  // Get unique sorted years
  const availableYears = Array.from(new Set(clients.map(getLastActivityYear))).sort((a, b) => b - a)
  
  // Set default year if not set or invalid
  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0])
    }
  }, [clients])

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

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (client.email && client.email.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesYear = getLastActivityYear(client) === selectedYear

    return matchesSearch && matchesYear
  })

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Anagrafica Clienti</h1>
          <p className="text-sm text-gray-500 mt-1">Elenco di tutti i clienti registrati e storico attività</p>
          {syncResult && (
            <p className="text-xs text-green-600 mt-1">
              Sincronizzati: {syncResult.processed}. Rimanenti da sincronizzare: {syncResult.remaining}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
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
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Data Registrazione</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500">
                    <div className="flex justify-center items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      Caricamento clienti...
                    </div>
                  </td>
                </tr>
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500">
                    Nessun cliente trovato. I clienti verranno salvati automaticamente all'aggiunta di una prenotazione.
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => {
                  const isContacted = client.isManuallyContacted || !!client.lastEmailSentAt
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
                          {client.lastEmailSentAt && (
                            <span className="text-xs text-emerald-600 flex items-center gap-1 ml-6 bg-emerald-100/50 px-2 py-0.5 rounded-full w-fit">
                              <Mail className="w-3 h-3" />
                              Email inviata
                            </span>
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
                        {(client.derivedServiceTypes.length > 0 ? client.derivedServiceTypes : [client.serviceType]).filter(Boolean).map((type, idx) => (
                          <button
                            key={idx}
                            onClick={() => setHistoryClient(client)}
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide transition-transform hover:scale-105 hover:shadow-sm
                              ${type === 'EXCURSION' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 
                                type === 'TRANSFER' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 
                                'bg-orange-100 text-orange-700 hover:bg-orange-200'}`}
                          >
                            {type === 'EXCURSION' ? 'Escursione' : 
                             type === 'TRANSFER' ? 'Trasferimento' : 
                             type === 'RENTAL' ? 'Noleggio' : type}
                             <ChevronRight className="w-3 h-3 opacity-50" />
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {client._count.participants}
                      </span>
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
          onClose={() => setHistoryClient(null)} 
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
    </div>
  )
}
