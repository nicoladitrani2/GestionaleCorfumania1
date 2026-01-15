'use client'

import { useState, useEffect } from 'react'
import { Edit, Trash2, User, Users, Globe, FileText, Phone, CreditCard, CheckCircle, AlertCircle, Clock, FileDown, BadgeCheck, Euro, Eye, RotateCcw, Briefcase, Calendar, Map as MapIcon } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { generateParticipantPDF } from '@/lib/pdf-generator'
import { ParticipantDetailsModal } from '../excursions/ParticipantDetailsModal'
import { RefundModal } from '../excursions/RefundModal'
import { DeleteChoiceModal } from '../excursions/DeleteChoiceModal'

// --- Helpers ---

const getStatusColor = (p: any) => {
  if (p.paymentType === 'REFUNDED') return 'bg-gray-100 text-gray-500 border-gray-200'
  if (p.isOption) return 'bg-red-50 text-red-700 border-red-100'
  if (p.paymentType === 'DEPOSIT') return 'bg-orange-50 text-orange-700 border-orange-100'
  if (p.paymentType === 'BALANCE') return 'bg-green-50 text-green-700 border-green-100'
  return 'bg-gray-50 text-gray-700 border-gray-100'
}

const getStatusIcon = (p: any) => {
  if (p.paymentType === 'REFUNDED') return <RotateCcw className="w-3 h-3 mr-1" />
  if (p.isOption) return <Clock className="w-3 h-3 mr-1" />
  if (p.paymentType === 'DEPOSIT') return <AlertCircle className="w-3 h-3 mr-1" />
  if (p.paymentType === 'BALANCE') return <CheckCircle className="w-3 h-3 mr-1" />
  return null
}

const getStatusText = (p: any) => {
  if (p.paymentType === 'REFUNDED') return 'Rimborsato'
  if (p.isOption) return 'Non pagato'
  if (p.paymentType === 'DEPOSIT') return 'Acconto'
  if (p.paymentType === 'BALANCE') return 'Confermato'
  return 'N/A'
}

