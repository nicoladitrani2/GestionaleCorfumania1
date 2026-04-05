'use client'

import { useState, useEffect } from 'react'
import { Calendar, Filter, Download, DollarSign, Users, Briefcase, PieChart, CheckSquare, Square, RotateCcw, Loader2, ShoppingBag } from 'lucide-react'
import { generateAdvancedReportPDF } from '@/lib/report-pdf-generator'

interface SummaryStats {
  totalRevenue: number
  totalCommission: number
  // netRevenue removed from API, calculated on client
  count: number
  totalPax: number
  totalTax: number
  totalTaxRevenue?: number
  totalAssistantCommission?: number
  totalNetAgency?: number
  totalExternalAgencyCommission?: number
  rentals?: {
    gross: number
    supplierOut: number
    commissionTotal: number
    commissionBaseTotal?: number
    carExcludedCostsTotal?: number
    carGrossBaseCount?: number
    companyNow: number
    companyFuture: number
    companyTotal: number
    agentTotal: number
    agentNow?: number
    agentFuture?: number
    go4seaTotal: number
    go4seaNow?: number
    go4seaFuture?: number
  }
}

interface BreakdownItem {
  name: string
  date?: string
  revenue: number
  commission: number
  assistantCommission?: number
  supplierShare?: number
  netAgency?: number
  count: number
  pax: number
  tax: number
  taxBookingRevenue?: number
}
interface RentalAgentItem {
  id: string
  code?: string
  name: string
  count: number
  gross: number
  commissionBase: number
  agentShare: number
  companyShare: number
  go4seaShare: number
}


interface ReportData {
  summary: SummaryStats
  byAgency: BreakdownItem[]
  bySupplier: BreakdownItem[] // Providers
  byAssistant: BreakdownItem[]
  byExcursion: BreakdownItem[]
  byTransfer: BreakdownItem[]
  byRentalAgent?: RentalAgentItem[]
  byRentalPaymentMethod?: { name: string; revenue: number; count: number }[]
  byRental: BreakdownItem[]
  bySpecialService: BreakdownItem[]
  taxStats?: {
      totalPax: number
      totalRevenue: number
      byProvenienza: {
          AGENZIA: { pax: number, revenue: number, count: number, paidCount: number, unpaidCount: number }
          PRIVATO: { pax: number, revenue: number, count: number, paidCount: number, unpaidCount: number }
      }
      byAssistant: Record<string, { pax: number, revenue: number, count: number, paidCount: number, unpaidCount: number }>
      byService: Record<string, { pax: number, revenue: number, count: number }>
      byWeek: Record<string, { pax: number, revenue: number, count: number }>
  }
}

