'use client'

import { useState, useEffect } from 'react'
import { Edit, Trash2, User, Users, CreditCard, CheckCircle, AlertCircle, Clock, FileDown, Euro, Eye, RotateCcw, Map as MapIcon, X } from 'lucide-react'
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
  transferDate,
  transferConfirmationDeadline
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
    variant: 'success' | 'danger' | 'info' | 'warning'
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'info'
  })
  const [transferDetails, setTransferDetails] = useState<any | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [transferApprovalModal, setTransferApprovalModal] = useState<{
    isOpen: boolean
    participantId: string
    priceAdult: string
    priceChild: string
    maxParticipants: string
  }>({
    isOpen: false,
    participantId: '',
    priceAdult: '',
    priceChild: '',
    maxParticipants: ''
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

  const fetchTransfer = async () => {
    try {
      const res = await fetch(`/api/transfers/${transferId}`)
      if (res.ok) {
        const data = await res.json()
        setTransferDetails(data)
      }
    } catch (error) {
      console.error('Error fetching transfer:', error)
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
    fetchTransfer()
  }, [transferId, refreshTrigger])

  const validateTransferApprovalData = () => {
    const pa = parseFloat(transferApprovalModal.priceAdult)
    const pc = parseFloat(transferApprovalModal.priceChild)
    const mp = parseInt(transferApprovalModal.maxParticipants)

    if (Number.isNaN(pa) || Number.isNaN(pc) || Number.isNaN(mp)) {
      return { ok: false as const, error: 'Inserisci valori numerici validi per prezzi e limite massimo.' }
    }
    if (pa < 0 || pc < 0) {
      return { ok: false as const, error: 'I prezzi non possono essere negativi.' }
    }
    if (pa <= 0 && pc <= 0) {
      return { ok: false as const, error: 'Imposta almeno un prezzo (adulto o bambino) maggiore di 0.' }
    }
    if (mp <= 0) {
      return { ok: false as const, error: 'Il limite massimo partecipanti deve essere maggiore di 0.' }
    }

    return { ok: true as const, pa, pc, mp }
  }

  const handleApproveParticipant = async (participantId: string) => {
    if (approvingId) return
    setApprovingId(participantId)
    try {
      if (!transferDetails) {
        await fetchTransfer()
      }
      const isTransferPending = transferDetails?.approvalStatus && transferDetails.approvalStatus !== 'APPROVED'

      if (isTransferPending) {
        setTransferApprovalModal({
          isOpen: true,
          participantId,
          priceAdult: typeof transferDetails?.priceAdult === 'number' ? String(transferDetails.priceAdult) : '',
          priceChild: typeof transferDetails?.priceChild === 'number' ? String(transferDetails.priceChild) : '',
          maxParticipants: typeof transferDetails?.maxParticipants === 'number' ? String(transferDetails.maxParticipants) : '',
        })
        setApprovingId(null)
        return
      }

      const res = await fetch(`/api/participants/${participantId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED' }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (res.status === 409 && data?.code === 'TRANSFER_APPROVAL_REQUIRED') {
          const t = data?.transfer || {}
          setTransferApprovalModal({
            isOpen: true,
            participantId,
            priceAdult: typeof t.priceAdult === 'number' ? String(t.priceAdult) : '',
            priceChild: typeof t.priceChild === 'number' ? String(t.priceChild) : '',
            maxParticipants: typeof t.maxParticipants === 'number' ? String(t.maxParticipants) : '',
          })
          return
        }
        throw new Error(data.error || 'Errore durante l\'approvazione')
      }

      await fetchParticipants()
      await fetchTransfer()
      if (onUpdate) onUpdate()
    } catch (e: any) {
      setAlertModal({
        isOpen: true,
        title: 'Errore',
        message: e.message || 'Errore durante l\'approvazione',
        variant: 'danger'
      })
    } finally {
      setApprovingId(null)
    }
  }

  const handleConfirmTransferApproval = async () => {
    const participantId = transferApprovalModal.participantId
    if (!participantId) return

    const validation = validateTransferApprovalData()
    if (!validation.ok) {
      setAlertModal({
        isOpen: true,
        title: 'Errore',
        message: validation.error,
        variant: 'danger'
      })
      return
    }

    setApprovingId(participantId)
    try {
      const res = await fetch(`/api/participants/${participantId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'APPROVED',
          transferPriceAdult: validation.pa,
          transferPriceChild: validation.pc,
          transferMaxParticipants: validation.mp
        })
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Errore durante l\'approvazione')
      }

      setTransferApprovalModal({
        isOpen: false,
        participantId: '',
        priceAdult: '',
        priceChild: '',
        maxParticipants: ''
      })

      await fetchParticipants()
      await fetchTransfer()
      if (onUpdate) onUpdate()
    } catch (e: any) {
      setAlertModal({
        isOpen: true,
        title: 'Errore',
        message: e.message || 'Errore durante l\'approvazione',
        variant: 'danger'
      })
    } finally {
      setApprovingId(null)
    }
  }

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
          variant: 'danger'
        })
      }
    } catch (error) {
      console.error('Refund error:', error)
      setAlertModal({
        isOpen: true,
        title: 'Errore',
        message: 'Errore di connessione',
        variant: 'danger'
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

  const getApproval = (p: any) => {
    if (p.approvalStatus) return p.approvalStatus
    if (p.paymentStatus === 'PENDING_APPROVAL') return 'PENDING'
    if (p.paymentStatus === 'REJECTED') return 'REJECTED'
    return undefined
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

      const dropoffLocStr = p.dropoffLocation || '-'
      let returnDetails = dropoffLocStr

      if (p.returnDate) {
        const dateStr = new Date(p.returnDate).toLocaleDateString('it-IT', {
          day: '2-digit',
          month: '2-digit'
        })
        const timeStr = p.returnTime || ''
        const parts = [dateStr, timeStr].filter(Boolean).join(' ')
        if (parts) {
          returnDetails = `${dropoffLocStr}\nRitorno: ${parts}`
        }
      }

      return [
        `${p.firstName} ${p.lastName}`,
        ((p.adults || 0) + (p.children || 0) + (p.infants || 0)).toString(),
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

  const now = new Date()
  const deadline = transferConfirmationDeadline ? new Date(transferConfirmationDeadline) : null

  const isParticipantExpired = (p: any) => {
    const approval = getApproval(p)
    if (p.paymentType === 'REFUNDED') return false
    if (approval === 'REJECTED') return false
    if (p.paymentType === 'BALANCE') return false

    if (!deadline) {
      return !!p.isExpired
    }

    return now > deadline
  }

  const activeParticipants = participants.filter(p => !isParticipantExpired(p) && p.paymentType === 'BALANCE' && getApproval(p) !== 'PENDING' && getApproval(p) !== 'REJECTED')
  const depositParticipants = participants.filter(p => !isParticipantExpired(p) && p.paymentType === 'DEPOSIT' && getApproval(p) !== 'PENDING' && getApproval(p) !== 'REJECTED')
  const expiredParticipants = participants.filter(p => isParticipantExpired(p) && p.paymentType !== 'REFUNDED')
  const refundedParticipants = participants.filter(p => p.paymentType === 'REFUNDED')
  const pendingParticipants = participants.filter(p => getApproval(p) === 'PENDING')
  const rejectedParticipants = participants.filter(p => getApproval(p) === 'REJECTED')
  const maxParticipants = typeof transferDetails?.maxParticipants === 'number' ? transferDetails.maxParticipants : null
  const occupiedPax =
    maxParticipants && maxParticipants > 0
      ? participants.reduce((sum: number, p: any) => {
          const approval = getApproval(p)
          const isRejected = approval === 'REJECTED'
          const isRefunded = p.paymentType === 'REFUNDED' || p.status === 'REFUNDED'
          const isActive = !p.status || p.status === 'ACTIVE'
          const isExpired = isParticipantExpired(p)
          if (isRejected || isRefunded || !isActive || isExpired) return sum
          const pax = (p.adults || 0) + (p.children || 0) + (p.infants || 0)
          return sum + (pax > 0 ? pax : 1)
        }, 0)
      : 0
  const remainingPax = maxParticipants && maxParticipants > 0 ? maxParticipants - occupiedPax : null

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
                      {(p.adults || 0) + (p.children || 0) + (p.infants || 0)}
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
                          {/* Approval Buttons for Admin */}
                          {userRole === 'ADMIN' && getApproval(p) === 'PENDING' && (
                            <>
                              <button
                                onClick={() => {
                                  handleApproveParticipant(p.id)
                                }}
                                disabled={approvingId === p.id}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-md transition-colors border border-green-200"
                                title="Approva Partecipante"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                Approva
                              </button>
                               <button
                                onClick={() => {
                                   fetch(`/api/participants/${p.id}/approve`, {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ status: 'REJECTED' })
                                      }).then(() => {
                                          fetchParticipants()
                                          if (onUpdate) onUpdate()
                                      })
                                }}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-md transition-colors border border-red-200"
                                title="Rifiuta Partecipante"
                              >
                                <X className="w-3.5 h-3.5" />
                                Rifiuta
                              </button>
                            </>
                          )}

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
                          
                      {p.deposit > 0 && (userRole === 'ADMIN' || (p.createdById === currentUserId && (!deadline || now <= deadline))) && (
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
                       {(p.adults || 0) + (p.children || 0) + (p.infants || 0)}
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
                 <div className="flex gap-4 text-sm">
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

      {maxParticipants && maxParticipants > 0 && (
        <div
          className={`p-4 rounded-xl border ${
            typeof remainingPax === 'number' && remainingPax < 0
              ? 'bg-red-50 border-red-200'
              : 'bg-blue-50 border-blue-200'
          }`}
        >
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center gap-2 font-semibold text-gray-900">
              <Users className="w-4 h-4 text-blue-700" />
              Posti
            </div>
            <div className="text-gray-800">
              Massimi: <span className="font-bold">{maxParticipants}</span>
            </div>
            <div className="text-gray-800">
              Occupati: <span className="font-bold">{occupiedPax}</span>
            </div>
            <div className={`${typeof remainingPax === 'number' && remainingPax < 0 ? 'text-red-700' : 'text-gray-800'}`}>
              Disponibili: <span className="font-bold">{typeof remainingPax === 'number' ? remainingPax : '-'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Lists */}
      <div className="space-y-8">
        {pendingParticipants.length > 0 && (
          <div className="opacity-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-amber-600 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                In Attesa di Approvazione
              </h3>
              <button
                onClick={() => handleExportClick(pendingParticipants, 'Partecipanti in attesa', 'partecipanti-trasferimento-in-attesa')}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
              >
                <FileDown className="w-3.5 h-3.5" />
                Esporta PDF
              </button>
            </div>
            <ParticipantsTable 
              data={pendingParticipants} 
              emptyMessage="Nessun partecipante in attesa." 
            />
          </div>
        )}

        {rejectedParticipants.length > 0 && (
          <div className="opacity-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-red-700 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Rifiutati
              </h3>
              <button
                onClick={() => handleExportClick(rejectedParticipants, 'Partecipanti rifiutati', 'partecipanti-trasferimento-rifiutati')}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
              >
                <FileDown className="w-3.5 h-3.5" />
                Esporta PDF
              </button>
            </div>
            <ParticipantsTable
              data={rejectedParticipants}
              emptyMessage="Nessun partecipante rifiutato."
            />
          </div>
        )}

        <div className="opacity-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-green-700 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Attivi (Saldo)
            </h3>
            {activeParticipants.length > 0 && (
              <button
                onClick={() => handleExportClick(activeParticipants, 'Partecipanti attivi', 'partecipanti-trasferimento-attivi')}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
              >
                <FileDown className="w-3.5 h-3.5" />
                Esporta PDF
              </button>
            )}
          </div>
          <ParticipantsTable 
            data={activeParticipants} 
            emptyMessage="Nessun partecipante saldo registrato per questo trasferimento." 
          />
        </div>

        <div className="opacity-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-orange-700 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Acconto
            </h3>
            {depositParticipants.length > 0 && (
              <button
                onClick={() => handleExportClick(depositParticipants, 'Partecipanti in acconto', 'partecipanti-trasferimento-acconto')}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
              >
                <FileDown className="w-3.5 h-3.5" />
                Esporta PDF
              </button>
            )}
          </div>
          <ParticipantsTable 
            data={depositParticipants} 
            emptyMessage="Nessun partecipante in acconto per questo trasferimento." 
          />
        </div>
        
        {expiredParticipants.length > 0 && (
          <div className="opacity-75">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Scaduti / Non Confermati
              </h3>
              <button
                onClick={() => handleExportClick(expiredParticipants, 'Partecipanti scaduti', 'partecipanti-trasferimento-scaduti')}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
              >
                <FileDown className="w-3.5 h-3.5" />
                Esporta PDF
              </button>
            </div>
            <ParticipantsTable 
              data={expiredParticipants} 
              emptyMessage="" 
            />
          </div>
        )}

        {refundedParticipants.length > 0 && (
          <div className="opacity-75">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                <RotateCcw className="w-5 h-5" />
                Rimborsati
              </h3>
              <button
                onClick={() => handleExportClick(refundedParticipants, 'Partecipanti rimborsati', 'partecipanti-trasferimento-rimborsati')}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
              >
                <FileDown className="w-3.5 h-3.5" />
                Esporta PDF
              </button>
            </div>
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
          participant={participantToRefund}
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

      {transferApprovalModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="bg-green-600 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Approva Trasferimento</h3>
              <button
                onClick={() =>
                  setTransferApprovalModal({
                    isOpen: false,
                    participantId: '',
                    priceAdult: '',
                    priceChild: '',
                    maxParticipants: '',
                  })
                }
                className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prezzo Adulti</label>
                <input
                  type="number"
                  value={transferApprovalModal.priceAdult}
                  onChange={(e) => setTransferApprovalModal(prev => ({ ...prev, priceAdult: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prezzo Bambini</label>
                <input
                  type="number"
                  value={transferApprovalModal.priceChild}
                  onChange={(e) => setTransferApprovalModal(prev => ({ ...prev, priceChild: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Limite massimo partecipanti</label>
                <input
                  type="number"
                  value={transferApprovalModal.maxParticipants}
                  onChange={(e) => setTransferApprovalModal(prev => ({ ...prev, maxParticipants: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() =>
                    setTransferApprovalModal({
                      isOpen: false,
                      participantId: '',
                      priceAdult: '',
                      priceChild: '',
                      maxParticipants: '',
                    })
                  }
                  className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Annulla
                </button>
                <button
                  onClick={handleConfirmTransferApproval}
                  disabled={approvingId === transferApprovalModal.participantId}
                  className="px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Conferma e Approva
                </button>
              </div>
            </div>
          </div>
        </div>
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
