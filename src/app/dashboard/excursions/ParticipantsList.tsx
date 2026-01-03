'use client'

import { useState, useEffect } from 'react'
import { Edit, Trash2, User, Users, Globe, FileText, Phone, CreditCard, CheckCircle, AlertCircle, Clock, FileDown, BadgeCheck, Euro, Eye, RotateCcw } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { ParticipantDetailsModal } from './ParticipantDetailsModal'
import { RefundModal } from './RefundModal'
import { DeleteChoiceModal } from './DeleteChoiceModal'

// --- Helpers ---

const getStatusColor = (p: any) => {
  if (p.paymentType === 'REFUNDED') return 'bg-gray-100 text-gray-500 border-gray-200' // Rimborsato
  if (p.isOption) return 'bg-red-50 text-red-700 border-red-100' // Non pagato / Opzione
  if (p.paymentType === 'DEPOSIT') return 'bg-orange-50 text-orange-700 border-orange-100' // Acconto
  if (p.paymentType === 'BALANCE') return 'bg-green-50 text-green-700 border-green-100' // Saldo / Confermato
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

const thClassName = "px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"

// --- Sub-component ---

interface ParticipantsTableProps {
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

const ParticipantsTable = ({ 
  data, 
  emptyMessage,
  userRole,
  currentUserId,
  onEdit,
  onDelete,
  onSettleBalance,
  onShowDetails,
  onRefund
}: ParticipantsTableProps) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
    <div className="hidden md:block overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50/50">
          <tr>
            <th className={thClassName}>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" /> Nome
              </div>
            </th>
            <th className={thClassName}>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" /> Posti
              </div>
            </th>
            <th className={thClassName}>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4" /> Nazionalità
              </div>
            </th>
            <th className={thClassName}>
              <div className="flex items-center gap-2">
                <BadgeCheck className="w-4 h-4" /> Inserito da
              </div>
            </th>
            <th className={thClassName}>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" /> Documento
              </div>
            </th>
            <th className={thClassName}>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4" /> Telefono
              </div>
            </th>
            <th className={thClassName}>
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" /> Prezzo
              </div>
            </th>
            <th className={thClassName}>
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" /> Acconto
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
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {p.groupSize || 1}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.nationality}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-900">{p.createdBy?.code || '-'}</span>
                    <span className="text-xs text-gray-500">{p.createdBy?.firstName} {p.createdBy?.lastName}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-700">{p.docNumber}</span>
                    <span className="text-xs text-gray-400">{p.docType}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.phoneNumber || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">€ {p.price?.toFixed(2) || '0.00'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">€ {p.deposit?.toFixed(2) || '0.00'}</td>
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
                      Dettagli
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
                            Saldo
                          </button>
                        )}
                        {p.deposit > 0 && (
                          <button
                            onClick={() => onRefund(p)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-md transition-colors border border-orange-200"
                            title="Rimborsa ed Elimina Partecipante"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Rimborso
                          </button>
                        )}
                        <button 
                          onClick={() => onEdit(p)} 
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors border border-indigo-200"
                          title="Modifica Partecipante"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          Modifica
                        </button>
                        <button 
                          onClick={() => onDelete(p.id)} 
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-md transition-colors border border-red-200"
                          title="Elimina Definitivamente"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Elimina
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
              <td colSpan={10} className="px-6 py-12 text-center text-sm text-gray-500">
                <div className="flex flex-col items-center gap-3">
                  <div className="p-3 bg-gray-50 rounded-full">
                    <User className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="font-medium">{emptyMessage}</p>
                  <p className="text-gray-400 text-xs">Aggiungi un nuovo partecipante per iniziare</p>
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
                     <Users className="w-3 h-3 mr-1" />
                     {p.groupSize || 1}
                  </span>
                  <span>{p.nationality || '-'}</span>
                </div>
              </div>
              <span className={`px-2 py-1 inline-flex items-center text-xs font-medium rounded-full border ${getStatusColor(p)}`}>
                {getStatusIcon(p)}
                {getStatusText(p)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
              <div className="flex flex-col">
                 <span className="text-xs text-gray-400">Inserito da</span>
                 <span>{p.createdBy?.firstName} {p.createdBy?.lastName}</span>
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
               <User className="w-6 h-6 text-gray-400" />
             </div>
             <p className="font-medium">{emptyMessage}</p>
             <p className="text-gray-400 text-xs">Aggiungi un nuovo partecipante per iniziare</p>
           </div>
        </div>
      )}
    </div>
  </div>
)

