'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, Loader2, Bus } from 'lucide-react'

interface PendingTransfer {
  id: string
  name: string
  date: string
}

export function PendingTransfersWidget() {
  const [items, setItems] = useState<PendingTransfer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPending = async () => {
      try {
        const res = await fetch('/api/transfers?pending=true')
        if (res.ok) {
          const data = await res.json()
          const mapped = (data || []).map((t: any) => ({
            id: t.id,
            name: t.name,
            date: t.date
          }))
          setItems(mapped)
        }
      } catch (e) {
        setItems([])
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
            Trasferimenti in attesa di approvazione
          </h3>
        </div>
        <div className="p-4 flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Caricamento...
        </div>
      </div>
    )
  }

  if (!items.length) return null

  return (
    <div className="bg-white overflow-hidden rounded-lg shadow border border-red-300 mb-4">
      <div className="p-4 bg-red-50 border-b border-red-200 flex items-center gap-2">
        <AlertCircle className="h-5 w-5 text-red-600" />
        <h3 className="text-sm font-semibold text-red-900">
          Trasferimenti da approvare ({items.length})
        </h3>
      </div>
      <div className="p-4 space-y-2">
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
            Vai ai trasferimenti da approvare
          </Link>
        </div>
      </div>
    </div>
  )
}

