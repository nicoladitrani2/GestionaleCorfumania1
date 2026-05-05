'use client'

import { useState, useEffect, useRef } from 'react'
import { Edit, Trash2, User, Users, Globe, FileText, Phone, CreditCard, CheckCircle, AlertCircle, Clock, FileDown, BadgeCheck, Euro, Eye, RotateCcw, Briefcase, Calendar, Map as MapIcon, History, X, ChevronDown } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { generateParticipantPDF } from '@/lib/pdf-generator'
import { ParticipantDetailsModal } from '../excursions/ParticipantDetailsModal'
import { RefundModal } from '../excursions/RefundModal'
import { DeleteChoiceModal } from '../excursions/DeleteChoiceModal'
import { ConfirmationModal } from '../components/ConfirmationModal'
import { AlertModal } from '../components/AlertModal'
import { AuditLogList } from '../excursions/AuditLogList'

// --- Helpers ---

const getStatusColor = (p: any) => {
  if (p.paymentType === 'REFUNDED') return 'bg-gray-100 text-gray-500 border-gray-200'
  if (p.isOption) return 'bg-red-50 text-red-700 border-red-100'
  // Only show Deposit style if it's a CAR rental or standard participant, otherwise (Moto/Boat) show Confirmed style
  if (p.paymentType === 'DEPOSIT' && p.rentalType === 'CAR') return 'bg-orange-50 text-orange-700 border-orange-100'
  if (p.paymentType === 'DEPOSIT' && p.rentalType !== 'CAR') return 'bg-green-50 text-green-700 border-green-100'
  if (p.paymentType === 'BALANCE') return 'bg-green-50 text-green-700 border-green-100'
  return 'bg-gray-50 text-gray-700 border-gray-100'
}

const getStatusIcon = (p: any) => {
  if (p.paymentType === 'REFUNDED') return <RotateCcw className="w-3 h-3 mr-1" />
  if (p.isOption) return <Clock className="w-3 h-3 mr-1" />
  if (p.paymentType === 'DEPOSIT' && p.rentalType === 'CAR') return <AlertCircle className="w-3 h-3 mr-1" />
  if (p.paymentType === 'DEPOSIT' && p.rentalType !== 'CAR') return <CheckCircle className="w-3 h-3 mr-1" />
  if (p.paymentType === 'BALANCE') return <CheckCircle className="w-3 h-3 mr-1" />
  return null
}

const getStatusText = (p: any) => {
  if (p.paymentType === 'REFUNDED') return 'Rimborsato'
  if (p.isOption) return 'Non pagato'
  // Explicit check for CAR. If rentalType is undefined/null (legacy) or not CAR, show Confermato
  if (p.paymentType === 'DEPOSIT' && p.rentalType === 'CAR') return 'Acconto'
  if (p.paymentType === 'DEPOSIT') return 'Confermato' // Fallback for non-CAR rentals
  if (p.paymentType === 'BALANCE') return 'Confermato'
  return 'N/A'
}

const getRowBackground = (p: any) => {
  if (p.paymentType === 'REFUNDED') return 'bg-gray-50/50 hover:bg-gray-100/50 opacity-75'
  if (p.isOption) return 'bg-red-50/50 hover:bg-red-100/50'
  // Only show orange for CAR deposits
  if (p.paymentType === 'DEPOSIT' && p.rentalType === 'CAR') return 'bg-orange-50/50 hover:bg-orange-100/50'
  if (p.paymentType === 'DEPOSIT') return 'bg-green-50/50 hover:bg-green-100/50' // Green for other rentals
  if (p.paymentType === 'BALANCE') return 'bg-green-50/50 hover:bg-green-100/50'
  return 'hover:bg-gray-50'
}

const getApproval = (p: any) => {
  if (p.approvalStatus) return p.approvalStatus
  if (p.paymentStatus === 'PENDING_APPROVAL') return 'PENDING'
  if (p.paymentStatus === 'REJECTED') return 'REJECTED'
  return undefined
}

const formatDate = (dateString: string) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('it-IT')
}

const thClassName = "px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"

// --- Sub-component ---

