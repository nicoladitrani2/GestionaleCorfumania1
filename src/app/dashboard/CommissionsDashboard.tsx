'use client'

import { useState } from 'react'
import { TrendingUp, Award, User, DollarSign, ChevronDown, ChevronUp } from 'lucide-react'

interface CommissionStats {
  userId: string
  userName: string
  supplierName: string
  totalCommission: number
  totalSales: number
  excursionsCount: number
}

interface CommissionsDashboardProps {
  role: string
  currentUserId: string
  stats: CommissionStats[]
}

export function CommissionsDashboard({ role, currentUserId, stats }: CommissionsDashboardProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  if (role === 'ADMIN') {
    const sortedStats = [...stats].sort((a, b) => b.totalCommission - a.totalCommission)

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div 
          className="p-6 bg-gradient-to-r from-emerald-600 to-teal-600 cursor-pointer flex justify-between items-center"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3 text-white">
            <Award className="w-6 h-6" />
            <h3 className="text-lg font-bold">Classifica Commissioni Assistenti</h3>
          </div>
          {isExpanded ? <ChevronUp className="text-white w-5 h-5" /> : <ChevronDown className="text-white w-5 h-5" />}
        </div>
        
        {isExpanded && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500">
                <tr>
                  <th className="px-6 py-4">Posizione</th>
                  <th className="px-6 py-4">Assistente</th>
                  <th className="px-6 py-4">Fornitore</th>
                  <th className="px-6 py-4 text-right">Vendite Totali</th>
                  <th className="px-6 py-4 text-right">Commissioni Totali</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedStats.map((stat, index) => (
                  <tr key={stat.userId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                        index === 0 ? 'bg-yellow-400' :
                        index === 1 ? 'bg-gray-400' :
                        index === 2 ? 'bg-amber-600' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {index + 1}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">{stat.userName}</td>
                    <td className="px-6 py-4">{stat.supplierName || '-'}</td>
                    <td className="px-6 py-4 text-right">€ {stat.totalSales.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-600">€ {stat.totalCommission.toFixed(2)}</td>
                  </tr>
                ))}
                {sortedStats.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-400 italic">
                      Nessun dato disponibile
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  // Assistant View
  const myStats = stats.find(s => s.userId === currentUserId)
  if (!myStats) return null

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
      <div className="p-6 border-b border-gray-100">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          Le tue Performance
        </h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">
        <div className="p-6 flex flex-col items-center text-center">
          <div className="bg-blue-50 p-3 rounded-full text-blue-600 mb-3">
            <User className="w-6 h-6" />
          </div>
          <span className="text-sm text-gray-500 mb-1">Fornitore</span>
          <span className="text-lg font-bold text-gray-900">{myStats.supplierName || '-'}</span>
        </div>
        <div className="p-6 flex flex-col items-center text-center">
          <div className="bg-emerald-50 p-3 rounded-full text-emerald-600 mb-3">
            <DollarSign className="w-6 h-6" />
          </div>
          <span className="text-sm text-gray-500 mb-1">Commissioni Totali</span>
          <span className="text-2xl font-bold text-emerald-600">€ {myStats.totalCommission.toFixed(2)}</span>
        </div>
        <div className="p-6 flex flex-col items-center text-center">
          <div className="bg-purple-50 p-3 rounded-full text-purple-600 mb-3">
            <TrendingUp className="w-6 h-6" />
          </div>
          <span className="text-sm text-gray-500 mb-1">Vendite Totali</span>
          <span className="text-lg font-bold text-gray-900">€ {myStats.totalSales.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}
