import { X, User, Calendar, CreditCard, FileText, Phone, Globe, Briefcase, Users, CheckCircle, AlertCircle, Clock, Info, UserCheck, FileDown, RotateCcw } from 'lucide-react'
import { generateParticipantPDF } from '@/lib/pdf-generator'

interface ParticipantDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  participant: any
  excursion?: any
}

export function ParticipantDetailsModal({ isOpen, onClose, participant, excursion }: ParticipantDetailsModalProps) {
  if (!isOpen || !participant) return null

  const formatDate = (date: string | Date) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('it-IT')
  }

  const formatCurrency = (amount: number) => {
    return `€ ${(amount || 0).toFixed(2)}`
  }

  const getStatusConfig = () => {
    if (participant.paymentType === 'REFUNDED') return { color: 'text-gray-600 bg-gray-100', icon: RotateCcw, text: 'Rimborsato' }
    if (participant.isOption) return { color: 'text-red-600 bg-red-50', icon: Clock, text: 'Non pagato / Opzione' }
    if (participant.paymentType === 'DEPOSIT') return { color: 'text-orange-600 bg-orange-50', icon: AlertCircle, text: 'Acconto Versato' }
    if (participant.paymentType === 'BALANCE') return { color: 'text-green-600 bg-green-50', icon: CheckCircle, text: 'Saldato / Confermato' }
    return { color: 'text-gray-600 bg-gray-50', icon: Info, text: 'N/A' }
  }

  const exportToPDF = () => {
    // Se abbiamo i dati dell'escursione/trasferimento
    if (excursion) {
      // Determina se è un trasferimento controllando se il partecipante ha un transferId o se l'oggetto excursion ha campi da trasferimento
      const isTransfer = participant.transferId || 'pickupLocation' in excursion

      const eventData = isTransfer ? {
        type: 'TRANSFER',
        name: excursion.name,
        date: excursion.date,
        pickupLocation: participant.pickupLocation || excursion.pickupLocation,
        dropoffLocation: participant.dropoffLocation || excursion.dropoffLocation,
        pickupTime: participant.pickupTime,
        returnDate: participant.returnDate,
        returnTime: participant.returnTime,
        returnPickupLocation: participant.returnPickupLocation
      } : {
        type: 'EXCURSION',
        name: excursion.name,
        date: excursion.date || excursion.startDate
      }

      const doc = generateParticipantPDF(
        participant, 
        eventData as any
      )
      doc.save(`scheda-partecipante-${participant.firstName}-${participant.lastName}.pdf`)
      return
    }
    
    // Fallback se non ci sono dati escursione
    const { jsPDF } = require("jspdf");
    const doc = new jsPDF()
    doc.text('Dettagli Partecipante', 14, 20)
    doc.text(`${participant.firstName} ${participant.lastName}`, 14, 30)
    doc.save(`scheda-partecipante-${participant.firstName}-${participant.lastName}.pdf`)
  }

  const status = getStatusConfig()
  const StatusIcon = status.icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <User className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">
                {participant.firstName} {participant.lastName}
              </h2>
              <p className="text-sm text-gray-500">Dettagli Partecipante</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          
          {/* Status Banner */}
          <div className={`flex items-center gap-3 p-4 rounded-xl mb-6 ${status.color}`}>
            <StatusIcon className="w-6 h-6" />
            <div>
              <p className="font-bold text-lg">{status.text}</p>
              {participant.isOption && (
                <p className="text-sm opacity-90">Il pagamento non è stato ancora effettuato</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Personal Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Informazioni Personali</h3>
              
              <div className="flex items-start gap-3">
                <Globe className="w-5 h-5 text-gray-600 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-gray-700">Nazionalità</p>
                  <p className="font-bold text-gray-900">{participant.nationality || '-'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-gray-600 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-gray-700">Data di Nascita</p>
                  <p className="font-bold text-gray-900">{formatDate(participant.dateOfBirth)}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-gray-600 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-gray-700">Documento</p>
                  <p className="font-bold text-gray-900">{participant.docType} - {participant.docNumber}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-gray-600 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-gray-700">Telefono</p>
                  <p className="font-bold text-gray-900">{participant.phoneNumber || '-'}</p>
                </div>
              </div>
            </div>

            {/* Booking & Payment Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Prenotazione e Pagamento</h3>

              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 text-gray-600 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-gray-700">Numero Persone</p>
                  <p className="font-bold text-gray-900">{participant.groupSize || 1}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Briefcase className="w-5 h-5 text-gray-600 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-gray-700">Fornitore</p>
                  <p className="font-bold text-gray-900">{participant.supplier}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CreditCard className="w-5 h-5 text-gray-600 mt-0.5" />
                <div className="w-full">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-bold text-gray-700">Prezzo Totale</span>
                    <span className="font-bold text-gray-900">{formatCurrency(participant.price)}</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-bold text-gray-700">Acconto Versato</span>
                    <span className="font-bold text-green-700">{formatCurrency(participant.deposit)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-100">
                    <span className="text-sm font-bold text-gray-900">Da Saldare</span>
                    <span className="font-bold text-gray-900">
                      {formatCurrency((participant.price || 0) - (participant.deposit || 0))}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 font-medium">
                    Metodo: {participant.paymentMethod === 'CASH' ? 'Contanti' : 'Carta/POS'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Rental Info */}
            {participant.isRental && (
              <div className="col-span-1 md:col-span-2 mt-6 pt-6 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Dati Noleggio</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-start gap-3">
                    <Briefcase className="w-5 h-5 text-gray-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-gray-700">Mezzo</p>
                      <p className="font-bold text-gray-900">
                        {participant.rentalType === 'CAR' ? 'Auto' : 
                         participant.rentalType === 'MOTO' ? 'Moto' : 
                         participant.rentalType === 'BOAT' ? 'Barca' : participant.rentalType || '-'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-gray-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-gray-700">Periodo</p>
                      <p className="font-bold text-gray-900">
                        {formatDate(participant.rentalStartDate)} - {formatDate(participant.rentalEndDate)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <MapIcon className="w-5 h-5 text-gray-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-gray-700">Luoghi</p>
                      <p className="text-sm text-gray-900">
                        <span className="font-semibold">Ritiro:</span> {participant.pickupLocation || '-'}<br/>
                        <span className="font-semibold">Consegna:</span> {participant.dropoffLocation || '-'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Additional Info */}
            <div className="mt-8 pt-6 border-t border-gray-100 col-span-1 md:col-span-2">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Altre Info</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="flex items-start gap-3">
                <UserCheck className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Inserito da</p>
                  <p className="font-medium text-gray-900">
                    {participant.createdBy ? `${participant.createdBy.firstName} ${participant.createdBy.lastName} (${participant.createdBy.code})` : '-'}
                  </p>
                </div>
              </div>

              <div className="bg-yellow-50 p-4 rounded-xl">
                <p className="text-sm text-yellow-800 font-medium mb-1">Note</p>
                <p className="text-sm text-yellow-700 italic">
                  {participant.notes || 'Nessuna nota inserita.'}
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-between items-center">
          <button
            onClick={exportToPDF}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm"
          >
            <FileDown className="w-4 h-4" />
            Scarica PDF
          </button>
          
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors shadow-sm"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  )
}
