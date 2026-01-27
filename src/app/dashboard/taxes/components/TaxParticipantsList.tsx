'use client'

import { useState, useEffect } from 'react'
import { Edit, Trash2, User, Users, Globe, FileText, Phone, CreditCard, CheckCircle, AlertCircle, Clock, FileDown, BadgeCheck, Euro, Eye, RotateCcw, BedDouble } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { generateParticipantPDF, generateParticipantsListPDF } from '@/lib/pdf-generator'
import { ParticipantDetailsModal } from '../../excursions/ParticipantDetailsModal'
import { RefundModal } from '../../excursions/RefundModal'
import { DeleteChoiceModal } from '../../excursions/DeleteChoiceModal'
import { ExportParticipantsModal } from '../../excursions/ExportParticipantsModal'
import { ConfirmationModal } from '../../../components/ConfirmationModal'
import { AlertModal } from '../../../components/AlertModal'
import { TaxParticipantForm } from './TaxParticipantForm'

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

interface TaxParticipantsTableProps {
  data: any[]
  emptyMessage: string
  userRole: string
  currentUserId: string
  serviceType: string
  onEdit: (p: any) => void
  onDelete: (id: string) => void
  onSettleBalance: (p: any) => void
  onShowDetails: (p: any) => void
  onRefund: (p: any) => void
}

