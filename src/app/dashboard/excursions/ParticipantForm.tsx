'use client'

import { useState, useEffect } from 'react'
import { Save, X, User, Calendar, CreditCard, FileText, Phone, Globe, Briefcase, UserPlus, Map as MapIcon } from 'lucide-react'

import { generateParticipantPDF } from '@/lib/pdf-generator'

interface ParticipantFormProps {
  onSuccess: () => void
  onCancel: () => void
  initialData?: any
  excursionId?: string
  transferId?: string
  excursionName?: string
  excursionDate?: string | Date
  type?: 'EXCURSION' | 'TRANSFER'
  defaultValues?: {
    pickupLocation?: string
    dropoffLocation?: string
    pickupTime?: string
    returnDate?: string
    returnTime?: string
    returnPickupLocation?: string
  }
  defaultSupplier?: string
}

const NATIONALITIES = [
  { code: 'IT', name: 'Italia' },
  { code: 'EN', name: 'Regno Unito' },
  { code: 'FR', name: 'Francia' },
  { code: 'DE', name: 'Germania' },
  { code: 'ES', name: 'Spagna' },
  { code: 'GR', name: 'Grecia' },
  { code: 'PL', name: 'Polonia' },
  { code: 'NL', name: 'Paesi Bassi' },
  { code: 'BE', name: 'Belgio' },
  { code: 'PT', name: 'Portogallo' },
  { code: 'RO', name: 'Romania' },
  { code: 'RU', name: 'Russia' },
  { code: 'US', name: 'Stati Uniti' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'OTHER', name: 'Altro' }
]

