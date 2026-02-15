'use client'

import { useState, useEffect, useMemo } from 'react'
import { Award, User, Euro, Store } from 'lucide-react'

interface TransferLeaderboardProps {
  transfer: any
  userRole: string
}

export function TransferLeaderboard({ transfer, userRole }: TransferLeaderboardProps) {
  const [participants, setParticipants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchParticipants = async () => {
    try {
      const res = await fetch(`/api/participants?transferId=${transfer.id}`)
      if (res.ok) {
        const data = await res.json()
        setParticipants(data)
      }
    } catch (error) {
      console.error('Error fetching participants for transfer leaderboard:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchParticipants()
    const interval = setInterval(fetchParticipants, 30000)
    return () => clearInterval(interval)
  }, [transfer.id])

  const leaderboardStats = useMemo(() => {
    if (!participants.length) return []

    const statsMap = new Map()

    participants.forEach((p) => {
      if (p.paymentType === 'REFUNDED' || p.isExpired) return

      const owner = p.assignedTo || p.createdBy
      const ownerId = p.assignedToId || p.createdById
      if (!ownerId) return

      if (!statsMap.has(ownerId)) {
        statsMap.set(ownerId, {
          userId: ownerId,
          userName:
            `${owner?.firstName || ''} ${owner?.lastName || ''}`.trim() ||
            owner?.email ||
            'Sconosciuto',
          agencyName: owner?.agency?.name || '-',
          agencyId: owner?.agencyId,
          totalSales: 0,
          totalCommission: 0,
          count: 0,
        })
      }

      const stats = statsMap.get(ownerId)

      const amountPaid = p.deposit || 0

      stats.totalSales += amountPaid
      stats.count += 1

      const agency = owner?.agency
      const agencyId = owner?.agencyId

      if (agencyId) {
        let ruleType = agency?.commissionType || 'PERCENTAGE'
        let ruleValue = agency?.defaultCommission || 0

        if (transfer?.commissions) {
          const commConfig = transfer.commissions.find(
            (c: any) => c.agencyId === agencyId
          )
          if (commConfig) {
            ruleValue = commConfig.commissionPercentage
            ruleType = commConfig.commissionType || ruleType
          }
        }

        if (ruleType === 'FIXED') {
          const adults = p.adults || 0
          const children = p.children || 0
          const infants = p.infants || 0
          const count = adults + children + infants > 0 ? adults + children + infants : 1
          stats.totalCommission += count * ruleValue
        } else {
          stats.totalCommission += amountPaid * (ruleValue / 100)
        }
      }
    })

    return Array.from(statsMap.values()).sort(
      (a: any, b: any) => b.totalCommission - a.totalCommission
    )
  }, [participants, transfer])

  if (userRole !== 'ADMIN') {
    return (
      <div className="p-8 text-center text-gray-500">
        <Award className="w-12 h-12 mx-auto text-gray-300 mb-3" />
        <p>Non hai i permessi per visualizzare questa classifica.</p>
      </div>
    )
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Caricamento classifica...</div>
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-100 p-6 sm:p-7">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 bg-amber-100 rounded-xl">
            <Award className="w-7 h-7 text-amber-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-amber-950 tracking-tight">
              Classifica Commissioni Assistenti
            </h3>
            <p className="text-amber-800/80 text-sm sm:text-base">
              Performance vendite per <span className="font-semibold">{transfer.name}</span>
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-amber-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-amber-50/70">
                <tr>
                  <th className="px-6 py-4 text-left text-xs sm:text-sm font-semibold text-amber-900 uppercase tracking-wide w-16">
                    Pos
                  </th>
                  <th className="px-6 py-4 text-left text-xs sm:text-sm font-semibold text-amber-900 uppercase tracking-wide">
                    Assistente
                  </th>
                  <th className="px-6 py-4 text-left text-xs sm:text-sm font-semibold text-amber-900 uppercase tracking-wide">
                    Agenzia
                  </th>
                  <th className="px-6 py-4 text-right text-xs sm:text-sm font-semibold text-amber-900 uppercase tracking-wide">
                    Vendite Totali
                  </th>
                  <th className="px-6 py-4 text-right text-xs sm:text-sm font-semibold text-amber-900 uppercase tracking-wide">
                    Commissioni
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leaderboardStats.map((stat: any, index: number) => (
                  <tr key={stat.userId} className="hover:bg-amber-50/40 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div
                        className={`
                        w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shadow-sm
                        ${
                          index === 0
                            ? 'bg-yellow-100 text-yellow-800 ring-4 ring-yellow-200'
                            : index === 1
                            ? 'bg-gray-100 text-gray-700'
                            : index === 2
                            ? 'bg-orange-100 text-orange-800'
                            : 'text-gray-500 bg-gray-50'
                        }
                      `}
                      >
                        {index + 1}
                      </div>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-gray-100 rounded-full">
                          <User className="w-4 h-4 text-gray-500" />
                        </div>
                        <span className="font-semibold text-gray-900">{stat.userName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-gray-700">
                        <Store className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{stat.agencyName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-right">
                      <span className="font-mono text-gray-800">
                        € {stat.totalSales.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-right">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 text-amber-800 border border-amber-100 font-mono font-semibold">
                        <Euro className="w-3.5 h-3.5" />
                        {stat.totalCommission.toFixed(2)}
                      </div>
                    </td>
                  </tr>
                ))}
                {leaderboardStats.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-12 text-center text-gray-500 italic"
                    >
                      Nessun dato disponibile per questo trasferimento
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