export default function ReportsPage() {
  // Filters State
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['EXCURSION', 'TRANSFER', 'RENTAL_CAR', 'RENTAL_MOTO', 'RENTAL_BOAT', 'SPECIAL_BRACELET', 'SPECIAL_CITY_TAX', 'SPECIAL_AC'])
  const [selectedAgencies, setSelectedAgencies] = useState<string[]>([])
  const [selectedProviders, setSelectedProviders] = useState<string[]>([])
  const [selectedAssistants, setSelectedAssistants] = useState<string[]>([])
  const [selectedExcursions, setSelectedExcursions] = useState<string[]>([])
  const [includeFutureRentals, setIncludeFutureRentals] = useState(false)

  // Data State
  const [agencies, setAgencies] = useState<any[]>([])
  const [providers, setProviders] = useState<any[]>([])
  const [assistants, setAssistants] = useState<any[]>([])
  const [excursions, setExcursions] = useState<any[]>([])
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)

  // Load initial options
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [agencyRes, providerRes, usersRes, excRes] = await Promise.all([
          fetch('/api/agencies'),
          fetch('/api/suppliers'),
          fetch('/api/users'),
          fetch('/api/excursions?all=true')
        ])
        
        if (agencyRes.ok) {
          const data = await agencyRes.json()
          setAgencies(data)
        }

        if (providerRes.ok) {
            const data = await providerRes.json()
            setProviders(data)
        }
        
        if (usersRes.ok) {
          const data = await usersRes.json()
          setAssistants(data)
        }

        if (excRes.ok) {
            const data = await excRes.json()
            setExcursions(data)
        }
      } catch (error) {
        console.error('Error fetching options:', error)
      }
    }
    fetchOptions()
  }, [])

  // Fetch Report Data
  const fetchReport = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      if (selectedAgencies.length) params.append('agencyIds', selectedAgencies.join(','))
      if (selectedProviders.length) params.append('providerIds', selectedProviders.join(','))
      if (selectedAssistants.length) params.append('assistantIds', selectedAssistants.join(','))
      if (selectedExcursions.length) params.append('excursionIds', selectedExcursions.join(','))
      if (selectedTypes.length) params.append('types', selectedTypes.join(','))
      params.append('includeFutureRentals', includeFutureRentals ? 'true' : 'false')

      const res = await fetch(`/api/reports?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setReportData(data)
      }
    } catch (error) {
      console.error('Error fetching report:', error)
    } finally {
      setLoading(false)
    }
  }

  // Dynamic Fetch with Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchReport()
    }, 500)

    return () => clearTimeout(timer)
  }, [startDate, endDate, selectedAgencies, selectedProviders, selectedAssistants, selectedExcursions, selectedTypes, includeFutureRentals])

  const resetFilters = () => {
    setStartDate('')
    setEndDate('')
    setSelectedTypes(['EXCURSION', 'TRANSFER', 'RENTAL_CAR', 'RENTAL_MOTO', 'RENTAL_BOAT', 'SPECIAL_BRACELET', 'SPECIAL_CITY_TAX', 'SPECIAL_AC'])
    setSelectedAgencies([])
    setSelectedProviders([])
    setSelectedAssistants([])
    setSelectedExcursions([])
  }

  const toggleType = (type: string) => {
    setSelectedTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  const toggleAgency = (id: string) => {
    setSelectedAgencies(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  const toggleProvider = (name: string) => {
    // Note: We use name for providers/suppliers because it's a string field in Participant
    setSelectedProviders(prev => 
      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
    )
  }

  const toggleAssistant = (id: string) => {
    setSelectedAssistants(prev => 
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    )
  }

  const toggleExcursion = (id: string) => {
    setSelectedExcursions(prev => 
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    )
  }

  const handleExportPDF = () => {
    if (reportData) {
      generateAdvancedReportPDF(reportData, {
        startDate,
        endDate,
        types: selectedTypes,
        agencyIds: selectedAgencies,
        providerIds: selectedProviders,
        assistantIds: selectedAssistants,
        excursionIds: selectedExcursions
      })
    }
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
          <PieChart className="w-8 h-8 text-blue-600" />
          Report Avanzati
        </h1>
        <button
          onClick={handleExportPDF}
          disabled={!reportData}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Download className="w-4 h-4" />
          Esporta PDF
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters Sidebar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-6 h-fit max-h-[calc(100vh-100px)] overflow-y-auto">
          <div className="flex items-center gap-2 font-semibold text-gray-700 pb-2 border-b">
            <Filter className="w-5 h-5" />
            Filtri
          </div>

          {/* Date Range */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-600">Periodo</label>
            <div className="grid grid-cols-1 gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-2 border rounded-md text-sm"
                placeholder="Da"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-2 border rounded-md text-sm"
                placeholder="A"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-600">Opzioni</label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeFutureRentals}
                onChange={(e) => setIncludeFutureRentals(e.target.checked)}
                className="w-4 h-4"
              />
              Includi incassi futuri (noleggi)
            </label>
          </div>

          {/* Type Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-600">Tipo Prodotto</label>
            <div className="space-y-1">
              {['EXCURSION', 'TRANSFER'].map(type => (
                <div key={type} className="flex items-center gap-2 cursor-pointer" onClick={() => toggleType(type)}>
                  {selectedTypes.includes(type) ? 
                    <CheckSquare className="w-4 h-4 text-blue-600" /> : 
                    <Square className="w-4 h-4 text-gray-400" />
                  }
                  <span className="text-sm capitalize">{type === 'EXCURSION' ? 'Escursioni' : 'Trasferimenti'}</span>
                </div>
              ))}
              
              <div className="pt-2 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">Noleggi</div>
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => toggleType('RENTAL_CAR')}>
                {selectedTypes.includes('RENTAL_CAR') ? 
                  <CheckSquare className="w-4 h-4 text-blue-600" /> : 
                  <Square className="w-4 h-4 text-gray-400" />
                }
                <span className="text-sm">Auto</span>
              </div>
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => toggleType('RENTAL_MOTO')}>
                {selectedTypes.includes('RENTAL_MOTO') ? 
                  <CheckSquare className="w-4 h-4 text-blue-600" /> : 
                  <Square className="w-4 h-4 text-gray-400" />
                }
                <span className="text-sm">Moto</span>
              </div>
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => toggleType('RENTAL_BOAT')}>
                {selectedTypes.includes('RENTAL_BOAT') ? 
                  <CheckSquare className="w-4 h-4 text-blue-600" /> : 
                  <Square className="w-4 h-4 text-gray-400" />
                }
                <span className="text-sm">Barche</span>
              </div>

              <div className="pt-2 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tasse & Extra</div>
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => toggleType('SPECIAL_BRACELET')}>
                {selectedTypes.includes('SPECIAL_BRACELET') ? 
                  <CheckSquare className="w-4 h-4 text-blue-600" /> : 
                  <Square className="w-4 h-4 text-gray-400" />
                }
                <span className="text-sm">Braccialetto</span>
              </div>
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => toggleType('SPECIAL_CITY_TAX')}>
                {selectedTypes.includes('SPECIAL_CITY_TAX') ? 
                  <CheckSquare className="w-4 h-4 text-blue-600" /> : 
                  <Square className="w-4 h-4 text-gray-400" />
                }
                <span className="text-sm">Tassa Soggiorno</span>
              </div>
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => toggleType('SPECIAL_AC')}>
                {selectedTypes.includes('SPECIAL_AC') ? 
                  <CheckSquare className="w-4 h-4 text-blue-600" /> : 
                  <Square className="w-4 h-4 text-gray-400" />
                }
                <span className="text-sm">Aria Condizionata</span>
              </div>
            </div>
          </div>

          {/* Agency Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-600">Agenzie</label>
            <div className="max-h-40 overflow-y-auto space-y-1 border p-2 rounded-md">
              {agencies.map(s => (
                <div key={s.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded" onClick={() => toggleAgency(s.id)}>
                   {selectedAgencies.includes(s.id) ? 
                    <CheckSquare className="w-4 h-4 text-blue-600" /> : 
                    <Square className="w-4 h-4 text-gray-400" />
                  }
                  <span className="text-sm truncate">{s.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Provider Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-600">Fornitori</label>
            <div className="max-h-40 overflow-y-auto space-y-1 border p-2 rounded-md">
              {providers.map(p => (
                <div key={p.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded" onClick={() => toggleProvider(p.name)}>
                   {selectedProviders.includes(p.name) ? 
                    <CheckSquare className="w-4 h-4 text-blue-600" /> : 
                    <Square className="w-4 h-4 text-gray-400" />
                  }
                  <span className="text-sm truncate">{p.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Assistant Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-600">Assistenti</label>
            <div className="max-h-40 overflow-y-auto space-y-1 border p-2 rounded-md">
              {assistants.map(a => (
                <div key={a.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded" onClick={() => toggleAssistant(a.id)}>
                   {selectedAssistants.includes(a.id) ? 
                    <CheckSquare className="w-4 h-4 text-blue-600" /> : 
                    <Square className="w-4 h-4 text-gray-400" />
                  }
                  <span className="text-sm truncate">{a.firstName} {a.lastName}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Excursion Filter (Only if Excursion type is selected) */}
          {selectedTypes.includes('EXCURSION') && (
            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-600">Escursioni Specifiche</label>
                <div className="max-h-40 overflow-y-auto space-y-1 border p-2 rounded-md">
                {excursions.map(e => {
                    const dateStr = e.startDate ? new Date(e.startDate).toLocaleDateString('it-IT') : 'Data non valida'
                    return (
                    <div key={e.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded" onClick={() => toggleExcursion(e.id)}>
                    {selectedExcursions.includes(e.id) ? 
                        <CheckSquare className="w-4 h-4 text-blue-600" /> : 
                        <Square className="w-4 h-4 text-gray-400" />
                    }
                    <span className="text-sm truncate">{e.name} ({dateStr})</span>
                    </div>
                )})}
                </div>
            </div>
          )}

          <button
            onClick={resetFilters}
            className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition-colors font-medium mt-4"
          >
            <RotateCcw className="w-4 h-4" />
            Resetta Filtri
          </button>
        </div>

        {/* Results Area */}
        <div className="lg:col-span-3 space-y-6 relative min-h-[500px]">
          
          {/* Loading Overlay */}
          {loading && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                <span className="text-sm font-medium text-blue-600">Aggiornamento dati...</span>
              </div>
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {(() => {
              const baseNow =
                (reportData?.summary?.totalRevenue ?? 0) +
                (reportData?.summary?.totalTaxRevenue ?? 0)
              const withFuture = baseNow
              const title = includeFutureRentals ? 'Incasso Totale (subito + futuri)' : 'Incasso Totale (solo subito)'
              return (
                <StatCard
                  title={title}
                  value={`€ ${withFuture.toFixed(2)}`}
                  icon={<DollarSign className="w-6 h-6 text-green-600" />}
                  bg="bg-green-50"
                />
              )
            })()}
            <StatCard 
              title="Comm. Agenzia" 
              value={`€ ${(reportData?.summary?.totalExternalAgencyCommission ?? 0).toFixed(2)}`} 
              icon={<Briefcase className="w-6 h-6 text-orange-600" />}
              bg="bg-orange-50"
            />
            <StatCard 
              title="Comm. Assistenti" 
              value={`€ ${(
                (reportData?.summary?.totalAssistantCommission ?? 0) +
                (reportData?.summary?.rentals?.agentNow ?? 0) +
                (includeFutureRentals ? (reportData?.summary?.rentals?.agentFuture ?? 0) : 0)
              ).toFixed(2)}`} 
              icon={<Users className="w-6 h-6 text-indigo-600" />}
              bg="bg-indigo-50"
            />
            <StatCard 
              title="Netto Agenzia" 
              value={`€ ${(reportData?.summary?.totalNetAgency ?? 0).toFixed(2)}`} 
              icon={<PieChart className="w-6 h-6 text-blue-600" />}
              bg="bg-blue-50"
            />
            <StatCard 
              title="Prenotazioni / Pax" 
              value={`${reportData?.summary.count || 0} / ${reportData?.summary.totalPax || 0}`} 
              icon={<Users className="w-6 h-6 text-purple-600" />}
              bg="bg-purple-50"
            />
          </div>

          {/* Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Tax Booking Stats Section */}
            {reportData?.taxStats && (
                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-orange-100">
                    <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2 mb-4">
                        <DollarSign className="w-5 h-5 text-orange-600" />
                        Tasse di Soggiorno & Braccialetti (Gestione Separata)
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div className="bg-orange-50 p-4 rounded-lg">
                            <div className="text-sm text-gray-600 font-medium">Totale Pax</div>
                            <div className="text-2xl font-bold text-gray-900">{reportData.taxStats.totalPax}</div>
                            <div className="text-xs text-gray-500 mt-1">Importo Totale: € {reportData.taxStats.totalRevenue.toFixed(2)}</div>
                        </div>
                        
                        <div className="bg-blue-50 p-4 rounded-lg">
                            <div className="text-sm text-blue-800 font-medium">Agenzia</div>
                            <div className="flex justify-between items-end mt-2">
                                <div>
                                    <div className="text-xl font-bold text-blue-900">{reportData.taxStats.byProvenienza.AGENZIA.pax} Pax</div>
                                    <div className="text-xs text-blue-700">€ {reportData.taxStats.byProvenienza.AGENZIA.revenue.toFixed(2)}</div>
                                </div>
                                <div className="text-right text-xs">
                                    <div className="text-green-600 font-bold">{reportData.taxStats.byProvenienza.AGENZIA.paidCount} Pagati</div>
                                    <div className="text-red-500 font-bold">{reportData.taxStats.byProvenienza.AGENZIA.unpaidCount} Da Pagare</div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-purple-50 p-4 rounded-lg">
                            <div className="text-sm text-purple-800 font-medium">Privati</div>
                            <div className="flex justify-between items-end mt-2">
                                <div>
                                    <div className="text-xl font-bold text-purple-900">{reportData.taxStats.byProvenienza.PRIVATO.pax} Pax</div>
                                    <div className="text-xs text-purple-700">€ {reportData.taxStats.byProvenienza.PRIVATO.revenue.toFixed(2)}</div>
                                </div>
                                <div className="text-right text-xs">
                                    <div className="text-green-600 font-bold">{reportData.taxStats.byProvenienza.PRIVATO.paidCount} Pagati</div>
                                    <div className="text-red-500 font-bold">{reportData.taxStats.byProvenienza.PRIVATO.unpaidCount} Da Pagare</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Breakdown by Assistant */}
                        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                            <div className="p-3 bg-gray-50 border-b font-semibold text-sm text-gray-700">Dettaglio per Assistente</div>
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Assistente</th>
                                        <th className="px-3 py-2 text-right">Pax</th>
                                        <th className="px-3 py-2 text-right">Incasso</th>
                                        <th className="px-3 py-2 text-right">Stato</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {Object.entries(reportData.taxStats.byAssistant).map(([name, stats]) => (
                                        <tr key={name}>
                                            <td className="px-3 py-2 font-medium">{name}</td>
                                            <td className="px-3 py-2 text-right">{stats.pax}</td>
                                            <td className="px-3 py-2 text-right text-green-600 font-bold">€ {stats.revenue.toFixed(2)}</td>
                                            <td className="px-3 py-2 text-right">
                                                <div className="text-xs flex flex-col items-end">
                                                    <span className="text-green-600">{stats.paidCount} Pagati</span>
                                                    <span className="text-red-500">{stats.unpaidCount} Da Pagare</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {Object.keys(reportData.taxStats.byAssistant).length === 0 && (
                                        <tr><td colSpan={4} className="px-3 py-4 text-center text-gray-400">Nessun dato</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Breakdown by Service */}
                        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden h-fit">
                            <div className="p-3 bg-gray-50 border-b font-semibold text-sm text-gray-700">Dettaglio per Servizio</div>
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Servizio</th>
                                        <th className="px-3 py-2 text-right">Pax</th>
                                        <th className="px-3 py-2 text-right">Incasso</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {Object.entries(reportData.taxStats.byService).map(([name, stats]) => (
                                        <tr key={name}>
                                            <td className="px-3 py-2 font-medium">{name}</td>
                                            <td className="px-3 py-2 text-right">{stats.pax}</td>
                                            <td className="px-3 py-2 text-right text-green-600 font-bold">€ {stats.revenue.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    {Object.keys(reportData.taxStats.byService).length === 0 && (
                                        <tr><td colSpan={3} className="px-3 py-4 text-center text-gray-400">Nessun dato</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Agency Table */}
            <TableCard 
                title="Performance per Agenzia" 
                data={reportData?.byAgency} 
                columns={[
                    { header: 'Nome', key: 'name' },
                    { header: 'Pax', key: 'pax', align: 'right' },
                    { header: 'Incasso', key: 'revenue', align: 'right', format: 'currency', color: 'text-green-600' },
                    { header: 'Comm.', key: 'commission', align: 'right', format: 'currency', color: 'text-orange-600' },
                    { header: 'Netto Agenzia', key: 'netAgency', align: 'right', format: 'currency', color: 'text-blue-600' }
                ]}
            />

            {/* Assistant Table */}
            <TableCard 
                title="Performance per Assistente" 
                data={reportData?.byAssistant} 
                columns={[
                    { header: 'Nome', key: 'name' },
                    { header: 'Pax', key: 'pax', align: 'right' },
                    { header: 'Incasso Servizi', key: 'revenue', align: 'right', format: 'currency', color: 'text-green-600' },
                    { 
                        header: 'Incasso Tasse', 
                        key: 'taxBookingRevenue', 
                        align: 'right', 
                        color: 'text-purple-600',
                        render: (item: any) => `€ ${(item.taxBookingRevenue || 0).toFixed(2)}`
                    },
                    { 
                        header: 'Totale Incassato', 
                        key: 'totalRevenue', 
                        align: 'right', 
                        color: 'text-blue-700 font-bold',
                        render: (item: any) => `€ ${(item.revenue + (item.taxBookingRevenue || 0)).toFixed(2)}`
                    },
                    { header: 'Comm. Assistente', key: 'commission', align: 'right', format: 'currency', color: 'text-orange-600' }
                ]}
            />
          </div>

          {/* Supplier (Provider) Table */}
          <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
             <TableCard 
                title="Performance per Fornitore" 
                data={reportData?.bySupplier} 
                columns={[
                    { header: 'Fornitore', key: 'name' },
                    { header: 'Pax', key: 'pax', align: 'right' },
                    { header: 'Prenotazioni', key: 'count', align: 'right' },
                    { header: 'Quota / Incasso', key: 'revenue', align: 'right', format: 'currency', color: 'text-green-600' }
                ]}
            />
          </div>

          {/* Excursion Table */}
          {reportData?.byExcursion && reportData.byExcursion.length > 0 && (
             <TableCard 
                title="Performance Escursioni" 
                data={reportData?.byExcursion} 
                columns={[
                    { header: 'Nome Escursione', key: 'name' },
                    { header: 'Data', key: 'date' },
                    { header: 'Pax', key: 'pax', align: 'right' },
                    { header: 'Incasso', key: 'revenue', align: 'right', format: 'currency', color: 'text-green-600' },
                    { header: 'Comm.', key: 'commission', align: 'right', format: 'currency', color: 'text-orange-600' },
                    { header: 'Netto', key: 'net', align: 'right', format: 'currency', color: 'text-blue-600' }
                ]}
            />
          )}

          {/* Transfer Table */}
          {reportData?.byTransfer && reportData.byTransfer.length > 0 && (
             <TableCard 
                title="Performance Transfer" 
                data={reportData?.byTransfer} 
                columns={[
                    { header: 'Tratta', key: 'name' },
                    { header: 'Pax', key: 'pax', align: 'right' },
                    { header: 'Incasso', key: 'revenue', align: 'right', format: 'currency', color: 'text-green-600' },
                    { header: 'Comm.', key: 'commission', align: 'right', format: 'currency', color: 'text-orange-600' },
                    { header: 'Netto', key: 'net', align: 'right', format: 'currency', color: 'text-blue-600' }
                ]}
            />
          )}

          {/* Rental Table */}
          {reportData?.byRental && reportData.byRental.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-blue-100 overflow-hidden">
              <div className="p-4 border-b bg-blue-50 font-semibold text-blue-700 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5" />
                Noleggi
              </div>
              <div className="p-4 space-y-4">
                {/* Rental Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Entrate Totali (Lordo)</p>
                      <p className="text-2xl font-bold text-slate-900">
                        € {(reportData.summary.rentals?.gross ?? 0).toFixed(2)}
                      </p>
                    </div>
                    <PieChart className="w-8 h-8 text-slate-300" />
                  </div>
                  <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-700">Pagamenti Fornitori (80%)</p>
                      <p className="text-2xl font-bold text-purple-800">
                        € {(reportData.summary.rentals?.supplierOut ?? 0).toFixed(2)}
                      </p>
                    </div>
                    <PieChart className="w-8 h-8 text-purple-300" />
                  </div>
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-600">Totale Netto Corfumania</p>
                      <p className="text-2xl font-bold text-blue-700">
                        € {(includeFutureRentals
                          ? (reportData.summary.rentals?.companyTotal ?? 0)
                          : (reportData.summary.rentals?.companyNow ?? 0)
                        ).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Subito: € {(reportData.summary.rentals?.companyNow ?? 0).toFixed(2)} · Futuri: € {(reportData.summary.rentals?.companyFuture ?? 0).toFixed(2)}
                      </p>
                    </div>
                    <PieChart className="w-8 h-8 text-blue-300" />
                  </div>
                  <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-orange-700">Commissione Totale (20%)</p>
                      <p className="text-2xl font-bold text-orange-800">
                        € {(reportData.summary.rentals?.commissionTotal ?? 0).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Agente (subito): € {(reportData.summary.rentals?.agentNow ?? 0).toFixed(2)} · Go4Sea (subito): € {(reportData.summary.rentals?.go4seaNow ?? 0).toFixed(2)}{includeFutureRentals ? ` · Agente (futuri): € ${(reportData.summary.rentals?.agentFuture ?? reportData.summary.rentals?.agentTotal ?? 0).toFixed(2)} · Go4Sea (futuri): € ${(reportData.summary.rentals?.go4seaFuture ?? reportData.summary.rentals?.go4seaTotal ?? 0).toFixed(2)}` : ''}
                      </p>
                    </div>
                    <Briefcase className="w-8 h-8 text-orange-300" />
                  </div>
                </div>

                <TableCard 
                  title="Performance Noleggi" 
                  data={reportData?.byRental} 
                  columns={[
                      { header: 'Tipo Noleggio', key: 'name' },
                      { header: 'Pax', key: 'pax', align: 'right' },
                      { header: 'Lordo', key: 'gross', align: 'right', format: 'currency', color: 'text-slate-700' },
                      { header: 'Comm. 20%', key: 'commission', align: 'right', format: 'currency', color: 'text-orange-600' },
                      { header: 'Fornitore (80%)', key: 'supplierOut', align: 'right', format: 'currency', color: 'text-slate-700' },
                      { header: 'Agente (5%)', key: 'agentShare', align: 'right', format: 'currency', color: 'text-purple-600' },
                      { header: 'Quota Corfumania', key: 'companyShare', align: 'right', format: 'currency', color: 'text-blue-600' },
                      { header: 'Quota Go4Sea', key: 'go4seaShare', align: 'right', format: 'currency', color: 'text-cyan-700' },
                  ]}
                />

                {reportData?.byRentalAgent && reportData.byRentalAgent.length > 0 && (
                  <TableCard
                    title="Commissioni Agenti (Noleggi)"
                    data={reportData.byRentalAgent}
                    columns={[
                      { header: 'Codice', key: 'code' },
                      { header: 'Agente', key: 'name' },
                      { header: 'Noleggi', key: 'count', align: 'right' },
                      { header: 'Lordo', key: 'gross', align: 'right', format: 'currency', color: 'text-slate-700' },
                      { header: 'Agente (5%)', key: 'agentShare', align: 'right', format: 'currency', color: 'text-purple-600' },
                    ]}
                  />
                )}

                {reportData?.byRentalPaymentMethod && reportData.byRentalPaymentMethod.length > 0 && (
                  <TableCard
                    title="Metodi Pagamento (Commissione 20%)"
                    data={reportData.byRentalPaymentMethod}
                    columns={[
                      { header: 'Metodo', key: 'name' },
                      { header: 'Noleggi', key: 'count', align: 'right' },
                      { header: 'Incasso 20%', key: 'revenue', align: 'right', format: 'currency', color: 'text-green-600' },
                    ]}
                  />
                )}
              </div>
            </div>
          )}

          {/* Special Services Table */}
          {reportData?.bySpecialService && reportData.bySpecialService.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-indigo-100 overflow-hidden">
              <div className="p-4 border-b bg-indigo-50 font-semibold text-indigo-700 flex items-center gap-2">
                <CheckSquare className="w-5 h-5" />
                Tasse & Extra
              </div>
              <div className="p-4 space-y-4">
                {/* Special Services Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-indigo-600">Totale Netto Agenzia (Extra)</p>
                      <p className="text-2xl font-bold text-indigo-700">
                        € {reportData.bySpecialService.reduce((acc, s) => acc + s.commission, 0).toFixed(2)}
                      </p>
                    </div>
                    <PieChart className="w-8 h-8 text-indigo-300" />
                  </div>
                  <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-600">Totale Partecipanti (Extra)</p>
                      <p className="text-2xl font-bold text-purple-700">
                        {reportData.bySpecialService.reduce((acc, s) => acc + s.pax, 0)}
                      </p>
                    </div>
                    <Users className="w-8 h-8 text-purple-300" />
                  </div>
                </div>

                <TableCard 
                    title="Performance Tasse & Extra" 
                    data={reportData?.bySpecialService} 
                    columns={[
                        { header: 'Servizio', key: 'name' },
                        { header: 'Pax', key: 'pax', align: 'right' },
                        { header: 'Incasso Totale', key: 'revenue', align: 'right', format: 'currency', color: 'text-green-600' },
                        { header: 'Netto Agenzia', key: 'commission', align: 'right', format: 'currency', color: 'text-blue-600' }
                    ]}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon, bg }: { title: string, value: string | number, icon: any, bg: string }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
      </div>
      <div className={`p-3 rounded-lg ${bg}`}>
        {icon}
      </div>
    </div>
  )
}

function TableCard({ title, data, columns }: { title: string, data?: any[], columns: any[] }) {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b bg-gray-50 font-semibold text-gray-700">
                {title}
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                        <tr>
                            {columns.map((col, idx) => (
                                <th key={idx} className={`px-4 py-3 ${col.align === 'right' ? 'text-right' : ''}`}>{col.header}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {data?.map((item, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                                {columns.map((col, cIdx) => {
                                    let value = item[col.key]
                                    if (col.key === 'net') {
                                        value = item.revenue - item.commission
                                    }
                                    if (col.key === 'netAgency') {
                                        value = item.netAgency ?? item.commission
                                    }
                                    
                                    if (col.format === 'currency') {
                                        value = `€ ${Number(value).toFixed(2)}`
                                    }

                                    return (
                                        <td key={cIdx} className={`px-4 py-3 ${col.align === 'right' ? 'text-right' : ''} ${col.color || 'text-gray-900'} ${cIdx === 0 ? 'font-medium' : ''}`}>
                                            {col.render ? col.render(item) : value}
                                        </td>
                                    )
                                })}
                            </tr>
                        ))}
                         {(!data || data.length === 0) && (
                            <tr>
                                <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">Nessun dato disponibile</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