export function ParticipantForm({ 
  onSuccess, 
  onCancel, 
  initialData, 
  excursionId, 
  transferId,
  excursionName, 
  excursionDate,
  type = 'EXCURSION',
  defaultValues,
  defaultSupplier
}: ParticipantFormProps) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    nationality: 'IT',
    dateOfBirth: '',
    docNumber: '',
    docType: 'ID_CARD',
    phoneNumber: '',
    email: '',
    notes: '',
    supplier: 'GO4SEA',
    isOption: false,
    paymentType: 'DEPOSIT',
    paymentMethod: 'CASH',
    depositPaymentMethod: 'CASH',
    balancePaymentMethod: '',
    groupSize: 1,
    price: 0,
    deposit: 0,
    pickupLocation: defaultValues?.pickupLocation || '',
    dropoffLocation: defaultValues?.dropoffLocation || '',
    pickupTime: defaultValues?.pickupTime || '',
    returnPickupLocation: defaultValues?.returnPickupLocation || '',
    returnDate: defaultValues?.returnDate || '',
    returnTime: defaultValues?.returnTime || '',
  })
  const [customNationality, setCustomNationality] = useState('')
  const [error, setError] = useState('')
  const [depositError, setDepositError] = useState('')
  const [loading, setLoading] = useState(false)
  const [suppliers, setSuppliers] = useState<{ id: string, name: string }[]>([])

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const res = await fetch('/api/suppliers')
        if (res.ok) {
          const data = await res.json()
          setSuppliers(data)
          
          // Se stiamo creando un nuovo partecipante
          if (!initialData && data.length > 0) {
            setFormData(prev => {
              // 1. Se Admin -> Corfumania
              if (currentUserRole === 'ADMIN') {
                const corfumania = data.find((s: any) => s.name.toLowerCase() === 'corfumania')
                if (corfumania) return { ...prev, supplier: corfumania.name }
              }

              // 2. Se Assistant (o comunque c'è un defaultSupplier passato)
              if (defaultSupplier) {
                const match = data.find((s: any) => s.name === defaultSupplier)
                if (match) return { ...prev, supplier: match.name }
              }

              // 3. Fallback a GO4SEA
              const go4sea = data.find((s: any) => s.name.toLowerCase() === 'go4sea')
              if (go4sea) {
                return { ...prev, supplier: go4sea.name }
              }

              // 4. Fallback al primo della lista se il corrente non è valido
              const isCurrentInList = data.some((s: any) => s.name === prev.supplier)
              if (!isCurrentInList) {
                return { ...prev, supplier: data[0].name }
              }
              
              return prev
            })
          }
        }
      } catch (e) {
        console.error("Failed to fetch suppliers", e)
      }
    }
    fetchSuppliers()
  }, [initialData, defaultSupplier])

  useEffect(() => {
    if (initialData) {
      const isStandard = NATIONALITIES.some(n => n.code === initialData.nationality)
      setFormData({
        firstName: initialData.firstName,
        lastName: initialData.lastName,
        nationality: isStandard ? initialData.nationality : 'OTHER',
        dateOfBirth: new Date(initialData.dateOfBirth).toISOString().split('T')[0],
        docNumber: initialData.docNumber,
        docType: initialData.docType,
        phoneNumber: initialData.phoneNumber,
        email: initialData.email || '',
        notes: initialData.notes || '',
        supplier: initialData.supplier,
        isOption: initialData.isOption,
        paymentType: initialData.paymentType,
        paymentMethod: initialData.paymentMethod,
        depositPaymentMethod: initialData.depositPaymentMethod || initialData.paymentMethod || 'CASH',
        balancePaymentMethod: initialData.balancePaymentMethod || '',
        groupSize: initialData.groupSize || 1,
        price: initialData.price || 0,
        deposit: initialData.deposit || 0,
        
        pickupLocation: initialData.pickupLocation || '',
        dropoffLocation: initialData.dropoffLocation || '',
        pickupTime: initialData.pickupTime || '',
        returnPickupLocation: initialData.returnPickupLocation || '',
        returnDate: initialData.returnDate ? new Date(initialData.returnDate).toISOString().split('T')[0] : '',
        returnTime: initialData.returnTime || '',
      })
      if (!isStandard) {
        setCustomNationality(initialData.nationality)
      } else {
        setCustomNationality('')
      }
    }
  }, [initialData])

  useEffect(() => {
    const deposit = parseFloat(String(formData.deposit)) || 0
    const price = parseFloat(String(formData.price)) || 0
    
    // Tolleranza per evitare errori di arrotondamento float
    if (deposit > price + 0.01) {
      setDepositError('L\'acconto non può essere superiore al prezzo totale.')
    } else {
      setDepositError('')
    }
  }, [formData.deposit, formData.price])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked

    if (name === 'nationality' && value !== 'OTHER') {
      setCustomNationality('')
    }

    setFormData((prev) => {
      const newData = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      }

      // Selezionato Opzione: azzera acconto
      if (name === 'isOption') {
        if (checked) {
          newData.deposit = 0
        } else if (prev.paymentType === 'BALANCE') {
          // Se deseleziono Opzione e sono in Saldo, ripristina prezzo pieno
          newData.deposit = parseFloat(String(prev.price)) || 0
        }
      }

      // Selezionato Saldo / Pagamento Completo: acconto = prezzo totale
      if (name === 'paymentType' && value === 'BALANCE') {
        newData.deposit = parseFloat(String(newData.price)) || 0
      }

      // Selezionato Contanti: imposta acconto = prezzo totale (solo se era Saldo)
      if (name === 'paymentMethod' && value === 'CASH' && prev.paymentType === 'BALANCE') {
        newData.deposit = parseFloat(String(newData.price)) || 0
      }

      // Se cambia il prezzo e siamo in Saldo, aggiorna acconto
      if (name === 'price' && prev.paymentType === 'BALANCE' && !prev.isOption) {
        newData.deposit = parseFloat(value) || 0
      }
      
      return newData
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!formData.firstName.trim()) {
      setError('Il nome del partecipante è obbligatorio.')
      setLoading(false)
      return
    }

    if (!formData.lastName.trim()) {
      setError('Il cognome del partecipante è obbligatorio.')
      setLoading(false)
      return
    }

    if (formData.groupSize < 1) {
      setError('Il numero di partecipanti deve essere almeno 1.')
      setLoading(false)
      return
    }

    const depositVal = parseFloat(String(formData.deposit)) || 0
    const priceVal = parseFloat(String(formData.price)) || 0

    if (depositVal > priceVal) {
      setError('L\'acconto non può essere superiore al prezzo totale.')
      setLoading(false)
      return
    }

    try {
      // Preparazione dati da inviare
      const payload: any = {
        ...formData,
        nationality: formData.nationality === 'OTHER' ? customNationality : formData.nationality,
        price: parseFloat(String(formData.price)) || 0,
        deposit: parseFloat(String(formData.deposit)) || 0,
        excursionId: type === 'EXCURSION' ? excursionId : undefined,
        transferId: type === 'TRANSFER' ? transferId : undefined,
        paymentMethod: formData.depositPaymentMethod, // Legacy sync
      }

      // Se c'è un'email, genera il PDF (sia per creazione che per modifica)
      if (formData.email) {
        const entityName = excursionName
        const entityDate = excursionDate

        // Se mancano i dati, logghiamo l'errore ma procediamo senza PDF
        if (!entityName || !entityDate) {
          console.error("Dati evento mancanti per generazione PDF", { entityName, entityDate });
          await sendData(payload);
          return;
        }

        const eventData = type === 'TRANSFER' ? {
            type: 'TRANSFER',
            name: entityName,
            date: entityDate,
            pickupLocation: formData.pickupLocation,
            dropoffLocation: formData.dropoffLocation,
            pickupTime: formData.pickupTime,
            returnDate: formData.returnDate,
            returnTime: formData.returnTime,
            returnPickupLocation: formData.returnPickupLocation
        } : {
            type: 'EXCURSION',
            name: entityName,
            date: entityDate
        }

        const doc = generateParticipantPDF(
          { 
            ...payload, 
            firstName: formData.firstName,
            lastName: formData.lastName
          }, 
          eventData as any
        )
        const pdfBlob = doc.output('blob')
        
        // Converti in Base64 per inviare via JSON
        const reader = new FileReader()
        reader.readAsDataURL(pdfBlob)
        reader.onloadend = async () => {
          const base64data = reader.result?.toString().split(',')[1]
          payload.pdfAttachment = base64data
          await sendData(payload)
        }
      } else {
        await sendData(payload)
      }
    } catch (error) {
      console.error('Submission error:', error)
      setError('Si è verificato un errore imprevisto. Riprova.')
    } finally {
      setLoading(false)
    }
  }

  const sendData = async (payload: any) => {
    try {
      const url = initialData 
        ? `/api/participants/${initialData.id}`
        : '/api/participants'
      
      const method = initialData ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      // Gestione della risposta (JSON vs Text)
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Errore durante il salvataggio')
      } else {
        // Se non è JSON, probabilmente è un errore del server o HTML di errore
        const text = await res.text()
        console.error("Non-JSON response:", text)
        throw new Error(`Errore del server: ${res.status} ${res.statusText}`)
      }

      onSuccess()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getPaymentSectionStyle = () => {
    if (formData.isOption) {
      return {
        container: "bg-red-50 border-red-200",
        header: "text-red-800",
        icon: "text-red-600"
      }
    }
    if (formData.paymentType === 'DEPOSIT') {
      return {
        container: "bg-orange-50 border-orange-200",
        header: "text-orange-800",
        icon: "text-orange-600"
      }
    }
    if (formData.paymentType === 'BALANCE') {
      return {
        container: "bg-green-50 border-green-200",
        header: "text-green-800",
        icon: "text-green-600"
      }
    }
    return {
      container: "bg-gray-50 border-gray-100",
      header: "text-gray-800",
        icon: "text-blue-600"
    }
  }

  const paymentStyle = getPaymentSectionStyle()

  const inputClassName = "w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-base md:text-sm text-gray-900 placeholder-gray-500"
  const labelClassName = "block text-xs font-bold text-gray-900 mb-1 uppercase tracking-wide"

  return (
    <div className="bg-white flex flex-col w-full h-full">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-4 flex justify-between items-center shrink-0">
        <h2 className="text-lg font-bold text-white flex items-center gap-3">
          <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
            {initialData ? <User className="w-5 h-5 sm:w-6 sm:h-6" /> : <UserPlus className="w-5 h-5 sm:w-6 sm:h-6" />}
          </div>
          <span className="truncate">{initialData ? 'Modifica Partecipante' : 'Nuovo Partecipante'}</span>
        </h2>
        <button 
          onClick={onCancel} 
          className="text-white/80 hover:text-white transition-colors bg-white/10 p-2 rounded-full hover:bg-white/20 backdrop-blur-sm"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="overflow-y-auto p-4 custom-scrollbar flex-1">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-full shrink-0">
              <X className="w-4 h-4" />
            </div>
            <span className="text-sm">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dati Partecipante */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
              <User className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-800">Dati Partecipante</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              <div>
                <label className={labelClassName}>Nome</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  className={inputClassName}
                  placeholder="Es. Mario"
                />
              </div>
              <div>
                <label className={labelClassName}>Cognome</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  className={inputClassName}
                  placeholder="Es. Rossi"
                />
              </div>

              <div>
                <label className={labelClassName}>Numero Persone</label>
                <div className="relative">
                  <input
                    type="number"
                    name="groupSize"
                    value={formData.groupSize}
                    onChange={handleChange}
                    min="1"
                    className={`${inputClassName} pl-10`}
                  />
                  <UserPlus className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div>
                <label className={labelClassName}>Nazionalità</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    name="nationality"
                    value={formData.nationality}
                    onChange={handleChange}
                    className={inputClassName}
                  >
                    {NATIONALITIES.map((n) => (
                      <option key={n.code} value={n.code}>
                        {n.code} - {n.name}
                      </option>
                    ))}
                  </select>
                  {formData.nationality === 'OTHER' && (
                    <input
                      type="text"
                      value={customNationality}
                      onChange={(e) => setCustomNationality(e.target.value)}
                      placeholder="Specifica..."
                      className={`${inputClassName} mt-2 sm:mt-0`}
                    />
                  )}
                </div>
              </div>

              <div>
                <label className={labelClassName}>Data di Nascita</label>
                <div className="relative">
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleChange}
                    className={inputClassName}
                  />
                </div>
              </div>

              <div>
                <label className={labelClassName}>Tipo Documento</label>
                <select
                  name="docType"
                  value={formData.docType}
                  onChange={handleChange}
                  className={inputClassName}
                >
                  <option value="ID_CARD">Carta d'Identità</option>
                  <option value="PASSPORT">Passaporto</option>
                  <option value="DRIVING_LICENSE">Patente</option>
                </select>
              </div>
              <div>
                <label className={labelClassName}>Numero Documento</label>
                <input
                  type="text"
                  name="docNumber"
                  value={formData.docNumber}
                  onChange={handleChange}
                  className={inputClassName}
                  placeholder="Numero documento"
                />
              </div>

              <div className="col-span-1 sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClassName}>Telefono</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="tel"
                      name="phoneNumber"
                      value={formData.phoneNumber}
                      onChange={handleChange}
                      className={`${inputClassName} pl-9`}
                      placeholder="+39 333 1234567"
                    />
                  </div>
                </div>
                
                <div>
                  <label className={labelClassName}>Email (per invio PDF)</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={inputClassName}
                    placeholder="email@esempio.com"
                  />
                </div>
              </div>

              <div>
                <label className={labelClassName}>Fornitore</label>
                <div className="relative">
                  <select
                    name="supplier"
                    value={formData.supplier}
                    onChange={handleChange}
                    className={`${inputClassName} pl-10`}
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                    {/* Mantieni il valore attuale se non è presente nella lista (es. vecchi record o lista vuota) */}
                    {formData.supplier && !suppliers.some(s => s.name === formData.supplier) && (
                      <option value={formData.supplier}>{formData.supplier}</option>
                    )}
                  </select>
                  <Briefcase className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {type === 'TRANSFER' && (
                <div className="col-span-1 sm:col-span-2 md:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-b border-gray-100 py-4 my-2">
                  <h4 className="sm:col-span-2 font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <MapIcon className="w-4 h-4" />
                    Dettagli Trasferimento
                  </h4>
                  
                  <div>
                    <label className={labelClassName}>Luogo Ritiro</label>
                    <input
                      type="text"
                      name="pickupLocation"
                      value={formData.pickupLocation}
                      onChange={handleChange}
                      className={inputClassName}
                      placeholder="Hotel, Aeroporto, ecc."
                    />
                  </div>
                  
                  <div>
                    <label className={labelClassName}>Ora Ritiro</label>
                    <input
                      type="time"
                      name="pickupTime"
                      value={formData.pickupTime}
                      onChange={handleChange}
                      className={inputClassName}
                    />
                  </div>

                  <div>
                    <label className={labelClassName}>Luogo Deposito (Opzionale)</label>
                    <input
                      type="text"
                      name="dropoffLocation"
                      value={formData.dropoffLocation}
                      onChange={handleChange}
                      className={inputClassName}
                    />
                  </div>

                  <div>
                    <label className={labelClassName}>Data Ritorno (Opzionale)</label>
                    <input
                      type="date"
                      name="returnDate"
                      value={formData.returnDate}
                      onChange={handleChange}
                      className={inputClassName}
                    />
                  </div>

                  {formData.returnDate && (
                    <>
                        <div>
                        <label className={labelClassName}>Ora Ritorno</label>
                        <input
                            type="time"
                            name="returnTime"
                            value={formData.returnTime}
                            onChange={handleChange}
                            className={inputClassName}
                        />
                        </div>
                        <div>
                        <label className={labelClassName}>Luogo Ritiro Ritorno</label>
                        <input
                            type="text"
                            name="returnPickupLocation"
                            value={formData.returnPickupLocation}
                            onChange={handleChange}
                            className={inputClassName}
                        />
                        </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Pagamento */}
          <div className="space-y-4">
            <div className={`flex items-center gap-2 pb-2 border-b ${paymentStyle.header.replace('text-', 'border-').replace('800', '200')}`}>
              <CreditCard className={`w-5 h-5 ${paymentStyle.icon}`} />
              <h3 className={`text-lg font-semibold ${paymentStyle.header}`}>Dettagli Pagamento</h3>
            </div>

            <div className={`p-4 sm:p-6 rounded-xl border transition-colors duration-300 ${paymentStyle.container}`}>
              <div className="mb-6 flex items-center">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="isOption"
                    checked={formData.isOption}
                    onChange={handleChange}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                  <span className={`ml-3 text-sm font-medium ${formData.isOption ? 'text-red-700 font-bold' : 'text-gray-700'}`}>
                    Opzione (Non pagato)
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                <div>
                  <label className={labelClassName}>Tipo Pagamento</label>
                  <select
                    name="paymentType"
                    value={formData.paymentType}
                    onChange={handleChange}
                    disabled={formData.isOption}
                    className={`${inputClassName} disabled:bg-gray-100 disabled:text-gray-400`}
                  >
                    <option value="DEPOSIT">Acconto</option>
                    <option value="BALANCE">Saldo (Pagato)</option>
                  </select>
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <label className={labelClassName}>Metodo Pagamento</label>
                  <div className="flex flex-col sm:flex-row gap-4">
                      <div className="flex-1">
                          <span className="text-[10px] text-gray-500 mb-1 block uppercase">
                              {formData.paymentType === 'BALANCE' ? 'Acconto / Unico' : 'Acconto'}
                          </span>
                          <select
                              name="depositPaymentMethod"
                              value={formData.depositPaymentMethod}
                              onChange={handleChange}
                              className={inputClassName}
                            >
                              <option value="CASH">Contanti</option>
                              <option value="CARD">Carta</option>
                              <option value="TRANSFER">Bonifico</option>
                          </select>
                      </div>

                      {formData.paymentType === 'BALANCE' && (
                          <div className="flex-1">
                              <span className="text-[10px] text-gray-500 mb-1 block uppercase">Saldo</span>
                              <select
                                  name="balancePaymentMethod"
                                  value={formData.balancePaymentMethod}
                                  onChange={handleChange}
                                  className={inputClassName}
                              >
                                  <option value="">-- Stesso --</option>
                                  <option value="CASH">Contanti</option>
                                  <option value="CARD">Carta</option>
                                  <option value="TRANSFER">Bonifico</option>
                              </select>
                          </div>
                      )}
                  </div>
                </div>

                <div>
                  <label className={labelClassName}>Prezzo Totale (€)</label>
                  <div className="relative">
                    <input
                      type="number"
                      name="price"
                      value={formData.price}
                      onChange={handleChange}
                      step="0.01"
                      min="0"
                      disabled={formData.isOption}
                      className={`${inputClassName} pl-8 font-mono disabled:bg-gray-100 disabled:text-gray-400`}
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                  </div>
                </div>
                <div>
                  <label className={labelClassName}>Acconto Versato (€)</label>
                  <div className="relative">
                    <input
                      type="number"
                      name="deposit"
                      value={formData.deposit}
                      onChange={handleChange}
                      step="0.01"
                      min="0"
                      disabled={formData.isOption || formData.paymentType === 'BALANCE'}
                      className={`${inputClassName} pl-8 font-mono disabled:bg-gray-100 disabled:text-gray-400 ${depositError ? 'border-red-500 focus:ring-red-500' : ''}`}
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                  </div>
                  {depositError && (
                    <p className="mt-1 text-sm text-red-600 font-medium animate-pulse">{depositError}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className={labelClassName}>Note Aggiuntive</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={2}
              className={inputClassName}
              placeholder="Inserisci eventuali note qui..."
            />
          </div>
        </form>
      </div>

      {/* Footer */}
      <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-col-reverse sm:flex-row justify-end gap-3 shrink-0 relative z-10">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none transition-all w-full sm:w-auto text-center"
        >
          Annulla
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="px-4 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none flex items-center justify-center gap-2 transition-all hover:shadow-md disabled:opacity-70 disabled:cursor-not-allowed w-full sm:w-auto"
        >
          {loading ? 'Salvataggio...' : (
            <>
              <Save className="w-4 h-4" />
              Salva Partecipante
            </>
          )}
        </button>
      </div>
    </div>
  )
}
