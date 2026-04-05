'use client'

import { useMemo, useState } from 'react'
import { Plus, Search, FileDown, Award, List } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { ParticipantForm } from '../excursions/ParticipantForm'
import { RentalsList } from './RentalsList'
import { RentalLeaderboard } from './RentalLeaderboard'
import { ExportRentalsModal, RENTAL_EXPORT_FIELDS } from './ExportRentalsModal'

interface RentalsManagerProps {
  currentUserId: string
  userRole: string
  currentUserSupplierName?: string
  userAgencyId?: string
  agencyDefaultCommission?: number
  agencyCommissionType?: string
}

export function RentalsManager({ 
  currentUserId, 
  userRole, 
  currentUserSupplierName, 
  userAgencyId,
  agencyDefaultCommission,
  agencyCommissionType
}: RentalsManagerProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [editingParticipant, setEditingParticipant] = useState<any>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [search, setSearch] = useState('')
  const [showExportModal, setShowExportModal] = useState(false)
  const [allRentals, setAllRentals] = useState<any[]>([])
  const [viewMode, setViewMode] = useState<'LIST' | 'LEADERBOARD'>('LIST')

  const exportFilters = useMemo(() => {
    const agencies = Array.from(
      new Set(
        allRentals
          .map(r => {
            const user = r.assignedTo || r.createdBy
            if (!user) return undefined
            const parts = [user.code, user.firstName, user.lastName].filter(Boolean)
            if (!parts.length) return undefined
            return parts.join(' - ')
          })
          .filter((v: string | undefined) => !!v)
      )
    ) as string[]

    const suppliers = Array.from(
      new Set(
        allRentals
          .map(r => r.supplier)
          .filter((v: string | undefined) => !!v)
      )
    ) as string[]

    const dynamicTypes = allRentals
      .map(r => r.rentalType)
      .filter((v: string | undefined) => !!v) as string[]

    const rentalTypes = Array.from(
      new Set([
        ...dynamicTypes,
        'CAR',
        'MOTO',
        'BOAT',
      ])
    ) as string[]

    return { agencies, suppliers, rentalTypes }
  }, [allRentals])

  const handleRentalsLoaded = (items: any[]) => {
    setAllRentals(items)
  }

  const handleExport = (options: {
    agencies: string[]
    suppliers: string[]
    rentalTypes: string[]
    startDate?: string
    endDate?: string
    fields: string[]
  }) => {
    if (userRole !== 'ADMIN') return
    if (!allRentals.length) return

    const { agencies, suppliers, rentalTypes, startDate, endDate, fields } = options

    const filtered = allRentals.filter(r => {
      const user = r.assignedTo || r.createdBy
      const agencyKey = user
        ? [user.code, user.firstName, user.lastName].filter(Boolean).join(' - ')
        : undefined
      const supplierName = r.supplier
      const type = r.rentalType

      if (agencies.length && (!agencyKey || !agencies.includes(agencyKey))) return false
      if (suppliers.length && (!supplierName || !suppliers.includes(supplierName))) return false
      if (rentalTypes.length && (!type || !rentalTypes.includes(type))) return false

      if (startDate || endDate) {
        const start = r.rentalStartDate ? new Date(r.rentalStartDate) : null
        if (!start) return false
        const startOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate())

        if (startDate) {
          const from = new Date(startDate)
          const fromOnly = new Date(from.getFullYear(), from.getMonth(), from.getDate())
          if (startOnly < fromOnly) return false
        }
        if (endDate) {
          const to = new Date(endDate)
          const toOnly = new Date(to.getFullYear(), to.getMonth(), to.getDate())
          if (startOnly > toOnly) return false
        }
      }

      return true
    })

    if (!filtered.length) {
      return
    }

    const header = ['Nome', 'Cognome', 'Pax', ...fields.map(f => {
      const def = RENTAL_EXPORT_FIELDS.find(x => x.id === f)
      return def?.label || f
    })]

    const rows = filtered.map(r => {
      const pax =
        (r.adults || 0) +
        (r.children || 0) +
        (r.infants || 0)

      const base: (string | number)[] = [
        r.firstName || '',
        r.lastName || '',
        pax || 1,
      ]

      fields.forEach(field => {
        switch (field) {
          case 'client':
            base.push(`${r.firstName || ''} ${r.lastName || ''}`.trim())
            break
          case 'phoneNumber':
            base.push(r.phoneNumber || '')
            break
          case 'rentalType':
            base.push(
              r.rentalType === 'CAR'
                ? 'Auto'
                : r.rentalType === 'MOTO'
                ? 'Moto'
                : r.rentalType === 'BOAT'
                ? 'Barca'
                : r.rentalType || ''
            )
            break
          case 'supplier':
            base.push(r.supplier || '')
            break
          case 'rentalStartDate':
            base.push(r.rentalStartDate ? new Date(r.rentalStartDate).toLocaleDateString('it-IT') : '')
            break
          case 'rentalEndDate':
            base.push(r.rentalEndDate ? new Date(r.rentalEndDate).toLocaleDateString('it-IT') : '')
            break
          case 'price':
            base.push(typeof r.price === 'number' ? r.price.toFixed(2) : '')
            break
          case 'deposit':
            base.push(typeof r.deposit === 'number' ? r.deposit.toFixed(2) : '')
            break
          case 'tax':
            base.push(typeof r.tax === 'number' ? r.tax.toFixed(2) : '')
            break
          case 'paymentType':
            base.push(r.paymentType || '')
            break
          case 'paymentStatus':
            base.push(r.paymentStatus || '')
            break
          case 'createdBy':
            base.push(
              r.createdBy
                ? `${r.createdBy.code || ''} ${r.createdBy.firstName || ''} ${r.createdBy.lastName || ''}`.trim()
                : ''
            )
            break
          case 'agency':
            base.push(r.createdBy?.agency?.name || '')
            break
          case 'notes':
            base.push(r.notes || '')
            break
          case 'createdAt':
            base.push(r.createdAt ? new Date(r.createdAt).toLocaleString('it-IT') : '')
            break
          default:
            base.push('')
        }
      })

      return base
    })

    const doc = new jsPDF('landscape', 'pt', 'a4')

    autoTable(doc, {
      head: [header],
      body: rows,
      styles: { fontSize: 8 },
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: 255,
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      margin: { top: 40, left: 20, right: 20, bottom: 20 },
    } as any)

    doc.save('noleggi-export.pdf')
  }

  const handleSuccess = () => {
    setIsAdding(false)
    setEditingParticipant(null)
    setRefreshTrigger(prev => prev + 1)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestione Noleggi</h1>
            <p className="text-gray-500">Gestisci i noleggi di auto, moto e barche</p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {userRole === 'ADMIN' && (
              <div className="flex bg-gray-100 p-1 rounded-lg mr-2">
                <button
                  onClick={() => setViewMode('LIST')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    viewMode === 'LIST'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <List className="w-4 h-4" />
                  Lista
                </button>
                <button
                  onClick={() => setViewMode('LEADERBOARD')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    viewMode === 'LEADERBOARD'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <Award className="w-4 h-4" />
                  Classifica
                </button>
              </div>
            )}

            {userRole === 'ADMIN' && (
              <button
                onClick={() => setShowExportModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm text-sm font-medium"
              >
                <FileDown className="w-4 h-4" />
                Esporta
              </button>
            )}
            <button
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
            >
              <Plus className="w-5 h-5" />
              Nuovo Noleggio
            </button>
          </div>
        </div>

        {viewMode === 'LIST' && (
          <div className="flex items-center gap-2 max-w-md">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                }}
                placeholder="Cerca nei noleggi per contenuto delle note..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}
      </div>

      {viewMode === 'LIST' ? (
        <RentalsList 
          currentUserId={currentUserId}
          userRole={userRole}
          refreshTrigger={refreshTrigger}
          search={search}
          onLoaded={handleRentalsLoaded}
          onEdit={(p) => setEditingParticipant(p)}
          onUpdate={() => setRefreshTrigger(prev => prev + 1)}
        />
      ) : (
        <RentalLeaderboard userRole={userRole} />
      )}

      {(isAdding || editingParticipant) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <ParticipantForm
              onCancel={() => {
                setIsAdding(false)
                setEditingParticipant(null)
              }}
              onSuccess={handleSuccess}
              initialData={editingParticipant}
              type="RENTAL"
              userRole={userRole}
              userAgencyId={userAgencyId}
              agencyDefaultCommission={agencyDefaultCommission}
              agencyCommissionType={agencyCommissionType}
            />
          </div>
        </div>
      )}

      {showExportModal && userRole === 'ADMIN' && (
        <ExportRentalsModal
          onClose={() => setShowExportModal(false)}
          onExport={handleExport}
          agencies={exportFilters.agencies}
          suppliers={exportFilters.suppliers}
          rentalTypes={exportFilters.rentalTypes}
        />
      )}
    </div>
  )
}
