'use client'

import { useState, useEffect, useMemo } from 'react'
import { History, User, Filter } from 'lucide-react'

interface AuditLog {
  id: string
  action: string
  details: string
  createdAt: string
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
}

interface AuditLogListProps {
  excursionId?: string
  transferId?: string
  rentalId?: string
}

export function AuditLogList({ excursionId, transferId, rentalId }: AuditLogListProps) {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<string>('ALL')

  useEffect(() => {
    fetchLogs()
  }, [excursionId, transferId, rentalId])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      let url = ''
      if (excursionId) url = `/api/excursions/${excursionId}/logs`
      else if (transferId) url = `/api/transfers/${transferId}/logs`
      else if (rentalId) url = `/api/rentals/${rentalId}/logs`
      
      if (url) {
        const res = await fetch(url)
        if (res.ok) {
          setLogs(await res.json())
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const uniqueUsers = useMemo(() => {
    const users = new Map()
    logs.forEach(log => {
      if (log.user) {
        users.set(log.user.id, `${log.user.firstName} ${log.user.lastName}`)
      }
    })
    return Array.from(users.entries()).map(([id, name]) => ({ id, name }))
  }, [logs])

  const filteredLogs = useMemo(() => {
    if (selectedUser === 'ALL') return logs
    return logs.filter(log => log.user?.id === selectedUser)
  }, [logs, selectedUser])

  const formatAction = (action: string) => {
    switch (action) {
      case 'CREATE_PARTICIPANT': return 'Aggiunta Partecipante'
      case 'UPDATE_PARTICIPANT': return 'Modifica Partecipante'
      case 'DELETE_PARTICIPANT': return 'Eliminazione Partecipante'
      case 'UPDATE_EXCURSION': return 'Modifica Escursione'
      case 'CREATE_EXCURSION': return 'Creazione Escursione'
      case 'CREATE_TRANSFER': return 'Creazione Trasferimento'
      case 'UPDATE_TRANSFER': return 'Modifica Trasferimento'
      case 'DELETE_TRANSFER': return 'Eliminazione Trasferimento'
      case 'APPROVE_PARTICIPANT': return 'Approvazione Sconto'
      case 'REJECT_PARTICIPANT': return 'Rifiuto Sconto'
      default: return action
    }
  }

  const formatDetails = (details: string) => {
    return details
      .replace(/\bBALANCE\b/g, 'Saldo')
      .replace(/\bDEPOSIT\b/g, 'Acconto')
      .replace(/\bCASH\b/g, 'Contanti')
      .replace(/\bTRANSFER\b/g, 'Bonifico')
      .replace(/\bCARD\b/g, 'Carta')
      .replace(/\bCREATE_PARTICIPANT\b/g, 'Aggiunta Partecipante') // Fallback
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Caricamento cronologia...</div>
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <History className="w-12 h-12 mb-4 text-gray-300" />
        <p className="text-lg font-medium">Nessuna attività registrata</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {uniqueUsers.length > 0 && (
        <div className="flex items-center gap-2 mb-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filtra per utente:</span>
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="ALL">Tutti gli utenti</option>
            {uniqueUsers.map(user => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
          </select>
        </div>
      )}

      {filteredLogs.length === 0 && selectedUser !== 'ALL' ? (
        <div className="text-center py-8 text-gray-500 italic">
          Nessuna attività trovata per questo utente.
        </div>
      ) : (
        filteredLogs.map((log) => (
        <div key={log.id} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-50 rounded-full mt-1">
                <User className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900">
                    {log.user.firstName} {log.user.lastName}
                  </span>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    {new Date(log.createdAt).toLocaleString('it-IT')}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-blue-700 mb-1">
                  {formatAction(log.action)}
                </h4>
                <p className="text-sm text-gray-600">
                  {formatDetails(log.details)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )))}
    </div>
  )
}