const getRowBackground = (p: any) => {
  if (p.paymentType === 'REFUNDED') return 'bg-gray-50/50 hover:bg-gray-100/50 opacity-75'
  if (p.isOption) return 'bg-red-50/50 hover:bg-red-100/50'
  if (p.paymentType === 'DEPOSIT') return 'bg-orange-50/50 hover:bg-orange-100/50'
  if (p.paymentType === 'BALANCE') return 'bg-green-50/50 hover:bg-green-100/50'
  return 'hover:bg-gray-50'
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
  onRefund
}: RentalsTableProps) => (
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
                <BadgeCheck className="w-4 h-4" /> Inserito da
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
            
            return (
              <tr 
                key={p.id} 
                className={`transition-colors border-b border-gray-100 last:border-0 ${getRowBackground(p)}`}
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  <div className="flex flex-col">
                    <span>{p.firstName} {p.lastName}</span>
                    <span className="text-xs text-gray-500 font-normal">{p.phoneNumber}</span>
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
                    <span className="font-medium text-gray-900">{p.createdBy?.code || '-'}</span>
                    <span className="text-xs text-gray-500">{p.createdBy?.firstName} {p.createdBy?.lastName}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                    <div className="flex flex-col">
                        <span>€ {p.price?.toFixed(2) || '0.00'}</span>
                        <span className="text-xs text-gray-400">Acc: € {p.deposit?.toFixed(2) || '0.00'}</span>
                    </div>
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

                    {canEdit && (
                      <>
                        {(p.paymentType === 'DEPOSIT' || p.isOption) && (
                          <button
                            onClick={() => onSettleBalance(p)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-md transition-colors border border-green-200"
                            title={`Registra Saldo: € ${(p.price - (p.deposit || 0)).toFixed(2)}`}
                          >
                            <Euro className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {p.deposit > 0 && (
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
              <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500">
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

    {/* Mobile Card View */}
    <div className="md:hidden divide-y divide-gray-100">
      {data.map((p) => {
        const canEdit = userRole === 'ADMIN' || p.createdById === currentUserId
        
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
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-gray-100/50">
               <div className="flex gap-3 text-sm">
                  <div className="flex flex-col">
                     <span className="text-xs text-gray-400">Prezzo</span>
                     <span className="font-mono">€ {p.price?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex flex-col">
                     <span className="text-xs text-gray-400">Acconto</span>
                     <span className="font-mono">€ {p.deposit?.toFixed(2) || '0.00'}</span>
                  </div>
               </div>
               
               <div className="flex gap-2">
                  <button
                      onClick={() => onShowDetails(p)}
                      className="p-2 text-blue-700 bg-blue-50 rounded-lg border border-blue-200"
                      title="Dettagli"
                  >
                      <Eye className="w-4 h-4" />
                  </button>
                  {canEdit && (
                      <>
                           {(p.paymentType === 'DEPOSIT' || p.isOption) && (
                              <button
                                onClick={() => onSettleBalance(p)}
                                className="p-2 text-green-700 bg-green-50 rounded-lg border border-green-200"
                                title="Saldo"
                              >
                                <Euro className="w-4 h-4" />
                              </button>
                            )}
                            {p.deposit > 0 && (
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
)

interface RentalsListProps {
  onEdit: (participant: any) => void
  onUpdate?: () => void
  refreshTrigger: number
  currentUserId: string
  userRole: string
}

export function RentalsList({ 
  onEdit, 
  onUpdate,
  refreshTrigger, 
  currentUserId, 
  userRole, 
}: RentalsListProps) {
  const [participants, setParticipants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedParticipant, setSelectedParticipant] = useState<any>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [showRefund, setShowRefund] = useState(false)
  const [participantToRefund, setParticipantToRefund] = useState<any>(null)
  const [showDeleteChoice, setShowDeleteChoice] = useState(false)
  const [participantToDelete, setParticipantToDelete] = useState<any>(null)

  const fetchParticipants = async () => {
    try {
      const res = await fetch(`/api/participants?isRental=true`)
      if (res.ok) {
        const data = await res.json()
        // Sort by rental start date descending
        data.sort((a: any, b: any) => new Date(b.rentalStartDate).getTime() - new Date(a.rentalStartDate).getTime())
        setParticipants(data)
      }
    } catch (error) {
      console.error('Error fetching rentals:', error)
    } finally {
      setLoading(false)
    }
  }

  // Polling for live updates (every 5 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchParticipants()
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    fetchParticipants()
  }, [refreshTrigger])

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

  const handleSettleBalance = async (p: any) => {
    const remainingAmount = (p.price || 0) - (p.deposit || 0)
    if (!confirm(`Confermi il saldo di € ${remainingAmount.toFixed(2)} per ${p.firstName} ${p.lastName}?`)) return

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
      }
    } catch (error) {
      console.error('Error settling balance:', error)
    }
  }

  const handleRefund = async (amount: number) => {
    if (!participantToRefund) return

    try {
       // Generate updated PDF for refund
       const updatedParticipant = {
        ...participantToRefund,
        paymentType: 'REFUNDED',
        isOption: false
      }

      const eventData = {
        type: 'RENTAL',
        name: `Noleggio ${participantToRefund.rentalType}`,
        date: participantToRefund.rentalStartDate
      }

      const pdfDoc = generateParticipantPDF(updatedParticipant, eventData as any)
      const pdfBase64 = pdfDoc.output('datauristring').split(',')[1]

      const res = await fetch(`/api/participants/${participantToRefund.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...participantToRefund,
          paymentType: 'REFUNDED',
          notes: `${participantToRefund.notes || ''}\n[RIMBORSO] Effettuato rimborso di €${amount.toFixed(2)} il ${new Date().toLocaleDateString('it-IT')}`,
          pdfAttachment: pdfBase64
        })
      })

      if (res.ok) {
        setShowRefund(false)
        setParticipantToRefund(null)
        fetchParticipants()
        if (onUpdate) onUpdate()
      }
    } catch (error) {
      console.error('Error refunding participant:', error)
    }
  }

  return (
    <div className="space-y-6">
      <RentalsTable 
        data={participants}
        emptyMessage={loading ? "Caricamento noleggi..." : "Nessun noleggio trovato"}
        userRole={userRole}
        currentUserId={currentUserId}
        onEdit={onEdit}
        onDelete={handleDelete}
        onSettleBalance={handleSettleBalance}
        onShowDetails={(p) => {
          setSelectedParticipant(p)
          setShowDetails(true)
        }}
        onRefund={(p) => {
          setParticipantToRefund(p)
          setShowRefund(true)
        }}
      />

      <ParticipantDetailsModal 
        isOpen={showDetails}
        onClose={() => {
          setShowDetails(false)
          setSelectedParticipant(null)
        }}
        participant={selectedParticipant}
        excursion={null} // No excursion object for rentals, generic logic inside modal handles it
      />

      <RefundModal 
        isOpen={showRefund}
        onClose={() => {
          setShowRefund(false)
          setParticipantToRefund(null)
        }}
        onConfirm={handleRefund}
        participant={participantToRefund}
        maxRefund={participantToRefund?.deposit || 0}
      />

      <DeleteChoiceModal 
        isOpen={showDeleteChoice}
        onClose={() => {
            setShowDeleteChoice(false)
            setParticipantToDelete(null)
        }}
        onDelete={executeDelete}
        onRefund={handleRequestRefund}
        participant={participantToDelete}
      />
    </div>
  )
}