interface RentalsTableProps {
  data: any[]
  emptyMessage: string
  userRole: string
  currentUserId: string
  onEdit: (p: any) => void
  onDelete: (id: string) => void
  onSettleBalance: (p: any) => void
  onShowDetails: (p: any) => void
  onShowHistory: (p: any) => void
  onRefund: (p: any) => void
}

const RentalsTable = ({ 
  data, 
  emptyMessage,
  userRole,
  currentUserId,
  onEdit,
  onDelete,
  onSettleBalance,
  onShowDetails,
  onShowHistory,
  onRefund
}: RentalsTableProps) => {
  const totalPrice = data.reduce((sum, p) => sum + (p.price || 0), 0)
  const totalDeposit = data.reduce((sum, p) => sum + (p.deposit || 0), 0)
  const totalTax = data.reduce((sum, p) => sum + (p.tax || 0), 0)
  const totalPax = data.reduce((sum, p) => sum + ((p.adults || 0) + (p.children || 0) + (p.infants || 0) || 1), 0)
  const totalAgentShare = data.reduce((sum, p) => sum + (p.rentalAgentShare || 0), 0)

  return (
  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
    <div className="hidden md:block overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50/50">
          <tr>
            <th className={thClassName}>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" /> Cliente
              </div>
            </th>
            <th className={thClassName}>
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4" /> Mezzo
              </div>
            </th>
            <th className={thClassName}>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Periodo
              </div>
            </th>
            <th className={thClassName}>
              <div className="flex items-center gap-2">
                <BadgeCheck className="w-4 h-4" /> Assistente
              </div>
            </th>
            <th className={thClassName}>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" /> Inserito da
              </div>
            </th>
            <th className={thClassName}>
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" /> Prezzo
              </div>
            </th>
            <th className={thClassName}>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> Stato
              </div>
            </th>
            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Azioni
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {data.map((p) => {
        const canEdit = userRole === 'ADMIN' || p.createdById === currentUserId
        const isManaged = p.rentalType === 'CAR'
        const canSeeFinancial =
          userRole === 'ADMIN' || p.createdById === currentUserId || p.assignedToId === currentUserId
        const assistant = p.assignedTo || p.createdBy
        const gross = Number(p.price || 0)
        const insurance = Number(p.insurancePrice || 0)
        const supplement = Number(p.supplementPrice || 0)
        const tax = Number(p.tax || 0)
        const excludedCosts = Math.max(0, insurance) + Math.max(0, supplement) + Math.max(0, tax)
        const fallbackCommissionBase =
          p.rentalType === 'CAR'
            ? Math.max(0, gross - excludedCosts)
            : Math.max(0, gross)
        const commissionBase =
          typeof p.rentalCommissionBase === 'number' ? p.rentalCommissionBase : fallbackCommissionBase
        const agentShare =
          typeof p.rentalAgentShare === 'number' ? p.rentalAgentShare : commissionBase * 0.05
        const agentPct =
          commissionBase > 0 && Number.isFinite(agentShare) ? Math.round((agentShare / commissionBase) * 100) : null
        
        return (
          <tr 
            key={p.id} 
            className={`transition-colors border-b border-gray-100 last:border-0 ${getRowBackground(p)}`}
          >
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  <div className="flex flex-col">
                    <span>{p.firstName} {p.lastName}</span>
                    <span className="text-xs text-gray-500 font-normal">{p.phoneNumber}</span>
                    <span className="text-xs text-gray-400">
                      Inserito da:{' '}
                      {(() => {
                        const by = p.createdBy || p.assignedTo
                        if (!by) return '-'
                        return [by.code, by.firstName, by.lastName].filter(Boolean).join(' ') || by.email || '-'
                      })()}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                   <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {p.rentalType === 'CAR' ? 'Auto' : p.rentalType === 'MOTO' ? 'Moto' : p.rentalType === 'BOAT' ? 'Barca' : '-'}
                    </span>
                    <span className="text-xs text-gray-400">
                        {p.supplier}
                    </span>
                   </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex flex-col">
                    <span className="font-medium">{formatDate(p.rentalStartDate)}</span>
                    <span className="text-xs text-gray-400">al {formatDate(p.rentalEndDate)}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-900">{assistant?.code || '-'}</span>
                    <span className="text-xs text-gray-500">{assistant?.firstName} {assistant?.lastName}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {(() => {
                    const by = p.createdBy || p.assignedTo
                    if (!by) return '-'
                    return [by.code, by.firstName, by.lastName].filter(Boolean).join(' ') || by.email || '-'
                  })()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                  {canSeeFinancial ? (
                    <div className="flex flex-col">
                      <span>Prezzo: € {p.price?.toFixed(2) || '0.00'}</span>
                      <span className="text-xs text-green-600">
                        Incassato (registrato): € {(p.deposit || 0).toFixed(2)}
                      </span>
                      <span className="text-xs text-purple-700">
                        Quota Operatore{agentPct ? ` (${agentPct}%)` : ''}: € {agentShare.toFixed(2)}
                      </span>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400">
                      Dati economici non visibili
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`px-2.5 py-1 inline-flex items-center text-xs font-medium rounded-full border ${getStatusColor(p)}`}>
                    {getStatusIcon(p)}
                    {getStatusText(p)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => onShowDetails(p)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors border border-blue-200"
                      title="Visualizza Dettagli"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onShowHistory(p)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors border border-gray-200"
                      title="Cronologia"
                    >
                      <History className="w-3.5 h-3.5" />
                    </button>

                    {canEdit && (
                      <>
                        {isManaged && (p.paymentType === 'DEPOSIT' || p.isOption) && (
                          <button
                            onClick={() => onSettleBalance(p)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-md transition-colors border border-green-200"
                            title={`Registra Saldo: € ${(p.price - (p.deposit || 0)).toFixed(2)}`}
                          >
                            <Euro className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isManaged && p.deposit > 0 && (
                          <button
                            onClick={() => onRefund(p)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-md transition-colors border border-orange-200"
                            title="Rimborsa ed Elimina"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button 
                          onClick={() => onEdit(p)} 
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors border border-indigo-200"
                          title="Modifica"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => onDelete(p.id)} 
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-md transition-colors border border-red-200"
                          title="Elimina"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
          {data.length === 0 && (
            <tr>
              <td colSpan={8} className="px-6 py-12 text-center text-sm text-gray-500">
                <div className="flex flex-col items-center gap-3">
                  <div className="p-3 bg-gray-50 rounded-full">
                    <Briefcase className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="font-medium">{emptyMessage}</p>
                  <p className="text-gray-400 text-xs">Aggiungi un nuovo noleggio per iniziare</p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>

    <div className="hidden md:flex items-center justify-between px-6 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
      <div className="flex items-center gap-4">
        <span className="font-semibold">Totale noleggi: {data.length}</span>
        <span>Pax: {totalPax}</span>
      </div>
      {userRole === 'ADMIN' && (
        <div className="flex items-center gap-4 font-mono">
          <span>Prezzo: € {totalPrice.toFixed(2)}</span>
          <span>Incassato (registrato): € {totalDeposit.toFixed(2)}</span>
          {totalTax > 0 && <span>Tasse: € {totalTax.toFixed(2)}</span>}
          <span>Operatori: € {totalAgentShare.toFixed(2)}</span>
        </div>
      )}
    </div>

    {/* Mobile Card View */}
    <div className="md:hidden divide-y divide-gray-100">
      {data.map((p) => {
        const canEdit = userRole === 'ADMIN' || p.createdById === currentUserId
        const isManaged = p.rentalType === 'CAR'
        const canSeeFinancial =
          userRole === 'ADMIN' || p.createdById === currentUserId || p.assignedToId === currentUserId
        
        return (
          <div 
            key={p.id} 
            className={`p-4 space-y-3 ${getRowBackground(p)}`}
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="font-bold text-gray-900">{p.firstName} {p.lastName}</div>
                <div className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                     {p.rentalType === 'CAR' ? 'Auto' : p.rentalType === 'MOTO' ? 'Moto' : p.rentalType === 'BOAT' ? 'Barca' : '-'}
                  </span>
                  <span className="text-xs text-gray-400">{p.supplier}</span>
                </div>
              </div>
              <span className={`px-2 py-1 inline-flex items-center text-xs font-medium rounded-full border ${getStatusColor(p)}`}>
                {getStatusIcon(p)}
                {getStatusText(p)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
              <div className="flex flex-col">
                 <span className="text-xs text-gray-400">Periodo</span>
                 <span>{formatDate(p.rentalStartDate)} - {formatDate(p.rentalEndDate)}</span>
              </div>
               <div className="flex flex-col">
                 <span className="text-xs text-gray-400">Telefono</span>
                 <span>{p.phoneNumber || '-'}</span>
              </div>
              <div className="flex flex-col col-span-2">
                <span className="text-xs text-gray-400">Inserito da</span>
                <span>
                  {(() => {
                    const by = p.createdBy || p.assignedTo
                    if (!by) return '-'
                    return [by.code, by.firstName, by.lastName].filter(Boolean).join(' ') || by.email || '-'
                  })()}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-gray-100/50">
               <div className="flex gap-3 text-sm">
                 {canSeeFinancial ? (
                   <>
                     <div className="flex flex-col">
                       <span className="text-xs text-gray-400">Prezzo</span>
                       <span className="font-mono">€ {p.price?.toFixed(2) || '0.00'}</span>
                     </div>
                     {p.rentalType === 'CAR' && (
                       <div className="flex flex-col">
                         <span className="text-xs text-gray-400">Acconto</span>
                         <span className="font-mono">€ {p.deposit?.toFixed(2) || '0.00'}</span>
                       </div>
                     )}
                   </>
                 ) : (
                   <div className="text-xs text-gray-400">
                     Dati economici non visibili
                   </div>
                 )}
               </div>
               
               <div className="flex gap-2">
                  <button
                      onClick={() => onShowDetails(p)}
                      className="p-2 text-blue-700 bg-blue-50 rounded-lg border border-blue-200"
                      title="Dettagli"
                  >
                      <Eye className="w-4 h-4" />
                  </button>
                  <button
                      onClick={() => onShowHistory(p)}
                      className="p-2 text-gray-700 bg-gray-50 rounded-lg border border-gray-200"
                      title="Cronologia"
                  >
                      <History className="w-4 h-4" />
                  </button>
                  {canEdit && (
                      <>
                           {isManaged && (p.paymentType === 'DEPOSIT' || p.isOption) && (
                              <button
                                onClick={() => onSettleBalance(p)}
                                className="p-2 text-green-700 bg-green-50 rounded-lg border border-green-200"
                                title="Saldo"
                              >
                                <Euro className="w-4 h-4" />
                              </button>
                            )}
                            {isManaged && p.deposit > 0 && (
                              <button
                                onClick={() => onRefund(p)}
                                className="p-2 text-orange-700 bg-orange-50 rounded-lg border border-orange-200"
                                title="Rimborso"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
                            <button 
                              onClick={() => onEdit(p)} 
                              className="p-2 text-indigo-700 bg-indigo-50 rounded-lg border border-indigo-200"
                              title="Modifica"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => onDelete(p.id)} 
                              className="p-2 text-red-700 bg-red-50 rounded-lg border border-red-200"
                              title="Elimina"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                      </>
                  )}
               </div>
            </div>
          </div>
        )
      })}
      {data.length === 0 && (
        <div className="px-6 py-12 text-center text-sm text-gray-500">
           <div className="flex flex-col items-center gap-3">
             <div className="p-3 bg-gray-50 rounded-full">
               <Briefcase className="w-6 h-6 text-gray-400" />
             </div>
             <p className="font-medium">{emptyMessage}</p>
             <p className="text-gray-400 text-xs">Aggiungi un nuovo noleggio per iniziare</p>
           </div>
        </div>
      )}
    </div>
  </div>
)}

interface RentalsListProps {
  onEdit: (participant: any) => void
  onUpdate?: () => void
  refreshTrigger: number
  currentUserId: string
  userRole: string
  search?: string
  onLoaded?: (participants: any[]) => void
  initialSelectedParticipantId?: string
}

export function RentalsList({ 
  onEdit, 
  onUpdate,
  refreshTrigger, 
  currentUserId, 
  userRole,
  search = '',
  onLoaded,
  initialSelectedParticipantId,
  }: RentalsListProps) {
  const [participants, setParticipants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showExpiredSection, setShowExpiredSection] = useState(false)
  const [showRefundedSection, setShowRefundedSection] = useState(false)
  const [selectedParticipant, setSelectedParticipant] = useState<any>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [historyRentalId, setHistoryRentalId] = useState<string | null>(null)
  const [showRefund, setShowRefund] = useState(false)
  const [participantToRefund, setParticipantToRefund] = useState<any>(null)
  const [showDeleteChoice, setShowDeleteChoice] = useState(false)
  const [participantToDelete, setParticipantToDelete] = useState<any>(null)
  const autoOpenedRef = useRef(false)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    variant?: 'danger' | 'warning' | 'info'
    onConfirm: () => void
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'danger'
  })

  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    variant?: 'danger' | 'success' | 'info' | 'warning'
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'info'
  })

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(blob)
      reader.onloadend = () => {
        const result = reader.result?.toString()
        if (result) {
          resolve(result.split(',')[1])
        } else {
          reject(new Error('Failed to convert PDF to Base64'))
        }
      }
      reader.onerror = error => reject(error)
    })
  }

  const fetchParticipants = async () => {
    try {
      const params = new URLSearchParams()
      params.set('isRental', 'true')
      if (search && search.trim()) {
        params.set('search', search.trim())
      }

      const res = await fetch(`/api/participants?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()

        const today = new Date()
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())

        const enriched = data.map((p: any) => {
          const end = p.rentalEndDate || p.rentalStartDate || p.bookingDate
          let isExpired = false
          if (end) {
            const d = new Date(end)
            const endDateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate())
            isExpired = endDateOnly < startOfToday
          }
          return { ...p, isExpired }
        })

        enriched.sort(
          (a: any, b: any) =>
            new Date(b.rentalStartDate || b.bookingDate).getTime() -
            new Date(a.rentalStartDate || a.bookingDate).getTime()
        )

        setParticipants(enriched)
        if (onLoaded) {
          onLoaded(enriched)
        }
      }
    } catch (error) {
      console.error('Error fetching rentals:', error)
    } finally {
      setLoading(false)
    }
  }

  // Polling for live updates (every 5 seconds)
  useEffect(() => {
    if (search && search.trim()) return
    const interval = setInterval(() => {
      fetchParticipants()
    }, 5000)

    return () => clearInterval(interval)
  }, [search])

  useEffect(() => {
    fetchParticipants()
  }, [refreshTrigger])

  const searchTerm = search.trim().toLowerCase()

  useEffect(() => {
    const t = setTimeout(() => {
      if (search.trim()) fetchParticipants()
    }, search.trim() ? 300 : 0)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    if (!initialSelectedParticipantId) return
    if (autoOpenedRef.current) return
    const found = participants.find(p => p?.id === initialSelectedParticipantId)
    if (!found) return
    autoOpenedRef.current = true
    setSelectedParticipant(found)
    setShowDetails(true)
  }, [initialSelectedParticipantId, participants])

  useEffect(() => {
    if (searchTerm) {
      setShowExpiredSection(true)
      setShowRefundedSection(true)
    }
  }, [searchTerm])

  if (loading) return (
    <div className="flex justify-center items-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  )

  const matchesSearch = (p: any) => {
    if (!searchTerm) return true
    const fullName = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase()
    const email = String(p.email || '').toLowerCase()
    const notes = String(p.notes || '').toLowerCase()
    const bookingDate = (() => {
      const d = p.bookingDate || p.createdAt || p.rentalStartDate
      if (!d) return ''
      try {
        return new Date(d).toLocaleDateString('it-IT')
      } catch {
        return ''
      }
    })()
    return (
      fullName.includes(searchTerm) ||
      email.includes(searchTerm) ||
      notes.includes(searchTerm) ||
      bookingDate.includes(searchTerm)
    )
  }

  const isVisiblePending = (p: any) => {
    if (p.paymentType === 'REFUNDED' || p.status === 'REFUNDED') return false
    if (p.isExpired) return false
    return matchesSearch(p)
  }

  const activeParticipants = participants
    .filter(p => !p.isExpired && p.paymentType !== 'REFUNDED' && getApproval(p) !== 'PENDING' && getApproval(p) !== 'REJECTED')
    .filter(matchesSearch)

  const expiredParticipants = participants
    .filter(p => p.isExpired && p.paymentType !== 'REFUNDED')
    .filter(matchesSearch)

  const refundedParticipants = participants
    .filter(p => p.paymentType === 'REFUNDED')
    .filter(matchesSearch)
  const pendingParticipants = participants.filter(p => getApproval(p) === 'PENDING').filter(isVisiblePending)

  const handleDelete = (id: string) => {
    const p = participants.find(p => p.id === id)
    if (p) {
      setParticipantToDelete(p)
      setShowDeleteChoice(true)
    }
  }

  const executeDelete = async () => {
    if (!participantToDelete) return

    try {
      // Generate PDF for cancellation email
      let pdfBase64 = undefined
      if (participantToDelete.email) {
          const updatedParticipant = {
            ...participantToDelete,
            paymentType: 'CANCELLED',
            isOption: false
          }
          // Generic event data for rental
          const eventData = {
            type: 'RENTAL',
            name: `Noleggio ${participantToDelete.rentalType}`,
            date: participantToDelete.rentalStartDate,
            pickupLocation: participantToDelete.pickupLocation,
            dropoffLocation: participantToDelete.dropoffLocation
          }
          const pdfDoc = generateParticipantPDF(updatedParticipant, eventData as any)
          pdfBase64 = pdfDoc.output('datauristring').split(',')[1]
      }

      const res = await fetch(`/api/participants/${participantToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfAttachment: pdfBase64 })
      })
      if (res.ok) {
        setShowDeleteChoice(false)
        setParticipantToDelete(null)
        fetchParticipants()
        if (onUpdate) onUpdate()
      }
    } catch (error) {
      console.error('Error deleting participant:', error)
    }
  }

  const handleRequestRefund = () => {
    if (participantToDelete) {
      setParticipantToRefund(participantToDelete)
      setShowDeleteChoice(false)
      setTimeout(() => setShowRefund(true), 150)
    }
  }

  const handleSettleBalance = (p: any) => {
    const remainingAmount = (p.price || 0) - (p.deposit || 0)
    
    setConfirmModal({
      isOpen: true,
      title: 'Conferma Saldo',
      message: `Confermi il saldo di € ${remainingAmount.toFixed(2)} per ${p.firstName} ${p.lastName}?`,
      variant: 'info',
      onConfirm: async () => {
        try {
          // Generate updated PDF
          const updatedParticipant = {
            ...p,
            paymentType: 'BALANCE',
            deposit: p.price,
            isOption: false
          }

          const eventData = {
            type: 'RENTAL',
            name: `Noleggio ${p.rentalType}`,
            date: p.rentalStartDate,
            pickupLocation: p.pickupLocation,
            dropoffLocation: p.dropoffLocation
          }

          const pdfDoc = generateParticipantPDF(updatedParticipant, eventData as any)
          const pdfBase64 = pdfDoc.output('datauristring').split(',')[1]

          const res = await fetch(`/api/participants/${p.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...p,
              paymentType: 'BALANCE',
              deposit: p.price, // Set deposit to full price as it's fully paid
              isOption: false,
              pdfAttachment: pdfBase64
            })
          })

          if (res.ok) {
            fetchParticipants()
            if (onUpdate) onUpdate()
            setAlertModal({
              isOpen: true,
              title: 'Successo',
              message: 'Saldo registrato con successo',
              variant: 'success'
            })
          } else {
             const data = await res.json()
             setAlertModal({
              isOpen: true,
              title: 'Errore',
              message: data.error || 'Errore durante la registrazione del saldo',
              variant: 'danger'
            })
          }
        } catch (error) {
          console.error('Error settling balance:', error)
          setAlertModal({
            isOpen: true,
            title: 'Errore',
            message: 'Errore di connessione',
            variant: 'danger'
          })
        }
      }
    })
  }

  const handleRefund = async (participantId: string, amount: number, method: string, notes: string) => {
    const participant = participants.find(p => p.id === participantId) || participantToRefund
    if (!participant) return

    try {
      const methodLabels: Record<string, string> = {
        CASH: 'Contanti',
        TRANSFER: 'Bonifico',
        CARD: 'Carta'
      }

      const refundNote = `[${new Date().toLocaleDateString()}] Rimborsato €${amount} (${methodLabels[method] || method}) - ${notes || ''}`

      const updatedParticipant = {
        ...participant,
        paymentType: 'REFUNDED',
        isOption: false,
        notes: participant.notes ? `${participant.notes}\n${refundNote}` : refundNote
      }

      const eventData = {
        type: 'RENTAL',
        name: `Noleggio ${(participant as any).rentalType || ''}`.trim(),
        date: (participant as any).rentalStartDate,
        pickupLocation: (participant as any).pickupLocation,
        dropoffLocation: (participant as any).dropoffLocation
      }

      const docIT = generateParticipantPDF(updatedParticipant, eventData as any, 'it')
      const pdfBlobIT = docIT.output('blob')
      const pdfBase64IT = await blobToBase64(pdfBlobIT)

      const docEN = generateParticipantPDF(updatedParticipant, eventData as any, 'en')
      const pdfBlobEN = docEN.output('blob')
      const pdfBase64EN = await blobToBase64(pdfBlobEN)

      const res = await fetch(`/api/participants/${participantId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refundAmount: amount,
          refundMethod: method,
          notes,
          pdfAttachmentIT: pdfBase64IT,
          pdfAttachmentEN: pdfBase64EN
        })
      })

      if (res.ok) {
        setShowRefund(false)
        setParticipantToRefund(null)
        fetchParticipants()
        if (onUpdate) onUpdate()
      } else {
        const data = await res.json().catch(() => ({}))
        setAlertModal({
          isOpen: true,
          title: 'Errore',
          message: data.error || 'Errore durante il rimborso',
          variant: 'danger'
        })
      }
    } catch (error) {
      console.error('Error refunding participant:', error)
      setAlertModal({
        isOpen: true,
        title: 'Errore',
        message: 'Errore di connessione',
        variant: 'danger'
      })
    }
  }

  return (
    <div className="space-y-8">
      {/* Pending Approval */}
      {pendingParticipants.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <h3 className="text-lg font-bold text-gray-800">In Attesa di Approvazione</h3>
              <span className="bg-amber-100 text-amber-800 text-xs font-medium px-2.5 py-0.5 rounded-full border border-amber-200">
                {pendingParticipants.length}
              </span>
            </div>
          </div>
          <RentalsTable 
            data={pendingParticipants}
            emptyMessage="Nessun partecipante in approvazione"
            userRole={userRole}
            currentUserId={currentUserId}
            onEdit={onEdit}
            onDelete={handleDelete}
            onSettleBalance={handleSettleBalance}
            onShowDetails={(p) => {
              setSelectedParticipant(p)
              setShowDetails(true)
            }}
            onShowHistory={(p) => {
              if (!p?.rentalId) return
              setHistoryRentalId(p.rentalId)
              setShowHistory(true)
            }}
            onRefund={(p) => {
              setParticipantToRefund(p)
              setShowRefund(true)
            }}
          />
        </div>
      )}
      {/* Active Rentals */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-bold text-gray-800">Noleggi Attivi</h3>
            <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full border border-green-200">
              {activeParticipants.length}
            </span>
          </div>
        </div>
        <RentalsTable 
          data={activeParticipants}
          emptyMessage="Nessun noleggio attivo"
          userRole={userRole}
          currentUserId={currentUserId}
          onEdit={onEdit}
          onDelete={handleDelete}
          onSettleBalance={handleSettleBalance}
          onShowDetails={(p) => {
            setSelectedParticipant(p)
            setShowDetails(true)
          }}
          onShowHistory={(p) => {
            if (!p?.rentalId) return
            setHistoryRentalId(p.rentalId)
            setShowHistory(true)
          }}
          onRefund={(p) => {
            setParticipantToRefund(p)
            setShowRefund(true)
          }}
        />
      </div>

      {/* Expired Rentals */}
      {expiredParticipants.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => setShowExpiredSection(v => !v)}
              className="flex items-center gap-2 hover:bg-gray-50 rounded-lg px-2 py-1 transition-colors"
            >
              <Clock className="w-5 h-5 text-red-600" />
              <h3 className="text-lg font-bold text-gray-800">Noleggi Scaduti / Completati</h3>
              <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full border border-red-200">
                {expiredParticipants.length}
              </span>
              <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showExpiredSection ? 'rotate-180' : ''}`} />
            </button>
          </div>
          {showExpiredSection && (
            <div className="opacity-75 hover:opacity-100 transition-opacity">
              <RentalsTable 
                data={expiredParticipants}
                emptyMessage="Nessun noleggio scaduto"
                userRole={userRole}
                currentUserId={currentUserId}
                onEdit={onEdit}
                onDelete={handleDelete}
                onSettleBalance={handleSettleBalance}
                onShowDetails={(p) => {
                  setSelectedParticipant(p)
                  setShowDetails(true)
                }}
                onShowHistory={(p) => {
                  if (!p?.rentalId) return
                  setHistoryRentalId(p.rentalId)
                  setShowHistory(true)
                }}
                onRefund={(p) => {
                  setParticipantToRefund(p)
                  setShowRefund(true)
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Refunded Rentals */}
      {refundedParticipants.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => setShowRefundedSection(v => !v)}
              className="flex items-center gap-2 hover:bg-gray-50 rounded-lg px-2 py-1 transition-colors"
            >
              <RotateCcw className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-bold text-gray-800">Noleggi Rimborsati</h3>
              <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded-full border border-gray-200">
                {refundedParticipants.length}
              </span>
              <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showRefundedSection ? 'rotate-180' : ''}`} />
            </button>
          </div>
          {showRefundedSection && (
            <div className="opacity-75 hover:opacity-100 transition-opacity">
              <RentalsTable 
                data={refundedParticipants}
                emptyMessage="Nessun noleggio rimborsato"
                userRole={userRole}
                currentUserId={currentUserId}
                onEdit={onEdit}
                onDelete={handleDelete}
                onSettleBalance={handleSettleBalance}
                onShowDetails={(p) => {
                  setSelectedParticipant(p)
                  setShowDetails(true)
                }}
                onShowHistory={(p) => {
                  if (!p?.rentalId) return
                  setHistoryRentalId(p.rentalId)
                  setShowHistory(true)
                }}
                onRefund={(p) => {
                  setParticipantToRefund(p)
                  setShowRefund(true)
                }}
              />
            </div>
          )}
        </div>
      )}

      <ParticipantDetailsModal 
        isOpen={showDetails}
        onClose={() => {
          setShowDetails(false)
          setSelectedParticipant(null)
        }}
        participant={selectedParticipant}
        excursion={null} // No excursion object for rentals, generic logic inside modal handles it
      />

      {showHistory && historyRentalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <History className="w-6 h-6 text-gray-700" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Cronologia</h2>
                  <p className="text-sm text-gray-500">Operazioni sul noleggio</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowHistory(false)
                  setHistoryRentalId(null)
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <AuditLogList rentalId={historyRentalId} />
            </div>
          </div>
        </div>
      )}

      <RefundModal 
        isOpen={showRefund}
        onClose={() => {
          setShowRefund(false)
          setParticipantToRefund(null)
        }}
        onConfirm={handleRefund}
        participant={participantToRefund}
      />

      <DeleteChoiceModal 
        isOpen={showDeleteChoice}
        onClose={() => {
            setShowDeleteChoice(false)
            setParticipantToDelete(null)
        }}
        onConfirmDelete={executeDelete}
        onRequestRefund={handleRequestRefund}
        participantName={participantToDelete ? `${participantToDelete.firstName} ${participantToDelete.lastName}` : ''}
      />

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
      />

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
        title={alertModal.title}
        message={alertModal.message}
        variant={alertModal.variant}
      />
    </div>
  )
}
