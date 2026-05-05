'use client'

import { useState, useEffect, useMemo } from 'react'
import { Award, User, Euro, Store } from 'lucide-react'

interface ExcursionLeaderboardProps {
  excursion: any
  userRole: string
}

export function ExcursionLeaderboard({ excursion, userRole }: ExcursionLeaderboardProps) {
  const [participants, setParticipants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  if (userRole !== 'ADMIN') {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold text-red-600">Accesso Negato</h2>
        <p className="text-gray-600">Non hai i permessi per accedere a questa sezione.</p>
      </div>
    )
  }

  const fetchParticipants = async () => {
    try {
      const res = await fetch(`/api/participants?excursionId=${excursion.id}`)
      if (res.ok) {
        const data = await res.json()
        setParticipants(data)
      }
    } catch (error) {
      console.error('Error fetching participants for leaderboard:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchParticipants()
    // Optional: Add polling if needed
    const interval = setInterval(fetchParticipants, 30000) // 30s polling
    return () => clearInterval(interval)
  }, [excursion.id])

  const leaderboardStats = useMemo(() => {
    if (!participants.length) return []

    const statsMap = new Map()

    participants.forEach(p => {
      // Filter invalid
      const approval =
        p.approvalStatus ||
        (p.paymentStatus === 'PENDING_APPROVAL'
          ? 'PENDING'
          : p.paymentStatus === 'REJECTED'
            ? 'REJECTED'
            : undefined)
      if (approval === 'PENDING' || approval === 'REJECTED') return
      if (p.status && p.status !== 'ACTIVE') return
      if (p.paymentType === 'REFUNDED' || p.isExpired) return

      const owner = p.assignedTo || p.createdBy
      const ownerId = p.assignedToId || p.createdById
      if (!ownerId) return

      if (!statsMap.has(ownerId)) {
        const ownerRole = String(owner?.role || '')
        const ownerAgencyNameRaw = owner?.agency?.name || (ownerRole === 'ADMIN' ? 'Corfumania' : null)
        const ownerAgencyName = ownerAgencyNameRaw || '-'
        statsMap.set(ownerId, {
          userId: ownerId,
          userName: `${owner?.firstName || ''} ${owner?.lastName || ''}`.trim() || owner?.email || 'Sconosciuto',
          agencyName: ownerAgencyName,
          agencyId: owner?.agencyId,
          totalSales: 0,
          totalCommission: 0,
          count: 0
        })
      }

      const stats = statsMap.get(ownerId)

      // Calculate commission based on actual payment (deposit)
      // If paymentType is BALANCE, deposit should be equal to price (full payment)
      // If paymentType is DEPOSIT, deposit is the partial amount
      // If REFUNDED, we skip (0 commission)
      const amountPaid = p.deposit || 0
      
      stats.totalSales += amountPaid
      stats.count += 1

      const tax = Number(p.tax || 0)
      const commissionable = Math.max(0, amountPaid - tax)
      const pool = commissionable * 0.2
      const pax = Math.max(1, (p.adults || 0) + (p.children || 0) + (p.infants || 0))

      const ownerRole = String(owner?.role || '')
      const ownerAgencyNameRaw = owner?.agency?.name || (ownerRole === 'ADMIN' ? 'Corfumania' : null)
      const ownerAgencyNameLower = String(ownerAgencyNameRaw || '').trim().toLowerCase()
      const isGo4Sea = ownerAgencyNameLower.includes('go4sea')
      const isCorfumania = ownerRole === 'ADMIN' || ownerAgencyNameLower.includes('corfumania')
      const isSpecial = !!owner?.isSpecialAssistant

      let agentShare = 0
      if (isSpecial) {
        agentShare = Math.min(commissionable * 0.10, pool)
      } else if (isGo4Sea) {
        agentShare = Math.min(commissionable * 0.05, pool)
      } else if (isCorfumania) {
        agentShare = Math.min(pax * 1, pool)
      } else {
        const rawAgentType = p.assistantCommissionType || owner?.agency?.commissionType || 'PERCENTAGE'
        const rawAgentValue =
          p.assistantCommission !== null && p.assistantCommission !== undefined && Number(p.assistantCommission) > 0
            ? Number(p.assistantCommission)
            : Number(owner?.agency?.defaultCommission || 0)
        const agentType = String(rawAgentType || 'PERCENTAGE')
        const agentValue = Number.isFinite(rawAgentValue) ? rawAgentValue : 0
        if (agentValue > 0) {
          const raw =
            agentType === 'FIXED'
              ? Math.max(0, pax * agentValue)
              : Math.max(0, commissionable * (agentValue / 100))
          agentShare = Math.min(raw, pool)
        }
      }

      stats.totalCommission += agentShare
    })

    return Array.from(statsMap.values()).sort((a: any, b: any) => b.totalCommission - a.totalCommission)
  }, [participants, excursion])

  if (loading) {
      return <div className="p-8 text-center text-gray-500">Caricamento classifica...</div>
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-100 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-amber-100 rounded-lg">
            <Award className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-amber-900">Classifica Commissioni Assistenti</h3>
            <p className="text-amber-700/80 text-sm">Performance vendite per {excursion.name}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-amber-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-amber-50/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-amber-800 uppercase tracking-wider w-16">
                    Pos
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-amber-800 uppercase tracking-wider">
                    Assistente
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-amber-800 uppercase tracking-wider">
                    Agenzia
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-amber-800 uppercase tracking-wider">
                    Vendite Totali
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-amber-800 uppercase tracking-wider">
                    Commissioni
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leaderboardStats.map((stat: any, index: number) => (
                  <tr 
                    key={stat.userId}
                    className="hover:bg-amber-50/30 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`
                        w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                        ${index === 0 ? 'bg-yellow-100 text-yellow-700 ring-4 ring-yellow-50' : 
                          index === 1 ? 'bg-gray-100 text-gray-700' : 
                          index === 2 ? 'bg-orange-100 text-orange-800' : 
                          'text-gray-500 bg-gray-50'}
                      `}>
                        {index + 1}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-gray-100 rounded-full">
                          <User className="w-4 h-4 text-gray-500" />
                        </div>
                        <span className="font-medium text-gray-900">{stat.userName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Store className="w-4 h-4 text-gray-400" />
                        {stat.agencyName}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="font-mono text-gray-600">€ {stat.totalSales.toFixed(2)}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100 font-mono font-medium">
                        <Euro className="w-3.5 h-3.5" />
                        {stat.totalCommission.toFixed(2)}
                      </div>
                    </td>
                  </tr>
                ))}
                {leaderboardStats.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500 italic">
                      Nessun dato disponibile per questa escursione
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
