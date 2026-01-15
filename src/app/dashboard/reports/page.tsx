'use client'

import { useState, useEffect } from 'react'
import { Calendar, Filter, Download, DollarSign, Users, Briefcase, PieChart, CheckSquare, Square, RotateCcw, Loader2 } from 'lucide-react'
import { generateAdvancedReportPDF } from '@/lib/report-pdf-generator'

interface SummaryStats {
  totalRevenue: number
  totalCommission: number
  netRevenue: number
  count: number
  totalPax: number
}

interface BreakdownItem {
  name: string
  revenue: number
  commission: number
  count: number
  pax: number
}

interface ReportData {
  summary: SummaryStats
  bySupplier: BreakdownItem[]
  byAssistant: BreakdownItem[]
  byExcursion: BreakdownItem[]
}

export default function ReportsPage() {
  // Filters State
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['EXCURSION', 'TRANSFER'])
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([])
  const [selectedAssistants, setSelectedAssistants] = useState<string[]>([])
  const [selectedExcursions, setSelectedExcursions] = useState<string[]>([])

  // Data State
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [assistants, setAssistants] = useState<any[]>([])
  const [excursions, setExcursions] = useState<any[]>([])
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)

  // Load initial options
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [suppRes, usersRes, excRes] = await Promise.all([
          fetch('/api/suppliers'),
          fetch('/api/users'),
          fetch('/api/excursions?all=true') // Fetch all excursions (including past/archived) for reporting
        ])
        
        if (suppRes.ok) {
          const data = await suppRes.json()
          setSuppliers(data)
        }
        
        if (usersRes.ok) {
          const data = await usersRes.json()
          setAssistants(data)
        }

        if (excRes.ok) {
            const data = await excRes.json()
            // Assuming the API returns a list of excursions
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
      if (selectedSuppliers.length) params.append('supplierIds', selectedSuppliers.join(','))
      if (selectedAssistants.length) params.append('assistantIds', selectedAssistants.join(','))
      if (selectedExcursions.length) params.append('excursionIds', selectedExcursions.join(','))
      if (selectedTypes.length) params.append('types', selectedTypes.join(','))

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
  }, [startDate, endDate, selectedSuppliers, selectedAssistants, selectedExcursions, selectedTypes])

  const resetFilters = () => {
    setStartDate('')
    setEndDate('')
    setSelectedTypes(['EXCURSION', 'TRANSFER'])
    setSelectedSuppliers([])
    setSelectedAssistants([])
    setSelectedExcursions([])
  }

  const toggleType = (type: string) => {
    setSelectedTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  const toggleSupplier = (id: string) => {
    setSelectedSuppliers(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
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
        supplierIds: selectedSuppliers,
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
              {/* Placeholder for Rentals */}
              <div className="flex items-center gap-2 opacity-50 cursor-not-allowed">
                <Square className="w-4 h-4 text-gray-300" />
                <span className="text-sm text-gray-400">Noleggi (Coming Soon)</span>
              </div>
            </div>
          </div>

          {/* Supplier Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-600">Gestori (Agenzie)</label>
            <div className="max-h-40 overflow-y-auto space-y-1 border p-2 rounded-md">
              {suppliers.map(s => (
                <div key={s.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded" onClick={() => toggleSupplier(s.id)}>
                   {selectedSuppliers.includes(s.id) ? 
                    <CheckSquare className="w-4 h-4 text-blue-600" /> : 
                    <Square className="w-4 h-4 text-gray-400" />
                  }
                  <span className="text-sm truncate">{s.name}</span>
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
                {excursions.map(e => (
                    <div key={e.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded" onClick={() => toggleExcursion(e.id)}>
                    {selectedExcursions.includes(e.id) ? 
                        <CheckSquare className="w-4 h-4 text-blue-600" /> : 
                        <Square className="w-4 h-4 text-gray-400" />
                    }
                    <span className="text-sm truncate">{e.name}</span>
                    </div>
                ))}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard 
              title="Incasso Totale" 
              value={`€ ${reportData?.summary.totalRevenue.toFixed(2) || '0.00'}`} 
              icon={<DollarSign className="w-6 h-6 text-green-600" />}
              bg="bg-green-50"
            />
            <StatCard 
              title="Commissioni" 
              value={`€ ${reportData?.summary.totalCommission.toFixed(2) || '0.00'}`} 
              icon={<Briefcase className="w-6 h-6 text-orange-600" />}
              bg="bg-orange-50"
            />
            <StatCard 
              title="Incasso Netto" 
              value={`€ ${reportData?.summary.netRevenue.toFixed(2) || '0.00'}`} 
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
            {/* Supplier Table */}
            <TableCard 
                title="Performance per Gestore" 
                data={reportData?.bySupplier} 
                columns={[
                    { header: 'Nome', key: 'name' },
                    { header: 'Pax', key: 'pax', align: 'right' },
                    { header: 'Incasso', key: 'revenue', align: 'right', format: 'currency', color: 'text-green-600' },
                    { header: 'Comm.', key: 'commission', align: 'right', format: 'currency', color: 'text-orange-600' },
                    { header: 'Netto', key: 'net', align: 'right', format: 'currency', color: 'text-blue-600' }
                ]}
            />

            {/* Assistant Table */}
            <TableCard 
                title="Performance per Assistente" 
                data={reportData?.byAssistant} 
                columns={[
                    { header: 'Nome', key: 'name' },
                    { header: 'Pax', key: 'pax', align: 'right' },
                    { header: 'Incasso', key: 'revenue', align: 'right', format: 'currency', color: 'text-green-600' },
                    { header: 'Comm.', key: 'commission', align: 'right', format: 'currency', color: 'text-orange-600' }
                ]}
            />
          </div>

          {/* Excursion Table */}
          {reportData?.byExcursion && reportData.byExcursion.length > 0 && (
             <TableCard 
                title="Performance per Escursione" 
                data={reportData?.byExcursion} 
                columns={[
                    { header: 'Nome Escursione', key: 'name' },
                    { header: 'Pax', key: 'pax', align: 'right' },
                    { header: 'Incasso', key: 'revenue', align: 'right', format: 'currency', color: 'text-green-600' },
                    { header: 'Comm.', key: 'commission', align: 'right', format: 'currency', color: 'text-orange-600' },
                    { header: 'Netto', key: 'net', align: 'right', format: 'currency', color: 'text-blue-600' }
                ]}
            />
          )}

          {/* Tax section placeholder */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 border-dashed p-6 text-center">
            <h3 className="text-lg font-semibold text-gray-500 mb-2">Sezione Tasse & Non Commissionabile</h3>
            <p className="text-gray-400">Questa sezione è in fase di sviluppo e permetterà di analizzare le tasse portuali e altre voci non soggette a commissione.</p>
          </div>
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
                                    
                                    if (col.format === 'currency') {
                                        value = `€ ${Number(value).toFixed(2)}`
                                    }

                                    return (
                                        <td key={cIdx} className={`px-4 py-3 ${col.align === 'right' ? 'text-right' : ''} ${col.color || 'text-gray-900'} ${cIdx === 0 ? 'font-medium' : ''}`}>
                                            {value}
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
