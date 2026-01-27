'use client'

import { useState, useEffect } from 'react'
import { Euro, TrendingUp, Building, Users } from 'lucide-react'

interface FinancialSummaryProps {
  entityId: string
  type: 'EXCURSION' | 'TRANSFER'
  refreshTrigger?: number
}

export function FinancialSummary({ entityId, type, refreshTrigger = 0 }: FinancialSummaryProps) {
  const [participants, setParticipants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchParticipants()
  }, [entityId, refreshTrigger])

  const fetchParticipants = async () => {
    try {
      const endpoint = type === 'EXCURSION' 
        ? `/api/participants?excursionId=${entityId}`
        : `/api/participants?transferId=${entityId}`
      
      const res = await fetch(endpoint)
      if (res.ok) {
        setParticipants(await res.json())
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="flex justify-center items-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  )

  // Filter valid participants (exclude REJECTED)
  // Only exclude REJECTED as per user request ("solo nella lista dei non confermati")
  const validParticipants = participants.filter(p => p.approvalStatus !== 'REJECTED')

  // --- Calculations ---
  
  // 1. Suppliers Map
  const suppliersMap = new Map<string, { name: string, total: number, count: number }>()
  
  // 2. Agencies Map
  const agenciesMap = new Map<string, { name: string, commissionableTotal: number, count: number, commissionType: string, commissionValue: number, retained: number }>()

  validParticipants.forEach(p => {
    let isRetained = false
    let effectivePrice = p.price || 0
    let effectiveCount = p.groupSize || 1

    if (p.paymentType === 'REFUNDED') {
            const deposit = p.deposit || 0
            const price = p.price || 0
            // Consider as Retained Deposit only if partial payment (deposit < price)
            if (deposit > 0 && deposit < price) {
                isRetained = true
                effectivePrice = deposit
                effectiveCount = p.groupSize || 1 // Count pax for fixed commissions
            } else {
                return // Skip full refund
            }
        }

        // Suppliers
        const supplierName = p.supplier || 'N/A' 
        const currentSupplier = suppliersMap.get(supplierName) || { name: supplierName, total: 0, count: 0 }
        suppliersMap.set(supplierName, {
          name: supplierName,
          total: currentSupplier.total + effectivePrice,
          count: currentSupplier.count + effectiveCount
        })

        // Agencies
        let agencyName = p.createdBy?.agency?.name
        let commissionType = p.createdBy?.agency?.commissionType || 'PERCENTAGE'
        let commissionValue = p.createdBy?.agency?.defaultCommission || 0 

        // Fallback for Admin (Corfumania)
        if (!agencyName) {
           if (p.createdBy?.role === 'ADMIN') {
               agencyName = 'Corfumania'
               commissionType = 'FIXED'
               commissionValue = 1.0
           } else {
               agencyName = 'Diretto/Nessuna'
           }
        }
        
        const currentAgency = agenciesMap.get(agencyName) || { 
          name: agencyName, 
          commissionableTotal: 0, 
          count: 0,
          commissionType,
          commissionValue,
          retained: 0
        }
        
        agenciesMap.set(agencyName, {
          ...currentAgency,
          commissionableTotal: currentAgency.commissionableTotal + effectivePrice,
          count: currentAgency.count + effectiveCount,
          retained: 0 
        })
      })

      const supplierRows = Array.from(suppliersMap.values()).map(s => ({
        ...s,
        supplierShare: s.total * 0.80 // 80% to supplier
      }))

      const totalSupplierShare = supplierRows.reduce((acc, r) => acc + r.supplierShare, 0)


      const agencyRows = Array.from(agenciesMap.values()).map(a => {
        let agencyShare = 0
        
        if (a.commissionType === 'FIXED') {
          // Fixed amount per person (e.g. 1€ * count)
          agencyShare = a.count * a.commissionValue
        } else {
          // Percentage of COMMISSIONABLE TOTAL (e.g. 5% of total)
          agencyShare = a.commissionableTotal * (a.commissionValue / 100)
        }

        // Net Profit Logic
        // Total Revenue - Supplier Share (80%) - Agency Share
        const supplierCost = a.commissionableTotal * 0.80
        const netProfit = (a.commissionableTotal - supplierCost - agencyShare)

        return {
          ...a,
          agencyShare,
          netProfit,
          total: a.commissionableTotal // For display if needed
        }
      })

  const totalAgencyShare = agencyRows.reduce((acc, r) => acc + r.agencyShare, 0)
  const totalNetProfit = agencyRows.reduce((acc, r) => acc + r.netProfit, 0)


  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Colonna 1: Fornitori */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col h-full">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
               <Users className="w-5 h-5 text-blue-600" />
               <h3 className="font-bold text-gray-800">Fornitori (80%)</h3>
            </div>
            <div className="flex-1 overflow-auto">
               <table className="w-full text-sm text-left">
                 <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                    <tr>
                       <th className="px-3 py-2">Fornitore</th>
                       <th className="px-3 py-2 text-right">Quota (80%)</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100">
                    {supplierRows.map((r, i) => (
                      <tr key={i}>
                         <td className="px-3 py-2 font-medium text-gray-700">{r.name}</td>
                         <td className="px-3 py-2 text-right font-mono text-gray-600">€ {r.supplierShare.toFixed(2)}</td>
                      </tr>
                    ))}
                    {supplierRows.length === 0 && (
                      <tr>
                        <td colSpan={2} className="px-3 py-4 text-center text-gray-400 text-xs">Nessun fornitore</td>
                      </tr>
                    )}
                 </tbody>
               </table>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center bg-gray-50 p-3 rounded-lg">
               <span className="font-semibold text-gray-700">Totale Fornitori</span>
               <span className="font-bold text-blue-600 text-lg">€ {totalSupplierShare.toFixed(2)}</span>
            </div>
          </div>

          {/* Colonna 2: Agenzie */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col h-full">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
               <Building className="w-5 h-5 text-indigo-600" />
               <h3 className="font-bold text-gray-800">Agenzie</h3>
            </div>
            <div className="flex-1 overflow-auto">
               <table className="w-full text-sm text-left">
                 <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                    <tr>
                       <th className="px-3 py-2">Agenzia</th>
                       <th className="px-3 py-2 text-right">Commissione</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100">
                    {agencyRows.map((r, i) => (
                      <tr key={i}>
                         <td className="px-3 py-2 font-medium text-gray-700">
                            {r.name}
                            <span className="block text-[10px] text-gray-400 font-normal">
                              {r.commissionType === 'FIXED' ? `Fisso: €${r.commissionValue}/pax` : `${r.commissionValue}%`}
                            </span>
                         </td>
                         <td className="px-3 py-2 text-right font-mono text-gray-600">€ {r.agencyShare.toFixed(2)}</td>
                      </tr>
                    ))}
                    {agencyRows.length === 0 && (
                      <tr>
                        <td colSpan={2} className="px-3 py-4 text-center text-gray-400 text-xs">Nessuna agenzia</td>
                      </tr>
                    )}
                 </tbody>
               </table>
            </div>
             <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center bg-gray-50 p-3 rounded-lg">
               <span className="font-semibold text-gray-700">Totale Agenzie</span>
               <span className="font-bold text-indigo-600 text-lg">€ {totalAgencyShare.toFixed(2)}</span>
            </div>
          </div>

          {/* Colonna 3: Netto */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col h-full">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
               <TrendingUp className="w-5 h-5 text-green-600" />
               <h3 className="font-bold text-gray-800">Netto Agenzia</h3>
            </div>
            <div className="flex-1 overflow-auto">
               <table className="w-full text-sm text-left">
                 <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                    <tr>
                       <th className="px-3 py-2">Agenzia</th>
                       <th className="px-3 py-2 text-right">Netto</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100">
                    {agencyRows.map((r, i) => (
                      <tr key={i}>
                         <td className="px-3 py-2 font-medium text-gray-700">{r.name}</td>
                         <td className="px-3 py-2 text-right font-mono text-green-600 font-bold">€ {r.netProfit.toFixed(2)}</td>
                      </tr>
                    ))}
                    {agencyRows.length === 0 && (
                      <tr>
                        <td colSpan={2} className="px-3 py-4 text-center text-gray-400 text-xs">Nessun dato</td>
                      </tr>
                    )}
                 </tbody>
               </table>
            </div>
             <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center bg-green-50 p-3 rounded-lg border border-green-100">
               <span className="font-semibold text-green-800">Totale Netto</span>
               <span className="font-bold text-green-700 text-lg">€ {totalNetProfit.toFixed(2)}</span>
            </div>
          </div>
       </div>
    </div>
  )
}
