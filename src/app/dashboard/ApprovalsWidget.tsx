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

  if (participants.length === 0) return null

  const handleAction = async (id: string, action: 'APPROVE' | 'REJECT') => {
    setLoadingId(id)
    try {
      let pdfBase64 = undefined

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
                  } else if (pData.isRental) {
                       eventData = {
                           type: 'RENTAL',
                           rentalType: pData.rentalType,
                           startDate: pData.rentalStartDate, // Make sure these exist on participant
                           endDate: pData.rentalEndDate
                       }
                  }

                  if (eventData) {
                      // Fix for PDF generator expecting specific fields or types
                      const pdfDoc = generateParticipantPDF({
                          ...pData,
                          paymentType: pData.paymentType || 'BALANCE', // Fallback
                          isOption: pData.isOption || false
                      }, eventData)
                      pdfBase64 = pdfDoc.output('datauristring').split(',')[1]
                  }
              }
          } catch (pdfError) {
              console.error('Error generating PDF for approval:', pdfError)
              // Continue without PDF if fails, but log it
          }
      }

      const res = await fetch(`/api/participants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            approvalStatus: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
            pdfAttachment: pdfBase64
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
        variant: 'error'
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