interface ParticipantsListProps {
  onEdit: (participant: any) => void
  onUpdate?: () => void
  refreshTrigger: number
  currentUserId: string
  userRole: string
  excursion: any
}

export function ParticipantsList({ 
  onEdit, 
  onUpdate,
  refreshTrigger, 
  currentUserId, 
  userRole, 
  excursion
}: ParticipantsListProps) {
  const excursionId = excursion.id
  const confirmationDeadline = excursion.confirmationDeadline
  const excursionName = excursion.name
  const excursionDate = excursion.date
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
      const res = await fetch(`/api/participants?excursionId=${excursionId}`)
      if (res.ok) {
        const data = await res.json()
        setParticipants(data)
      }
    } catch (error) {
      console.error('Error fetching participants:', error)
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
  }, [excursionId])

  useEffect(() => {
    fetchParticipants()
  }, [excursionId, refreshTrigger])

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
      const res = await fetch(`/api/participants/${participantToDelete.id}`, {
        method: 'DELETE',
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
      const res = await fetch(`/api/participants/${p.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...p,
          paymentType: 'BALANCE',
          deposit: p.price, // Set deposit to full price as it's fully paid
          isOption: false
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

  const handleRefund = async (participantId: string, amount: number, method: string, notes: string) => {
    try {
      const res = await fetch(`/api/participants/${participantId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refundAmount: amount, refundMethod: method, notes })
      })
      if (res.ok) {
        setShowRefund(false)
        fetchParticipants()
        if (onUpdate) onUpdate()
      } else {
        const errorData = await res.json()
        alert(`Errore: ${errorData.error}`)
      }
    } catch (error) {
      console.error('Refund error:', error)
      alert('Errore di connessione')
    }
  }

  const exportListToPDF = (list: any[], title: string, filenamePrefix: string) => {
    const doc = new jsPDF()
    
    // --- Header Styling ---
    // Blue header bar
    doc.setFillColor(37, 99, 235) // Blue-600
    doc.rect(0, 0, 210, 40, 'F')
    
    // Title (White)
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text(excursionName || 'Dettagli Escursione', 14, 18)
    
    // Subtitle (White)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'normal')
    doc.text(title, 14, 26)

    // Date (White, smaller)
    doc.setFontSize(10)
    if (excursionDate) {
      const date = new Date(excursionDate)
      if (!isNaN(date.getTime())) {
        const dateStr = date.toLocaleDateString('it-IT', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
        // Capitalize first letter
        const formattedDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1)
        doc.text(formattedDate, 14, 34)
      } else {
        doc.text('Data non valida', 14, 34)
      }
    }

    // Prepare table data
    // Columns: Nome, Posti, Nazionalità, Inserito da, Telefono, Note
    // Removed: Prezzo, Acconto, Stato (come richiesto)
    const tableData = list.map(p => [
      `${p.firstName} ${p.lastName}`,
      p.groupSize?.toString() || '1',
      p.nationality || '-',
      `${p.createdBy?.firstName || ''} ${p.createdBy?.lastName || ''}`.trim() || '-',
      p.phoneNumber || '-',
      p.notes || '-'
    ])

    autoTable(doc, {
      head: [['Nome', 'Posti', 'Nazionalità', 'Inserito da', 'Telefono', 'Note']],
      body: tableData,
      startY: 50,
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' }, // Darker blue header
      alternateRowStyles: { fillColor: [243, 244, 246] }, // Light gray for alternate rows
      columnStyles: {
        0: { fontStyle: 'bold' }, // Name bold
        1: { halign: 'center' }, // Group size centered
      }
    })

    // Footer with generation date
    const pageCount = doc.getNumberOfPages()
    doc.setFontSize(8)
    doc.setTextColor(156, 163, 175) // Gray-400
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.text(`Generato il ${new Date().toLocaleDateString('it-IT')} - Pagina ${i} di ${pageCount}`, 14, doc.internal.pageSize.height - 10)
    }

    doc.save(`${filenamePrefix}-${excursionName || 'escursione'}.pdf`)
  }

  if (loading) return (
    <div className="flex justify-center items-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  )

  const activeParticipants = participants.filter(p => !p.isExpired && p.paymentType !== 'REFUNDED')
  const expiredParticipants = participants.filter(p => p.isExpired && p.paymentType !== 'REFUNDED')
  const refundedParticipants = participants.filter(p => p.paymentType === 'REFUNDED')

  const exportToPDF = () => {
    exportListToPDF(activeParticipants, 'Lista Partecipanti Attivi', 'partecipanti-attivi')
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center px-1">
        <button
          onClick={exportToPDF}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm ml-auto"
        >
          <FileDown className="w-4 h-4" />
          Esporta PDF
        </button>
      </div>

      {/* Legenda Azioni */}
      <div className="flex flex-wrap gap-4 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100">
        <span className="font-medium text-gray-900">Legenda Azioni:</span>
        <div className="flex items-center gap-1"><Eye className="w-4 h-4 text-blue-600" /> Dettagli</div>
        <div className="flex items-center gap-1"><Euro className="w-4 h-4 text-green-600" /> Saldo</div>
        <div className="flex items-center gap-1"><Edit className="w-4 h-4 text-indigo-600" /> Modifica</div>
        <div className="flex items-center gap-1"><RotateCcw className="w-4 h-4 text-orange-600" /> Rimborso</div>
        <div className="flex items-center gap-1"><Trash2 className="w-4 h-4 text-red-600" /> Elimina</div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-bold text-gray-800">Lista Partecipanti Attivi</h3>
            <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full border border-green-200">
              {activeParticipants.reduce((acc, p) => acc + (p.groupSize || 1), 0)}
            </span>
          </div>
        </div>
        <ParticipantsTable 
          data={activeParticipants} 
          emptyMessage="Nessun partecipante attivo registrato" 
          userRole={userRole}
          currentUserId={currentUserId}
          onEdit={onEdit}
          onDelete={handleDelete}
          onSettleBalance={handleSettleBalance}
          onShowDetails={(p) => { setSelectedParticipant(p); setShowDetails(true); }}
          onRefund={(p) => { setParticipantToRefund(p); setShowRefund(true); }}
        />
      </div>

      {refundedParticipants.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-bold text-gray-800">Lista Rimborsati</h3>
              <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded-full border border-gray-200">
                {refundedParticipants.reduce((acc, p) => acc + (p.groupSize || 1), 0)}
              </span>
            </div>
            <button
              onClick={() => exportListToPDF(refundedParticipants, 'Lista Rimborsati', 'partecipanti-rimborsati')}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
            >
              <FileDown className="w-3.5 h-3.5" />
              Esporta PDF
            </button>
          </div>
          <div className="opacity-75 hover:opacity-100 transition-opacity">
            <ParticipantsTable 
              data={refundedParticipants} 
              emptyMessage="Nessun partecipante rimborsato" 
              userRole={userRole}
              currentUserId={currentUserId}
              onEdit={onEdit}
              onDelete={handleDelete}
              onSettleBalance={handleSettleBalance}
              onShowDetails={(p) => { setSelectedParticipant(p); setShowDetails(true); }}
              onRefund={(p) => { setParticipantToRefund(p); setShowRefund(true); }}
            />
          </div>
        </div>
      )}

      {expiredParticipants.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-red-600" />
              <h3 className="text-lg font-bold text-gray-800">Lista d'Attesa / Scaduti</h3>
              <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full border border-red-200">
                {expiredParticipants.reduce((acc, p) => acc + (p.groupSize || 1), 0)}
              </span>
            </div>
            <button
              onClick={() => exportListToPDF(expiredParticipants, 'Lista d\'Attesa / Scaduti', 'partecipanti-scaduti')}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
            >
              <FileDown className="w-3.5 h-3.5" />
              Esporta PDF
            </button>
          </div>
          <div className="opacity-75 hover:opacity-100 transition-opacity">
            <ParticipantsTable 
              data={expiredParticipants} 
              emptyMessage="Nessun partecipante scaduto" 
              userRole={userRole}
              currentUserId={currentUserId}
              onEdit={onEdit}
              onDelete={handleDelete}
              onSettleBalance={handleSettleBalance}
              onShowDetails={(p) => { setSelectedParticipant(p); setShowDetails(true); }}
              onRefund={(p) => { setParticipantToRefund(p); setShowRefund(true); }}
            />
          </div>
        </div>
      )}

      {showDetails && selectedParticipant && (
        <ParticipantDetailsModal
          isOpen={showDetails}
          onClose={() => {
            setShowDetails(false)
            setSelectedParticipant(null)
          }}
          participant={selectedParticipant}
          excursion={excursion}
        />
      )}

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

      <RefundModal
        isOpen={showRefund}
        onClose={() => setShowRefund(false)}
        participant={participantToRefund}
        onConfirm={handleRefund}
      />
    </div>
  )
}
