'use client'

import { useState } from 'react'
import { Check, X, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { generateParticipantPDF } from '@/lib/pdf-generator'
import { AlertModal } from './components/AlertModal'

interface PendingParticipant {
  id: string
  firstName: string
  lastName: string
  price: number
  originalPrice: number | null
  excursion?: { name: string, startDate: string } | null
  transfer?: { name: string, date: string } | null
  rentalType?: string | null
  rentalStartDate?: string | null
  createdBy: { firstName: string | null, lastName: string | null, email: string }
}

export function ApprovalsWidget({ participants }: { participants: PendingParticipant[] }) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)
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
  const [pendingTransferApproval, setPendingTransferApproval] = useState<{
    participantId: string
    pData: any
    eventData: any
  } | null>(null)
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

  if (participants.length === 0) return null

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

  const approveParticipant = async (
    participantId: string,
    pData: any,
    eventData: any,
    transferData?: { pa: number; pc: number; mp: number }
  ) => {
    const payload: any = { approvalStatus: 'APPROVED' }
    if (transferData) {
      payload.transferPriceAdult = transferData.pa
      payload.transferPriceChild = transferData.pc
      payload.transferMaxParticipants = transferData.mp
    }

    if (eventData) {
      const pdfDocIT = generateParticipantPDF(
        {
          ...pData,
          paymentType: pData.paymentType || 'BALANCE',
          isOption: pData.isOption || false,
        },
        eventData,
        'it'
      )
      payload.pdfAttachmentIT = pdfDocIT.output('datauristring').split(',')[1]

      const pdfDocEN = generateParticipantPDF(
        {
          ...pData,
          paymentType: pData.paymentType || 'BALANCE',
          isOption: pData.isOption || false,
        },
        eventData,
        'en'
      )
      payload.pdfAttachmentEN = pdfDocEN.output('datauristring').split(',')[1]
    }

    const res = await fetch(`/api/participants/${participantId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      if (res.status === 409 && errData?.code === 'TRANSFER_APPROVAL_REQUIRED') {
        const t = errData?.transfer || {}
        setPendingTransferApproval({ participantId, pData, eventData })
        setTransferApprovalModal({
          isOpen: true,
          participantId,
          priceAdult: typeof t.priceAdult === 'number' ? String(t.priceAdult) : '',
          priceChild: typeof t.priceChild === 'number' ? String(t.priceChild) : '',
          maxParticipants: typeof t.maxParticipants === 'number' ? String(t.maxParticipants) : '',
        })
        return
      }
      throw new Error(errData.error || 'Action failed')
    }

    router.refresh()
  }

  const handleConfirmTransferApproval = async () => {
    if (!pendingTransferApproval) return
    const validation = validateTransferApprovalData()
    if (!validation.ok) {
      setAlertModal({
        isOpen: true,
        title: 'Errore',
        message: validation.error,
        variant: 'danger',
      })
      return
    }

    setLoadingId(pendingTransferApproval.participantId)
    try {
      await approveParticipant(
        pendingTransferApproval.participantId,
        pendingTransferApproval.pData,
        pendingTransferApproval.eventData,
        { pa: validation.pa, pc: validation.pc, mp: validation.mp }
      )
      setTransferApprovalModal({
        isOpen: false,
        participantId: '',
        priceAdult: '',
        priceChild: '',
        maxParticipants: '',
      })
      setPendingTransferApproval(null)
    } catch (error: any) {
      setAlertModal({
        isOpen: true,
        title: 'Errore',
        message: `Si è verificato un errore: ${error.message}`,
        variant: 'danger',
      })
    } finally {
      setLoadingId(null)
    }
  }

  const handleAction = async (id: string, action: 'APPROVE' | 'REJECT') => {
    setLoadingId(id)
    try {
      if (action === 'APPROVE') {
          try {
              // Fetch full details for PDF
              const detailRes = await fetch(`/api/participants/${id}`)
              if (detailRes.ok) {
                  const pData = await detailRes.json()
                  
                  let eventData: any = null
                  if (pData.excursion) {
                      eventData = {
                          type: 'EXCURSION',
                          name: pData.excursion.name,
                          date: pData.excursion.startDate,
                          departureTime: pData.excursion.departureTime,
                          pickupLocation: pData.pickupLocation,
                          pickupTime: pData.pickupTime
                      }
                  } else if (pData.transfer) {
                      eventData = {
                          type: 'TRANSFER',
                          name: pData.transfer.name,
                          date: pData.transfer.date,
                          pickupLocation: pData.pickupLocation,
                          dropoffLocation: pData.dropoffLocation,
                          pickupTime: pData.pickupTime,
                          returnDate: pData.returnDate,
                          returnTime: pData.returnTime,
                          returnPickupLocation: pData.returnPickupLocation
                      }
                  } else if (pData.rental || pData.rentalType) {
                       eventData = {
                           type: 'RENTAL',
                           name: pData.rental?.name || pData.rentalType,
                           date: pData.rentalStartDate || new Date().toISOString(),
                           pickupLocation: pData.pickupLocation,
                           dropoffLocation: pData.dropoffLocation
                       }
                  }

                  if (pData.transfer && pData.transfer.approvalStatus && pData.transfer.approvalStatus !== 'APPROVED') {
                    setPendingTransferApproval({ participantId: id, pData, eventData })
                    setTransferApprovalModal({
                      isOpen: true,
                      participantId: id,
                      priceAdult: typeof pData.transfer.priceAdult === 'number' ? String(pData.transfer.priceAdult) : '',
                      priceChild: typeof pData.transfer.priceChild === 'number' ? String(pData.transfer.priceChild) : '',
                      maxParticipants: typeof pData.transfer.maxParticipants === 'number' ? String(pData.transfer.maxParticipants) : '',
                    })
                    setLoadingId(null)
                    return
                  }

                  await approveParticipant(id, pData, eventData)
                  setLoadingId(null)
                  return
              }
          } catch (pdfError) {
              console.error('Error generating PDF for approval:', pdfError)
              // Fallback to normal flow without PDF if fails
          }
      }

      const res = await fetch(`/api/participants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            approvalStatus: action === 'APPROVE' ? 'APPROVED' : 'REJECTED'
            // No PDF if we reached here (either error or no event data)
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Action failed')
      }
      
      router.refresh()
    } catch (error: any) {
      console.error('Error updating status:', error)
      setAlertModal({
        isOpen: true,
        title: 'Errore',
        message: `Si è verificato un errore: ${error.message}`,
        variant: 'danger'
      })
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <>
      <div className="bg-white overflow-hidden rounded-lg shadow border border-orange-200 mb-8">
        <div className="p-4 bg-orange-50 border-b border-orange-200 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-orange-600" />
          <h3 className="text-lg font-semibold text-orange-900">
            Richieste di Approvazione Sconto ({participants.length})
          </h3>
        </div>
        <div className="divide-y divide-gray-100">
          {participants.map((p) => {
            const original = p.originalPrice || 0
            const discount = original - p.price
            const percent = original > 0 ? Math.round((discount / original) * 100) : 0
            
            let context = ''
            if (p.excursion) context = `Escursione: ${p.excursion.name} (${new Date(p.excursion.startDate).toLocaleDateString()})`
            else if (p.transfer) context = `Transfer: ${p.transfer.name} (${new Date(p.transfer.date).toLocaleDateString()})`
            else if (p.rentalType) context = `Noleggio: ${p.rentalType} (${new Date(p.rentalStartDate || '').toLocaleDateString()})`

            return (
              <div key={p.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <div className="font-medium text-gray-900">
                    {p.firstName} {p.lastName}
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      da {p.createdBy.firstName} {p.createdBy.lastName}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">{context}</div>
                  <div className="text-sm mt-1">
                    Prezzo proposto: <span className="font-bold text-green-600">€{p.price}</span>
                    <span className="text-gray-400 mx-2">|</span>
                    Originale: <span className="line-through text-gray-500">€{original}</span>
                    <span className="ml-2 text-orange-600">(-{percent}%)</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAction(p.id, 'APPROVE')}
                    disabled={loadingId === p.id}
                    className="p-2 bg-green-100 text-green-700 rounded-full hover:bg-green-200 disabled:opacity-50 transition-colors"
                    title="Approva"
                  >
                    <Check className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleAction(p.id, 'REJECT')}
                    disabled={loadingId === p.id}
                    className="p-2 bg-red-100 text-red-700 rounded-full hover:bg-red-200 disabled:opacity-50 transition-colors"
                    title="Rifiuta"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {transferApprovalModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-green-600 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Approva Trasferimento</h3>
              <button
                onClick={() => {
                  setTransferApprovalModal({
                    isOpen: false,
                    participantId: '',
                    priceAdult: '',
                    priceChild: '',
                    maxParticipants: '',
                  })
                  setPendingTransferApproval(null)
                }}
                className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
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
                  onClick={() => {
                    setTransferApprovalModal({
                      isOpen: false,
                      participantId: '',
                      priceAdult: '',
                      priceChild: '',
                      maxParticipants: '',
                    })
                    setPendingTransferApproval(null)
                  }}
                  className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Annulla
                </button>
                <button
                  onClick={handleConfirmTransferApproval}
                  disabled={loadingId === transferApprovalModal.participantId}
                  className="px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Conferma e Approva
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
        title={alertModal.title}
        message={alertModal.message}
        variant={alertModal.variant}
      />
    </>
  )
}