const TaxParticipantsTable = ({ 
  data, 
  emptyMessage,
  userRole,
  currentUserId,
  serviceType,
  onEdit,
  onDelete,
  onSettleBalance,
  onShowDetails,
  onRefund
}: TaxParticipantsTableProps) => (
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
            {serviceType === 'BRACELET' ? (
                <th className={thClassName}>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" /> Età/Tipo
                  </div>
                </th>
            ) : (
                <th className={thClassName}>
                  <div className="flex items-center gap-2">
                    <BedDouble className="w-4 h-4" /> Stanza
                  </div>
                </th>
            )}
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
                  </div>
                </td>
                {serviceType === 'BRACELET' ? (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {p.price === 5 ? 'Bambino (<12)' : 'Adulto'}
                      </span>
                    </td>
                ) : (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="font-mono font-medium">
                        {p.roomNumber || (p.notes?.includes('Stanza:') ? p.notes.split('Stanza:')[1]?.trim() : '-')}
                      </span>
                    </td>
                )}
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
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">€ {p.price?.toFixed(2) || '0.00'}</td>
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
                        <button
                          onClick={() => onEdit(p)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors border border-blue-200"
                          title="Modifica"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          Modifica
                        </button>
                        {p.paymentType === 'BALANCE' && (
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
                   {serviceType !== 'BRACELET' && (
                      <div className="flex flex-col items-start">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                           <BedDouble className="w-3 h-3 mr-1" />
                           {p.roomNumber || (p.notes?.includes('Stanza:') ? p.notes.split('Stanza:')[1]?.trim() : '-')}
                        </span>
                      </div>
                   )}
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
                 <span className="text-xs text-gray-400">Prezzo</span>
                 <span className="font-mono">€ {p.price?.toFixed(2) || '0.00'}</span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-gray-100/50">
               <div className="flex gap-2 w-full justify-end">
                  <button
                      onClick={() => onShowDetails(p)}
                      className="p-2 text-blue-700 bg-blue-50 rounded-lg border border-blue-200"
                      title="Dettagli"
                  >
                      <Eye className="w-4 h-4" />
                  </button>
                  {canEdit && (
                      <>
                            <button
                                onClick={() => onEdit(p)}
                                className="p-2 text-blue-700 bg-blue-50 rounded-lg border border-blue-200"
                                title="Modifica"
                            >
                                <Edit className="w-4 h-4" />
                            </button>
                            {p.paymentType === 'BALANCE' && (
                              <button
                                onClick={() => onRefund(p)}
                                className="p-2 text-orange-700 bg-orange-50 rounded-lg border border-orange-200"
                                title="Rimborso"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
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

interface TaxParticipantsListProps {
  serviceType: string
  refreshTrigger: number
  currentUserId: string
  userRole: string
  title: string
}

export function TaxParticipantsList({ 
  serviceType,
  refreshTrigger, 
  currentUserId, 
  userRole,
  title
}: TaxParticipantsListProps) {
  const [participants, setParticipants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedParticipant, setSelectedParticipant] = useState<any>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [showRefund, setShowRefund] = useState(false)
  const [participantToRefund, setParticipantToRefund] = useState<any>(null)
  const [showDeleteChoice, setShowDeleteChoice] = useState(false)
  const [participantToDelete, setParticipantToDelete] = useState<any>(null)
  const [showExportModal, setShowExportModal] = useState(false)
  const [listToExport, setListToExport] = useState<any[] | null>(null)
  const [exportFilename, setExportFilename] = useState('')
  const [showEditForm, setShowEditForm] = useState(false)
  const [participantToEdit, setParticipantToEdit] = useState<any>(null)

  const fetchParticipants = async () => {
    try {
      const res = await fetch(`/api/taxes?type=${serviceType}`)
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

  useEffect(() => {
    const interval = setInterval(() => {
      fetchParticipants()
    }, 5000)
    return () => clearInterval(interval)
  }, [serviceType])

  useEffect(() => {
    fetchParticipants()
  }, [serviceType, refreshTrigger])

  if (loading) return (
    <div className="flex justify-center items-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  )

  const activeParticipants = participants.filter(p => !p.isExpired && p.paymentType !== 'REFUNDED')
  const refundedParticipants = participants.filter(p => p.paymentType === 'REFUNDED')

  // Calculate stats
  const totalNet = activeParticipants.reduce((acc, p) => acc + (p.price || 0), 0)
  const totalCount = activeParticipants.length

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
        method: 'DELETE'
      })

      if (res.ok) {
        setParticipants(prev => prev.filter(p => p.id !== participantToDelete.id))
        setShowDeleteChoice(false)
        setParticipantToDelete(null)
      }
    } catch (error) {
      console.error('Error deleting participant:', error)
    }
  }

  const handleRefund = (participant: any) => {
    setParticipantToRefund(participant)
    setShowRefund(true)
  }

  const executeRefund = async (amount: number, reason: string) => {
    if (!participantToRefund) return

    try {
      const res = await fetch(`/api/participants/${participantToRefund.id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, reason })
      })

      if (res.ok) {
        fetchParticipants()
        setShowRefund(false)
        setParticipantToRefund(null)
      }
    } catch (error) {
      console.error('Error refunding participant:', error)
    }
  }

  const handleExportClick = () => {
    setListToExport(activeParticipants)
    setExportFilename(`Lista_${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`)
    setShowExportModal(true)
  }

  const executeExport = (selectedFields: string[]) => {
    if (!listToExport) return
    
    // Generate PDF using jsPDF
    const doc = new jsPDF()
    
    // Add header
    doc.setFontSize(18)
    doc.setTextColor(0, 51, 153) // Blue color
    doc.text(`Lista ${title}`, 14, 20)
    
    doc.setFontSize(10)
    doc.setTextColor(100, 100, 100)
    doc.text(`Generato il: ${new Date().toLocaleString('it-IT')}`, 14, 28)
    
    // Map data for table
    const tableBody = listToExport.map(p => {
        const row: any[] = []
        // Basic fields
        row.push(p.firstName)
        row.push(p.lastName)
        row.push(p.phone || '-')
        row.push('1') // Pax count

        // Extra fields
        if (selectedFields.includes('accommodation')) row.push(p.roomNumber || '-')
        if (selectedFields.includes('pickupLocation')) row.push('-')
        if (selectedFields.includes('pickupTime')) row.push('-')
        if (selectedFields.includes('nationality')) row.push(p.nationality || '-')
        if (selectedFields.includes('docType')) row.push(p.docType || '-')
        if (selectedFields.includes('docNumber')) row.push(p.docNumber || '-')
        if (selectedFields.includes('email')) row.push(p.email || '-')
        if (selectedFields.includes('price')) row.push(`€ ${p.price?.toFixed(2)}`)
        if (selectedFields.includes('deposit')) row.push(`€ ${p.deposit?.toFixed(2) || '0.00'}`)
        if (selectedFields.includes('paymentType')) row.push(getStatusText(p))
        if (selectedFields.includes('paymentMethod')) row.push(p.paymentMethod || '-')
        if (selectedFields.includes('notes')) row.push(p.notes || '-')
        if (selectedFields.includes('createdBy')) row.push(`${p.createdBy?.firstName} ${p.createdBy?.lastName}`)
        if (selectedFields.includes('supplier')) row.push('-')
        if (selectedFields.includes('returnDetails')) row.push('-')
        if (selectedFields.includes('createdAt')) row.push(new Date(p.createdAt).toLocaleDateString('it-IT'))
        
        return row
    })

    const tableHead = ['Nome', 'Cognome', 'Tel', 'Pax']
    if (selectedFields.includes('accommodation')) tableHead.push('Stanza/Struttura')
    if (selectedFields.includes('pickupLocation')) tableHead.push('Partenza')
    if (selectedFields.includes('pickupTime')) tableHead.push('Ora')
    if (selectedFields.includes('nationality')) tableHead.push('Nazionalità')
    if (selectedFields.includes('docType')) tableHead.push('Doc Tipo')
    if (selectedFields.includes('docNumber')) tableHead.push('Doc Num')
    if (selectedFields.includes('email')) tableHead.push('Email')
    if (selectedFields.includes('price')) tableHead.push('Prezzo')
    if (selectedFields.includes('deposit')) tableHead.push('Acconto')
    if (selectedFields.includes('paymentType')) tableHead.push('Stato')
    if (selectedFields.includes('paymentMethod')) tableHead.push('Metodo')
    if (selectedFields.includes('notes')) tableHead.push('Note')
    if (selectedFields.includes('createdBy')) tableHead.push('Inserito da')
    if (selectedFields.includes('supplier')) tableHead.push('Fornitore')
    if (selectedFields.includes('returnDetails')) tableHead.push('Ritorno')
    if (selectedFields.includes('createdAt')) tableHead.push('Data')

    autoTable(doc, {
        head: [tableHead],
        body: tableBody,
        startY: 35,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [0, 51, 153] }
    })

    doc.save(`${exportFilename}.pdf`)
  }

  const handleEdit = (participant: any) => {
    setParticipantToEdit(participant)
    setShowEditForm(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
        <div>
           <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
           <p className="text-sm text-gray-500">
              Totale Partecipanti: <span className="font-medium text-gray-900">{totalCount}</span>
           </p>
        </div>
        <div className="flex items-center gap-4">
            <button
                onClick={handleExportClick}
                className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm text-sm font-medium"
            >
                <FileDown className="w-4 h-4" />
                Esporta
            </button>
            <div className="flex flex-col items-end">
                <span className="text-sm text-gray-500 uppercase tracking-wider">Totale Incasso</span>
                <span className="text-2xl font-bold text-blue-600">€ {totalNet.toFixed(2)}</span>
            </div>
        </div>
      </div>

      <TaxParticipantsTable 
        data={activeParticipants}
        emptyMessage={`Nessun partecipante per ${title}`}
        userRole={userRole}
        currentUserId={currentUserId}
        serviceType={serviceType}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onSettleBalance={() => {}}
        onShowDetails={(p) => {
          setSelectedParticipant(p)
          setShowDetails(true)
        }}
        onRefund={handleRefund}
      />

      {refundedParticipants.length > 0 && (
        <div className="mt-8">
          <h3 className="text-md font-semibold text-gray-700 mb-4">Rimborsati</h3>
          <TaxParticipantsTable 
            data={refundedParticipants}
            emptyMessage="Nessun rimborso"
            userRole={userRole}
            currentUserId={currentUserId}
            serviceType={serviceType}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onSettleBalance={() => {}}
            onShowDetails={(p) => {
              setSelectedParticipant(p)
              setShowDetails(true)
            }}
            onRefund={() => {}}
          />
        </div>
      )}

      {/* Modals */}
      <ParticipantDetailsModal 
        isOpen={showDetails}
        onClose={() => {
          setShowDetails(false)
          setSelectedParticipant(null)
        }}
        participant={selectedParticipant}
        excursion={{ name: title }} // Dummy excursion obj for PDF
      />

      <RefundModal 
        isOpen={showRefund}
        onClose={() => {
          setShowRefund(false)
          setParticipantToRefund(null)
        }}
        onConfirm={executeRefund}
        participantName={participantToRefund ? `${participantToRefund.firstName} ${participantToRefund.lastName}` : ''}
        totalPaid={participantToRefund?.price || 0}
      />

      <DeleteChoiceModal 
        isOpen={showDeleteChoice}
        onClose={() => {
            setShowDeleteChoice(false)
            setParticipantToDelete(null)
        }}
        onConfirmDelete={executeDelete}
        onConfirmRefund={() => {
            setShowDeleteChoice(false)
            handleRefund(participantToDelete)
        }}
        participantName={participantToDelete ? `${participantToDelete.firstName} ${participantToDelete.lastName}` : ''}
      />

      {showExportModal && (
        <ExportParticipantsModal 
            onClose={() => setShowExportModal(false)}
            onExport={executeExport}
        />
      )}

      {showEditForm && (
        <TaxParticipantForm 
            initialData={participantToEdit}
            isEditing={true}
            onSuccess={() => {
                setShowEditForm(false)
                setParticipantToEdit(null)
                fetchParticipants()
            }}
            onCancel={() => {
                setShowEditForm(false)
                setParticipantToEdit(null)
            }}
        />
      )}
    </div>
  )
}