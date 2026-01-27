'use client'

import { useState, useEffect } from 'react'
import { History, User } from 'lucide-react'

interface AuditLog {
  id: string
  action: string
  details: string
  createdAt: string
  user: {
    firstName: string
    lastName: string
    email: string
  }
}

interface AuditLogListProps {
  excursionId?: string
  transferId?: string
}

export function AuditLogList({ excursionId, transferId }: AuditLogListProps) {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLogs()
  }, [excursionId, transferId])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const url = excursionId 
        ? `/api/excursions/${excursionId}/logs`
        : `/api/transfers/${transferId}/logs`
        
      const res = await fetch(url)
      if (res.ok) {
        setLogs(await res.json())
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

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
      {logs.map((log) => (
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
      ))}
    </div>
  )
}
