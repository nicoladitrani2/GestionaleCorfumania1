'use client'

import { useState, useEffect } from 'react'
import { Edit, Trash2, User, Users, Globe, FileText, Phone, CreditCard, CheckCircle, AlertCircle, Clock, FileDown, BadgeCheck, Euro, Eye, RotateCcw, Map as MapIcon } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { generateParticipantPDF, generateParticipantsListPDF } from '@/lib/pdf-generator'
import { ParticipantDetailsModal } from '../excursions/ParticipantDetailsModal'
import { RefundModal } from '../excursions/RefundModal'
import { DeleteChoiceModal } from '../excursions/DeleteChoiceModal'
import { ExportParticipantsModal } from '../excursions/ExportParticipantsModal'
import { ConfirmationModal } from '../components/ConfirmationModal'
import { AlertModal } from '../components/AlertModal'

interface ParticipantsListProps {
  onEdit: (participant: any) => void
  onUpdate?: () => void
  refreshTrigger: number
  currentUserId: string
  userRole: string
  transfer: any
}

export function ParticipantsList({ 
  onEdit, 
  onUpdate,
  refreshTrigger, 
  currentUserId, 
  userRole, 
  eventId,
  eventType,
  transferName,
  transferDate
}: any) {
  const transferId = eventId
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
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    variant: 'danger' | 'warning' | 'info'
    onConfirm: () => Promise<void>
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'danger',
    onConfirm: async () => {}
  })
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    variant: 'success' | 'error' | 'info' | 'warning'
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'info'
  })

  const fetchParticipants = async () => {
    try {
      const res = await fetch(`/api/participants?transferId=${transferId}`)
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
  }, [transferId])

  useEffect(() => {
    fetchParticipants()
  }, [transferId, refreshTrigger])

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
          const eventData = {
            type: 'TRANSFER',
            name: transferName,
            date: transferDate,
            pickupLocation: participantToDelete.pickupLocation,
            dropoffLocation: participantToDelete.dropoffLocation,
            pickupTime: participantToDelete.pickupTime,
            returnDate: participantToDelete.returnDate,
            returnTime: participantToDelete.returnTime,
            returnPickupLocation: participantToDelete.returnPickupLocation
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
            type: 'TRANSFER',
            name: transferName,
            date: transferDate,
            pickupLocation: p.pickupLocation,
            dropoffLocation: p.dropoffLocation,
            pickupTime: p.pickupTime,
            returnDate: p.returnDate,
            returnTime: p.returnTime,
            returnPickupLocation: p.returnPickupLocation
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
              variant: 'error'
            })
          }
        } catch (error) {
          console.error('Error settling balance:', error)
          setAlertModal({
            isOpen: true,
            title: 'Errore',
            message: 'Errore di connessione',
            variant: 'error'
          })
        }
      }
    })
  }

  const handleRefund = async (participantId: string, amount: number, method: string, notes: string) => {
    try {
      const participant = participants.find(p => p.id === participantId)
      let pdfBase64 = undefined

      if (participant) {
        const methodLabels: Record<string, string> = {
          'CASH': 'Contanti',
          'TRANSFER': 'Bonifico',
          'CARD': 'Carta'
        }
        
        const refundNote = `[${new Date().toLocaleDateString()}] Rimborsato €${amount} (${methodLabels[method] || method}) - ${notes || ''}`
        
        const updatedParticipant = {
            ...participant,
            paymentType: 'REFUNDED',
            notes: participant.notes ? `${participant.notes}\n${refundNote}` : refundNote
        }
        
        const eventData = {
            type: 'TRANSFER',
            name: transferName,
            date: transferDate,
            pickupLocation: participant.pickupLocation,
            dropoffLocation: participant.dropoffLocation,
            pickupTime: participant.pickupTime,
            returnDate: participant.returnDate,
            returnTime: participant.returnTime,
            returnPickupLocation: participant.returnPickupLocation
        }
        
        const pdfDoc = generateParticipantPDF(updatedParticipant, eventData as any)
        pdfBase64 = pdfDoc.output('datauristring').split(',')[1]
      }

      const res = await fetch(`/api/participants/${participantId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          refundAmount: amount, 
          refundMethod: method, 
          notes,
          pdfAttachment: pdfBase64
        })
      })
      if (res.ok) {
        setShowRefund(false)
        fetchParticipants()
        if (onUpdate) onUpdate()
        setAlertModal({
          isOpen: true,
          title: 'Successo',
          message: 'Rimborso registrato con successo',
          variant: 'success'
        })
      } else {
        const errorData = await res.json()
        setAlertModal({
          isOpen: true,
          title: 'Errore',
          message: `Errore: ${errorData.error}`,
          variant: 'error'
        })
      }
    } catch (error) {
      console.error('Refund error:', error)
      setAlertModal({
        isOpen: true,
        title: 'Errore',
        message: 'Errore di connessione',
        variant: 'error'
      })
    }
  }

  // --- Helpers ---

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(blob)
      reader.onloadend = () => {
        const result = reader.result?.toString()
        if (result) {
          resolve(result.split(',')[1])
        } else {
          reject(new Error("Failed to convert PDF to Base64"))
        }
      }
      reader.onerror = error => reject(error)
    })
  }

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

  const exportListToPDF = (list: any[], title: string, filenamePrefix: string) => {
    const doc = new jsPDF()
    
    // --- Header Styling ---
    doc.setFillColor(37, 99, 235) // Blue-600
    doc.rect(0, 0, 210, 40, 'F')
    
    // Title
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text(transferName || 'Dettagli Trasferimento', 14, 18)
    
    // Subtitle
    doc.setFontSize(14)
    doc.setFont('helvetica', 'normal')
    doc.text(title, 14, 26)

    // Date
    doc.setFontSize(10)
    if (transferDate) {
      const date = new Date(transferDate)
      if (!isNaN(date.getTime())) {
        const dateStr = date.toLocaleDateString('it-IT', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
        const formattedDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1)
        doc.text(formattedDate, 14, 34)
      } else {
        doc.text('Data non valida', 14, 34)
      }
    }

    // Columns: Nome, Posti, Nazionalità, Partenza, Destinazione, Telefono, Note
    const tableData = list.map(p => {
      // Partenza (Pickup) Details
      const arrivalDateStr = transferDate ? new Date(transferDate).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) : ''
      // Fallback to transfer time if participant time is missing
      let arrivalTimeStr = p.pickupTime || ''
      if (!arrivalTimeStr && transferDate) {
        arrivalTimeStr = new Date(transferDate).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
      }
      
      const arrivalLocStr = p.pickupLocation || '-'
      
      const arrivalParts = []
      if (arrivalDateStr) arrivalParts.push(arrivalDateStr)
      if (arrivalTimeStr) arrivalParts.push(arrivalTimeStr)
      const arrivalDateTime = arrivalParts.join(' ')
      const arrivalDetails = arrivalDateTime ? `${arrivalLocStr}\n${arrivalDateTime}` : arrivalLocStr

      // Destinazione (Dropoff) Details
      let returnDetails = '-'
      
      // Use dropoffLocation as primary for "Destinazione"
      const dropoffLocStr = p.dropoffLocation || '-'
      
      // If we have return date/time, we can show it, but for Transfer PDF usually Destination is just Location.
      // But let's check if return info is relevant. The original code used it for 'Ritorno'.
      // If we rename 'Ritorno' to 'Destinazione', we should show the Dropoff Location.
      
      returnDetails = dropoffLocStr
      
      // If there is a return date (e.g. Round Trip), we might want to show it?
      // But "Destinazione" usually implies where they are going NOW.
      // The user said "ritiro e deposito le possiamo chiamare partenza e destinazione".
      // So Partenza = Pickup, Destinazione = Dropoff.
      
      return [
        `${p.firstName} ${p.lastName}`,
        p.groupSize?.toString() || '1',
        p.nationality || '-',
        arrivalDetails, // Partenza
        returnDetails,  // Destinazione
        p.phoneNumber || '-',
        p.notes || '-'
      ]
    })

    autoTable(doc, {
      head: [['Nome', 'Pax', 'Naz.', 'Partenza', 'Destinazione', 'Tel', 'Note']],
      body: tableData,
      startY: 50,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [243, 244, 246] },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'center' },
      }
    })

    // Footer
    const pageCount = doc.getNumberOfPages()
    doc.setFontSize(8)
    doc.setTextColor(156, 163, 175)
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.text(`Generato il ${new Date().toLocaleDateString('it-IT')} - Pagina ${i} di ${pageCount}`, 14, doc.internal.pageSize.height - 10)
    }

    doc.save(`${filenamePrefix}-${transferName || 'trasferimento'}.pdf`)
  }

  if (loading) return (
    <div className="flex justify-center items-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  )

  const activeParticipants = participants.filter(p => !p.isExpired && p.paymentType !== 'REFUNDED' && p.approvalStatus !== 'PENDING' && p.approvalStatus !== 'REJECTED')
  const expiredParticipants = participants.filter(p => (p.isExpired && p.paymentType !== 'REFUNDED') || p.approvalStatus === 'REJECTED')
  const refundedParticipants = participants.filter(p => p.paymentType === 'REFUNDED')
  const pendingParticipants = participants.filter(p => p.approvalStatus === 'PENDING')

  const handleExportClick = (list: any[], title: string, filename: string) => {
    setListToExport(list)
    setExportFilename(filename)
    setShowExportModal(true)
  }

  const handleExport = (selectedFields: string[]) => {
    if (!listToExport) return

    const eventData = {
      type: 'TRANSFER',
      name: transferName,
      date: transferDate
    }

    const doc = generateParticipantsListPDF(listToExport, eventData as any, selectedFields)
    doc.save(`${exportFilename}.pdf`)
  }

  const thClassName = "px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider"

  const ParticipantsTable = ({ data, emptyMessage }: { data: any[], emptyMessage: string }) => (
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
                  <Users className="w-4 h-4" /> Pax
                </div>
              </th>
              <th className={thClassName}>
                <div className="flex items-center gap-2">
                  <MapIcon className="w-4 h-4" /> Partenza
                </div>
              </th>
               <th className={thClassName}>
                <div className="flex items-center gap-2">
                  <MapIcon className="w-4 h-4" /> Destinazione
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
                  <CreditCard className="w-4 h-4" /> Acconto
                </div>
              </th>
              <th className={thClassName}>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" /> Stato
                </div>
              </th>
              <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                    <div className="flex flex-col">
                      <span>{p.firstName} {p.lastName}</span>
                      <span className="text-xs text-gray-600">{p.phoneNumber}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                      {p.groupSize || 1}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                      <div className="flex flex-col">
                          <span>{p.pickupLocation || '-'}</span>
                          <span className="text-xs text-gray-500">{p.pickupTime || '-'}</span>
                      </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                      <div className="flex flex-col">
                          <span>{p.dropoffLocation || '-'}</span>
                          {p.returnDate && (
                              <span className="flex items-center gap-1 text-xs text-purple-600 font-bold mt-1 bg-purple-50 px-2 py-0.5 rounded-full w-fit" title={`Ritorno: ${new Date(p.returnDate).toLocaleDateString('it-IT')} ${p.returnTime || ''}`}>
                                  <RotateCcw className="w-3 h-3" />
                                  + Ritorno
                              </span>
                          )}
                      </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-900">{p.supplier?.name || '-'}</span>
                      {p.commissionPercentage > 0 && (
                        <div className="text-xs text-blue-500">
                          Comm: {p.commissionPercentage}
                          {(() => {
                              if (p.createdBy?.agency) {
                                  return p.createdBy.agency.commissionType === 'FIXED' ? '€' : '%';
                              }
                              // Fallback per Admin (Arianna Amministrazione) che ha commissione fissa
                              const creatorName = `${p.createdBy?.firstName || ''} ${p.createdBy?.lastName || ''}`.toLowerCase();
                              if (creatorName.includes('arianna') || creatorName.includes('amministrazione') || creatorName.includes('corfumania')) {
                                  return '€';
                              }
                              return '%';
                          })()}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-bold text-gray-800">
                    <div>
                      € {p.price?.toFixed(2) || '0.00'}
                      {p.tax > 0 && <div className="text-xs text-red-500 font-normal">Tasse: € {p.tax.toFixed(2)}</div>}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-bold text-gray-800">€ {p.deposit?.toFixed(2) || '0.00'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2.5 py-1 inline-flex items-center text-xs font-medium rounded-full border ${getStatusColor(p)}`}>
                      {getStatusIcon(p)}
                      {getStatusText(p)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setSelectedParticipant(p)
                          setShowDetails(true)
                        }}
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
                              onClick={() => handleSettleBalance(p)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-md transition-colors border border-green-200"
                              title={`Registra Saldo: € ${(p.price - (p.deposit || 0)).toFixed(2)}`}
                            >
                              <Euro className="w-3.5 h-3.5" />
                              Saldo
                            </button>
                          )}
                          
                          {p.deposit > 0 && (
                            <button
                              onClick={() => {
                                setParticipantToRefund(p)
                                setShowRefund(true)
                              }}
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
                            onClick={() => handleDelete(p.id)} 
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
                <td colSpan={9} className="px-6 py-12 text-center text-sm text-gray-500">
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
                    <span className="text-xs text-gray-400">{p.phoneNumber || '-'}</span>
                  </div>
                </div>
                <span className={`px-2 py-1 inline-flex items-center text-xs font-medium rounded-full border ${getStatusColor(p)}`}>
                  {getStatusIcon(p)}
                  {getStatusText(p)}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2 text-sm text-gray-600 bg-gray-50/50 p-2 rounded-lg">
                <div className="flex items-start gap-2">
                   <MapIcon className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                   <div className="flex flex-col">
                     <span className="text-xs text-gray-400">Ritiro</span>
                     <span className="font-medium">{p.pickupLocation || '-'}</span>
                     <span className="text-xs text-gray-500">{p.pickupTime || '-'}</span>
                   </div>
                </div>
                <div className="flex items-start gap-2">
                   <MapIcon className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                   <div className="flex flex-col">
                     <span className="text-xs text-gray-400">Deposito</span>
                     <span className="font-medium">{p.dropoffLocation || '-'}</span>
                   </div>
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
                        onClick={() => {
                          setSelectedParticipant(p)
                          setShowDetails(true)
                        }}
                        className="p-2 text-blue-700 bg-blue-50 rounded-lg border border-blue-200"
                        title="Dettagli"
                    >
                        <Eye className="w-4 h-4" />
                    </button>
                    {canEdit && (
                        <>
                             {(p.paymentType === 'DEPOSIT' || p.isOption) && (
                                <button
                                  onClick={() => handleSettleBalance(p)}
                                  className="p-2 text-green-700 bg-green-50 rounded-lg border border-green-200"
                                  title="Saldo"
                                >
                                  <Euro className="w-4 h-4" />
                                </button>
                              )}
                              {p.deposit > 0 && (
                                <button
                                  onClick={() => {
                                    setParticipantToRefund(p)
                                    setShowRefund(true)
                                  }}
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
                                onClick={() => handleDelete(p.id)} 
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

  return (
    <div className="space-y-6">
      {/* Header with Stats and Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
             <Users className="w-6 h-6 text-blue-600" />
             Lista Partecipanti
             <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
               {activeParticipants.length}
             </span>
           </h2>
           <p className="text-gray-500 text-sm mt-1">Gestisci i partecipanti e i pagamenti</p>
        </div>
        <div className="flex gap-2">
          {activeParticipants.length > 0 && (
            <button
              onClick={() => handleExportClick(activeParticipants, 'Lista Partecipanti', 'partecipanti-trasferimento')}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all hover:shadow-md"
            >
              <FileDown className="w-4 h-4" />
              Esporta PDF
            </button>
          )}
        </div>
      </div>

      {/* Lists */}
      <div className="space-y-8">
        {pendingParticipants.length > 0 && (
          <div className="opacity-100">
            <h3 className="text-lg font-semibold text-amber-600 mb-4 flex items-center gap-2">
               <AlertCircle className="w-5 h-5" />
               In Attesa di Approvazione
            </h3>
            <ParticipantsTable 
              data={pendingParticipants} 
              emptyMessage="Nessun partecipante in attesa." 
            />
          </div>
        )}

        <ParticipantsTable 
           data={activeParticipants} 
           emptyMessage="Nessun partecipante registrato per questo trasferimento." 
        />
        
        {expiredParticipants.length > 0 && (
          <div className="opacity-75">
            <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
               <Clock className="w-5 h-5" />
               Scaduti / Non Confermati
            </h3>
            <ParticipantsTable 
              data={expiredParticipants} 
              emptyMessage="" 
            />
          </div>
        )}

        {refundedParticipants.length > 0 && (
          <div className="opacity-75">
            <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
               <RotateCcw className="w-5 h-5" />
               Rimborsati
            </h3>
            <ParticipantsTable 
              data={refundedParticipants} 
              emptyMessage="" 
            />
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedParticipant && (
        <ParticipantDetailsModal
          isOpen={showDetails}
          onClose={() => {
            setShowDetails(false)
            setSelectedParticipant(null)
          }}
          participant={selectedParticipant}
          excursion={{
            id: transferId,
            name: transferName,
            date: transferDate,
            pickupLocation: selectedParticipant.pickupLocation,
            dropoffLocation: selectedParticipant.dropoffLocation
          }}
          canEdit={userRole === 'ADMIN' || selectedParticipant.createdById === currentUserId}
        />
      )}

      {showRefund && participantToRefund && (
        <RefundModal
          isOpen={showRefund}
          onClose={() => {
            setShowRefund(false)
            setParticipantToRefund(null)
          }}
          onConfirm={handleRefund}
          participantName={`${participantToRefund.firstName} ${participantToRefund.lastName}`}
          maxAmount={participantToRefund.deposit || 0}
        />
      )}

      {showDeleteChoice && participantToDelete && (
        <DeleteChoiceModal
          isOpen={showDeleteChoice}
          onClose={() => {
             setShowDeleteChoice(false)
             setParticipantToDelete(null)
          }}
          onConfirmDelete={executeDelete}
          onRequestRefund={() => {
             setShowDeleteChoice(false)
             setParticipantToRefund(participantToDelete)
             setShowRefund(true)
          }}
          participantName={`${participantToDelete.firstName} ${participantToDelete.lastName}`}
        />
      )}

      {showExportModal && (
        <ExportParticipantsModal
          onClose={() => setShowExportModal(false)}
          onExport={handleExport}
        />
      )}

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
