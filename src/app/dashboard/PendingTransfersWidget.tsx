'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, Loader2, Bus } from 'lucide-react'

interface PendingTransfer {
  id: string
  name: string
  date: string
  confirmationDeadline?: string | null
}

export function PendingTransfersWidget() {
  const [items, setItems] = useState<PendingTransfer[]>([])
  const [capacityItems, setCapacityItems] = useState<Array<{
    id: string
    name: string
    date: string
    requestedMaxParticipants: number
    requestedByLabel: string
  }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPending = async () => {
      try {
        const [resPending, resCapacity] = await Promise.all([
          fetch('/api/transfers?pending=true'),
          fetch('/api/transfers?capacityPending=true')
        ])

        const now = new Date()
        const todayStart = new Date(now)
        todayStart.setHours(0, 0, 0, 0)

        if (resPending.ok) {
          const data = await resPending.json()
          const mapped = (data || []).map((t: any) => ({
            id: t.id,
            name: t.name,
            date: t.date,
            confirmationDeadline: t.confirmationDeadline ?? null
          }))
          const filtered = mapped.filter((t: PendingTransfer) => {
            const transferDate = new Date(t.date)
            if (transferDate < todayStart) return false
            if (t.confirmationDeadline) {
              const deadline = new Date(t.confirmationDeadline)
              if (deadline < now) return false
            }
            return true
          })
          setItems(filtered)
        } else {
          setItems([])
        }

        if (resCapacity.ok) {
          const data = await resCapacity.json()
          const mapped = (data || []).map((t: any) => {
            const req = t?.pendingCapacityRequest
            const by = req?.requestedBy
            const requestedByLabel =
              `${by?.firstName || ''} ${by?.lastName || ''}`.trim() || by?.email || by?.id || 'Utente'
            return {
              id: t.id,
              name: t.name,
              date: t.date,
              requestedMaxParticipants: Number(req?.requestedMaxParticipants || 0),
              requestedByLabel
            }
          }).filter((x: any) => x && x.requestedMaxParticipants > 0)

          const filtered = mapped.filter((t: any) => {
            const transferDate = new Date(t.date)
            return transferDate >= todayStart
          })
          setCapacityItems(filtered)
        } else {
          setCapacityItems([])
        }
      } catch (e) {
        setItems([])
        setCapacityItems([])
      } finally {
        setLoading(false)
      }
    }

    fetchPending()
    const interval = setInterval(fetchPending, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="bg-white overflow-hidden rounded-lg shadow border border-orange-200 mb-4">
        <div className="p-4 bg-orange-50 border-b border-orange-200 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-orange-600" />
          <h3 className="text-sm font-semibold text-orange-900">
            Richieste in attesa di approvazione
          </h3>
        </div>
        <div className="p-4 flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Caricamento...
        </div>
      </div>
    )
  }

  if (!items.length && !capacityItems.length) return null

  return (
    <div className="bg-white overflow-hidden rounded-lg shadow border border-red-300 mb-4">
      <div className="p-4 bg-red-50 border-b border-red-200 flex items-center gap-2">
        <AlertCircle className="h-5 w-5 text-red-600" />
        <h3 className="text-sm font-semibold text-red-900">
          Richieste da gestire ({items.length + capacityItems.length})
        </h3>
      </div>
      <div className="p-4 space-y-4">
        {items.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Trasferimenti da approvare</div>
            <ul className="space-y-1 text-sm text-gray-700">
              {items.slice(0, 5).map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Bus className="h-4 w-4 text-orange-500" />
                    <span className="truncate max-w-[220px]">{t.name}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(t.date).toLocaleDateString('it-IT')}
                  </span>
                </li>
              ))}
              {items.length > 5 && (
                <li className="text-xs text-gray-500">
                  +{items.length - 5} altri trasferimenti in attesa
                </li>
              )}
            </ul>
            <div className="pt-3 border-t border-gray-100 flex justify-end">
              <Link
                href="/dashboard/transfers"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Vai ai trasferimenti
              </Link>
            </div>
          </div>
        )}

        {capacityItems.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Richieste aumento posti</div>
            <ul className="space-y-1 text-sm text-gray-700">
              {capacityItems.slice(0, 5).map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Bus className="h-4 w-4 text-red-500 shrink-0" />
                    <span className="truncate max-w-[220px]">{t.name}</span>
                  </div>
                  <span className="text-xs text-gray-600 font-mono">
                    {t.requestedMaxParticipants} pax
                  </span>
                </li>
              ))}
              {capacityItems.length > 5 && (
                <li className="text-xs text-gray-500">
                  +{capacityItems.length - 5} altre richieste in attesa
                </li>
              )}
            </ul>
            <div className="pt-3 border-t border-gray-100 flex justify-end">
              <Link
                href="/dashboard/transfers?tab=capacity"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Vai alle richieste posti
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
