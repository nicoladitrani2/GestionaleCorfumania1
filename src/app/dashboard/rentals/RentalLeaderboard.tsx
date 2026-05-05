'use client'

import { useState, useEffect, useMemo } from 'react'
import { Award, User, Euro, Car, Store } from 'lucide-react'

interface RentalLeaderboardProps {
  userRole: string
}

export function RentalLeaderboard({ userRole }: RentalLeaderboardProps) {
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
      const res = await fetch(`/api/participants?isRental=true`)
      if (res.ok) {
        const data = await res.json()
        setParticipants(data)
      }
    } catch (error) {
      console.error('Error fetching participants for rental leaderboard:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchParticipants()
    const interval = setInterval(fetchParticipants, 30000)
    return () => clearInterval(interval)
  }, [])

  const leaderboardStats = useMemo(() => {
    if (!participants.length) return []

    const statsMap = new Map()

    participants.forEach((p) => {
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
        statsMap.set(ownerId, {
          userId: ownerId,
          userName:
            `${owner?.firstName || ''} ${owner?.lastName || ''}`.trim() ||
            owner?.email ||
            'Sconosciuto',
          agencyName: owner?.agency?.name || '-',
          totalSales: 0,
          totalCommission: 0,
          count: 0,
        })
      }

      const stats = statsMap.get(ownerId)

      const amountPaid = p.deposit || 0
      stats.totalSales += amountPaid
      stats.count += 1

      const agentShare = typeof p.rentalAgentShare === 'number' ? p.rentalAgentShare : 0
      stats.totalCommission += agentShare
    })

    return Array.from(statsMap.values()).sort(
      (a: any, b: any) => b.totalCommission - a.totalCommission
    )
  }, [participants])

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Caricamento classifica...</div>
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-6 sm:p-7">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 bg-blue-100 rounded-xl">
            <Award className="w-7 h-7 text-blue-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-blue-950 tracking-tight">
              Classifica Commissioni Noleggi
            </h3>
            <p className="text-blue-800/80 text-sm sm:text-base">
              Performance vendite per Noleggi
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-blue-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-blue-50/70">
                <tr>
                  <th className="px-6 py-4 text-left text-xs sm:text-sm font-semibold text-blue-900 uppercase tracking-wide w-16">
                    Pos
                  </th>
                  <th className="px-6 py-4 text-left text-xs sm:text-sm font-semibold text-blue-900 uppercase tracking-wide">
                    Assistente
                  </th>
                  <th className="px-6 py-4 text-left text-xs sm:text-sm font-semibold text-blue-900 uppercase tracking-wide">
                    Agenzia
                  </th>
                  <th className="px-6 py-4 text-right text-xs sm:text-sm font-semibold text-blue-900 uppercase tracking-wide">
                    Vendite Totali
                  </th>
                  <th className="px-6 py-4 text-right text-xs sm:text-sm font-semibold text-blue-900 uppercase tracking-wide">
                    Commissioni
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leaderboardStats.map((stat: any, index: number) => (
                  <tr key={stat.userId} className="hover:bg-blue-50/40 transition-colors">
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
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 text-blue-800 border border-blue-100 font-mono font-semibold">
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
                      Nessun dato disponibile
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
