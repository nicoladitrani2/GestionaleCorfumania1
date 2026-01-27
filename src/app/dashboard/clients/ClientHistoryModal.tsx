import { X, Calendar, MapPin, Tag } from 'lucide-react'

interface Participant {
  id: string
  firstName: string
  lastName: string
  createdAt: string
  price: number
  deposit: number
  paymentType: string
  notes?: string
  excursion?: { id: string; name: string; startDate: string }
  transfer?: { id: string; name: string; date: string }
  isRental: boolean
  rentalType?: string
  rentalStartDate?: string
  rentalEndDate?: string
  pickupLocation?: string
  dropoffLocation?: string
}

interface ClientHistoryModalProps {
  client: {
    firstName: string
    lastName: string
    participants: Participant[]
  }
  onClose: () => void
}

export function ClientHistoryModal({ client, onClose }: ClientHistoryModalProps) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    try {
      return new Date(dateString).toLocaleDateString('it-IT', {
        weekday: 'short',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch (e) {
      return dateString
    }
  }

  // Flatten and sort history
  const history = client.participants.map(p => {
    let type = 'ALTRO'
    let name = '-'
    let date = p.createdAt
    let details = ''

    if (p.excursion) {
      type = 'ESCURSIONE'
      name = p.excursion.name
      date = p.excursion.startDate
    } else if (p.transfer) {
      type = 'TRASFERIMENTO'
      name = p.transfer.name
      date = p.transfer.date
    } else if (p.isRental) {
      type = `NOLEGGIO ${p.rentalType || ''}`
      name = p.rentalType || 'Noleggio'
      date = p.rentalStartDate || p.createdAt
    }

    return { ...p, type, name, dateObj: new Date(date), displayDate: date }
  }).sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime())

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Storico Attività</h3>
            <p className="text-sm text-gray-500">{client.firstName} {client.lastName}</p>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-200 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto bg-gray-50/50">
          {history.length === 0 ? (
            <div className="text-center py-12">
               <p className="text-gray-400 text-lg">Nessuna attività registrata per questo cliente.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((item) => (
                <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm
                        ${item.type === 'ESCURSIONE' ? 'bg-green-100 text-green-700 border border-green-200' : 
                          item.type === 'TRASFERIMENTO' ? 'bg-blue-100 text-blue-700 border border-blue-200' : 
                          'bg-orange-100 text-orange-700 border border-orange-200'}`}>
                        {item.type}
                      </span>
                      <h4 className="font-bold text-lg text-gray-900">{item.name}</h4>
                    </div>
                    <span className="text-sm font-medium text-gray-500 flex items-center gap-1.5 bg-gray-100 px-3 py-1 rounded-full">
                      <Calendar className="w-4 h-4" />
                      {formatDate(item.displayDate)}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm text-gray-600 mt-4 border-t border-gray-100 pt-4">
                    <div className="space-y-2">
                      {item.pickupLocation && (
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 mt-0.5 text-gray-400 shrink-0" />
                          <span><span className="font-medium text-gray-700">Ritiro:</span> {item.pickupLocation}</span>
                        </div>
                      )}
                      {item.dropoffLocation && (
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 mt-0.5 text-gray-400 shrink-0" />
                          <span><span className="font-medium text-gray-700">Destinazione:</span> {item.dropoffLocation}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                       <div className="flex items-center gap-2">
                         <Tag className="w-4 h-4 text-gray-400 shrink-0" />
                         <span><span className="font-medium text-gray-700">Prezzo:</span> € {item.price.toFixed(2)}</span>
                       </div>
                       {item.notes && (
                         <div className="mt-2 bg-yellow-50 p-3 rounded-lg text-sm text-yellow-800 border border-yellow-100">
                           <strong className="block text-xs uppercase tracking-wide text-yellow-600 mb-1">Note</strong>
                           {item.notes}
                         </div>
                       )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
