'use client'

import { useState, useEffect } from 'react'
import { Euro, TrendingUp, Building, Users } from 'lucide-react'

interface FinancialSummaryProps {
  entityId: string
  type: 'EXCURSION' | 'TRANSFER'
  refreshTrigger?: number
  commissionConfigs?: Array<{ agencyId: string; commissionPercentage: number; commissionType?: string }>
}

export function FinancialSummary({ entityId, type, refreshTrigger = 0, commissionConfigs = [] }: FinancialSummaryProps) {
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

  // Escludi dal calcolo:
  // - partecipanti con sconto rifiutato
  // - partecipanti con pagamento in attesa di approvazione
  const validParticipants = participants.filter(
    (p) => p.paymentStatus !== 'PENDING_APPROVAL' && p.approvalStatus !== 'REJECTED'
  )

  // --- Calculations ---
  
  // 1. Suppliers Map
  const suppliersMap = new Map<string, { name: string, total: number, count: number }>()
  
  const agentsMap = new Map<string, { name: string, total: number, count: number }>()
  const agenciesMap = new Map<string, { name: string, total: number, count: number }>()
  let corfumaniaTotal = 0

  validParticipants.forEach(p => {
    let isRetained = false
    let effectivePrice = (typeof p.deposit === 'number' ? p.deposit : (p.paidAmount ?? p.price)) || 0
    let effectiveCount = (p.adults || 0) + (p.children || 0) + (p.infants || 0)
    let tax = p.tax || 0
    if (!effectiveCount || effectiveCount <= 0) effectiveCount = 1

    if (p.paymentType === 'REFUNDED') {
            const deposit = p.deposit || 0
            const price = p.price || 0
            // Consider as Retained Deposit only if partial payment (deposit < price)
            if (deposit > 0 && deposit < price) {
                isRetained = true
                effectivePrice = deposit
                effectiveCount = (p.adults || 0) + (p.children || 0) + (p.infants || 0) // Count pax for fixed commissions
            } else {
                return // Skip full refund
            }
        }

        const commissionable = Math.max(0, effectivePrice - tax)
        const pool = commissionable * 0.2

        // Suppliers
        const supplierName = p.supplier || 'N/A' 
        const currentSupplier = suppliersMap.get(supplierName) || { name: supplierName, total: 0, count: 0 }
        suppliersMap.set(supplierName, {
          name: supplierName,
          total: currentSupplier.total + commissionable,
          count: currentSupplier.count + effectiveCount
        })

        const owner = p.assignedTo || p.createdBy
        const ownerId = owner?.id || p.assignedToId || p.createdById || null
        const ownerName = `${owner?.firstName || ''} ${owner?.lastName || ''}`.trim() || owner?.email || 'Sconosciuto'
        const ownerRole = String(owner?.role || '')
        const ownerAgencyId = owner?.agencyId || owner?.agency?.id || null
        const ownerAgencyNameRaw = owner?.agency?.name || (ownerRole === 'ADMIN' ? 'Corfumania' : null)
        const ownerAgencyName = ownerAgencyNameRaw || 'Diretto/Nessuna'
        const ownerAgencyNameLower = String(ownerAgencyName).toLowerCase()
        const isGo4Sea = ownerAgencyNameLower.includes('go4sea')
        const isCorfumania = ownerAgencyNameLower.includes('corfumania')
        const isSpecial = !!owner?.isSpecialAssistant

        let agentShare = 0
        if (isSpecial) {
          agentShare = Math.min(commissionable * 0.10, pool)
        } else if (isGo4Sea) {
          agentShare = Math.min(commissionable * 0.05, pool)
        } else if (isCorfumania) {
          agentShare = Math.min(effectiveCount * 1, pool)
        } else {
          const rawAgentType = p.assistantCommissionType || owner?.agency?.commissionType || 'PERCENTAGE'
          const rawAgentValue =
            p.assistantCommission !== null && p.assistantCommission !== undefined && Number(p.assistantCommission) > 0
              ? Number(p.assistantCommission)
              : Number(owner?.agency?.defaultCommission || 0)
          const agentType = String(rawAgentType || 'PERCENTAGE')

          if (rawAgentValue > 0) {
            const raw =
              agentType === 'FIXED'
                ? Math.max(0, effectiveCount * rawAgentValue)
                : Math.max(0, commissionable * (rawAgentValue / 100))
            agentShare = Math.min(raw, pool)
          }
        }

        if (agentShare > 0) {
          const agentKey = `${String(ownerId || ownerName)}::${ownerAgencyName}`
          const agentLabel = `${ownerName} (${ownerAgencyName})`
          const currentAgent = agentsMap.get(agentKey) || { name: agentLabel, total: 0, count: 0 }
          agentsMap.set(agentKey, {
            name: agentLabel,
            total: currentAgent.total + agentShare,
            count: currentAgent.count + effectiveCount
          })
        }

        let remainingPool = Math.max(0, pool - agentShare)

        let agencyShare = 0
        if (isSpecial && remainingPool > 0) {
          if (isCorfumania) {
            agencyShare = 0
          } else if (ownerAgencyName !== 'Diretto/Nessuna') {
            agencyShare = remainingPool
            remainingPool = 0
          }
        } else if (isGo4Sea && remainingPool > 0) {
          agencyShare = Math.min(commissionable * 0.10, remainingPool)
          remainingPool = Math.max(0, remainingPool - agencyShare)
        } else if (!isCorfumania && ownerAgencyId && ownerAgencyName !== 'Diretto/Nessuna' && remainingPool > 0) {
          const cfg = commissionConfigs.find(c => c.agencyId === ownerAgencyId)
          if (cfg) {
            const cfgType = String(cfg.commissionType || 'PERCENTAGE')
            const cfgValue = Number(cfg.commissionPercentage || 0)
            const raw =
              cfgType === 'FIXED'
                ? Math.max(0, effectiveCount * cfgValue)
                : Math.max(0, commissionable * (cfgValue / 100))
            agencyShare = Math.min(raw, remainingPool)
            remainingPool = Math.max(0, remainingPool - agencyShare)
          }
        }

        if (agencyShare > 0 && ownerAgencyName !== 'Diretto/Nessuna' && !isCorfumania) {
          const currentAgency = agenciesMap.get(ownerAgencyName) || { name: ownerAgencyName, total: 0, count: 0 }
          agenciesMap.set(ownerAgencyName, {
            name: ownerAgencyName,
            total: currentAgency.total + agencyShare,
            count: currentAgency.count + effectiveCount
          })
        }

        corfumaniaTotal += remainingPool
      })

      const supplierRows = Array.from(suppliersMap.values()).map(s => ({
        ...s,
        supplierShare: s.total * 0.80 // 80% to supplier
      }))

      const totalSupplierShare = supplierRows.reduce((acc, r) => acc + r.supplierShare, 0)

      const agentRows = Array.from(agentsMap.values()).sort((a, b) => b.total - a.total)
      const totalAgents = agentRows.reduce((acc, r) => acc + r.total, 0)

      const agencyRows = Array.from(agenciesMap.values()).sort((a, b) => b.total - a.total)
      const totalAgencies = agencyRows.reduce((acc, r) => acc + r.total, 0)
      const totalCorfumania = corfumaniaTotal


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

          {/* Colonna 2: Agenti */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col h-full">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
               <Users className="w-5 h-5 text-indigo-600" />
               <h3 className="font-bold text-gray-800">Agenti</h3>
            </div>
            <div className="flex-1 overflow-auto">
               <table className="w-full text-sm text-left">
                 <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                    <tr>
                       <th className="px-3 py-2">Agente</th>
                       <th className="px-3 py-2 text-right">Incasso</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100">
                    {agentRows.map((r, i) => (
                      <tr key={i}>
                         <td className="px-3 py-2 font-medium text-gray-700">
                            {r.name}
                         </td>
                         <td className="px-3 py-2 text-right font-mono text-gray-600">€ {r.total.toFixed(2)}</td>
                      </tr>
                    ))}
                    {agentRows.length === 0 && (
                      <tr>
                        <td colSpan={2} className="px-3 py-4 text-center text-gray-400 text-xs">Nessun agente</td>
                      </tr>
                    )}
                 </tbody>
               </table>
            </div>
             <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center bg-gray-50 p-3 rounded-lg">
               <span className="font-semibold text-gray-700">Totale Agenti</span>
               <span className="font-bold text-indigo-600 text-lg">€ {totalAgents.toFixed(2)}</span>
            </div>
          </div>

          {/* Colonna 3: Agenzie & Corfumania */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col h-full">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
               <TrendingUp className="w-5 h-5 text-green-600" />
               <h3 className="font-bold text-gray-800">Agenzie & Corfumania</h3>
            </div>
            <div className="flex-1 overflow-auto">
               <table className="w-full text-sm text-left">
                 <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                    <tr>
                       <th className="px-3 py-2">Beneficiario</th>
                       <th className="px-3 py-2 text-right">Incasso</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100">
                    {agencyRows.map((r, i) => (
                      <tr key={i}>
                         <td className="px-3 py-2 font-medium text-gray-700">{r.name}</td>
                         <td className="px-3 py-2 text-right font-mono text-gray-600">€ {r.total.toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="px-3 py-2 font-medium text-gray-700">Corfumania</td>
                      <td className="px-3 py-2 text-right font-mono text-green-600 font-bold">€ {totalCorfumania.toFixed(2)}</td>
                    </tr>
                    {agencyRows.length === 0 && totalCorfumania <= 0 && (
                      <tr>
                        <td colSpan={2} className="px-3 py-4 text-center text-gray-400 text-xs">Nessun dato</td>
                      </tr>
                    )}
                 </tbody>
               </table>
            </div>
             <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center bg-green-50 p-3 rounded-lg border border-green-100">
               <span className="font-semibold text-green-800">Totale</span>
               <span className="font-bold text-green-700 text-lg">€ {(totalAgencies + totalCorfumania).toFixed(2)}</span>
            </div>
          </div>
       </div>
    </div>
  )
}
