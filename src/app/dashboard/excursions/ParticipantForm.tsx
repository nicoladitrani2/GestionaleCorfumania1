'use client'

import { useState, useEffect } from 'react'
import { Save, X, User, Calendar, CreditCard, FileText, Phone, Globe, Briefcase, UserPlus, Map as MapIcon, Plus, Trash2, Home, RotateCcw, Baby } from 'lucide-react'
import { AlertModal } from '../components/AlertModal'

import { generateParticipantPDF } from '@/lib/pdf-generator'

interface ParticipantFormProps {
  onSuccess: () => void
  onCancel: () => void
  initialData?: any
  excursionId?: string
  transferId?: string
  excursionName?: string
  excursionDate?: string | Date
  excursionEndDate?: string | Date | null
  transferName?: string
  transferDate?: string | Date
  transferEndDate?: string | Date | null
  transferApprovalStatus?: string
  type?: 'EXCURSION' | 'TRANSFER' | 'RENTAL'
  defaultValues?: {
    pickupLocation?: string
    dropoffLocation?: string
    pickupTime?: string
    returnDate?: string
    returnTime?: string
    returnPickupLocation?: string
    returnDropoffLocation?: string
  }
  defaultSupplier?: string
  userRole?: string
  priceAdult?: number
  priceChild?: number
  userAgencyId?: string
  excursionTransferDepartureLocation?: string
  excursionTransferDestinationLocation?: string
  excursionTransferTime?: string
  agencyDefaultCommission?: number
  agencyCommissionType?: string
  maxParticipants?: number
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

const LICENSE_TYPES = [
  'AM', 'A1', 'A2', 'A', 
  'B1', 'B', 'BE', 
  'C1', 'C', 'C1E', 'CE', 
  'D1', 'D', 'D1E', 'DE',
  'Patente Nautica'
]

export function ParticipantForm({ 
  onSuccess, 
  onCancel, 
  initialData, 
  excursionId, 
  transferId,
  excursionName, 
  excursionDate,
  excursionEndDate,
  transferName,
  transferDate,
  transferApprovalStatus,
  type = 'EXCURSION',
  defaultValues,
  userRole,
  priceAdult = 0,
  priceChild = 0,
  userAgencyId,
  defaultSupplier,
  excursionTransferDepartureLocation,
  excursionTransferDestinationLocation,
  excursionTransferTime,
  agencyDefaultCommission = 0,
  agencyCommissionType = 'PERCENTAGE',
  maxParticipants
}: ParticipantFormProps) {
  const [adminUsers, setAdminUsers] = useState<{ id: string; firstName: string | null; lastName: string | null; email: string }[]>([])
  const [notifyAdminsEnabled, setNotifyAdminsEnabled] = useState(false)
  const [notifyAllAdmins, setNotifyAllAdmins] = useState(true)
  const [notifyAdminIds, setNotifyAdminIds] = useState<string[]>([])
  const [adminUsersLoading, setAdminUsersLoading] = useState(false)
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
    adults: 1,
    children: 0,
    infants: 0,
    price: 0,
    deposit: 0,
    tax: 0,
    commissionPercentage: 0,
    pickupLocation: defaultValues?.pickupLocation || '',
    dropoffLocation: defaultValues?.dropoffLocation || '',
    pickupTime: defaultValues?.pickupTime || '',
    returnPickupLocation: defaultValues?.returnPickupLocation || '',
    returnDropoffLocation: defaultValues?.returnDropoffLocation || '',
    returnDate: defaultValues?.returnDate || '',
    returnTime: defaultValues?.returnTime || '',
    rentalType: 'CAR',
    rentalStartDate: '',
    rentalEndDate: '',
    accommodation: '',
    needsTransfer: false,
    licenseType: initialData?.licenseType || '',
    insurancePrice: initialData?.insurancePrice || 0,
    supplementPrice: initialData?.supplementPrice || 0,
    assistantCommission: initialData?.assistantCommission ?? agencyDefaultCommission,
    assistantCommissionType: initialData?.assistantCommissionType || agencyCommissionType,
    agencyId: initialData?.agencyId || userAgencyId || ''
  })
  const [customNationality, setCustomNationality] = useState('')
  const [error, setError] = useState('')
  const [depositError, setDepositError] = useState('')
  const [rentalCostsError, setRentalCostsError] = useState('')
  const [loading, setLoading] = useState(false)
  const [suppliers, setSuppliers] = useState<{ id: string, name: string }[]>([])
  const [requestReturn, setRequestReturn] = useState(
    !!(initialData?.returnDate || defaultValues?.returnDate)
  )
  const [agencies, setAgencies] = useState<{ id: string, name: string, commissionType?: string, defaultCommission?: number }[]>([])
  const currentParticipantId = initialData?.id as string | undefined
  const [capacityInfo, setCapacityInfo] = useState<{ loading: boolean; activePax: number | null }>({
    loading: false,
    activePax: null
  })

  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    variant?: 'danger' | 'success' | 'info' | 'warning'
    onClose?: () => void
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'info'
  })

  useEffect(() => {
    const fetchAgencies = async () => {
      try {
        const res = await fetch('/api/agencies')
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data)) {
            setAgencies(data)
          }
        }
      } catch (e) {
        console.error('Failed to fetch agencies', e)
      }
    }
    fetchAgencies()
  }, [])

  useEffect(() => {
    const shouldCompute = !!(maxParticipants && maxParticipants > 0 && (excursionId || transferId))
    if (!shouldCompute) {
      setCapacityInfo({ loading: false, activePax: null })
      return
    }

    let cancelled = false

    const compute = async () => {
      setCapacityInfo(prev => ({ ...prev, loading: true }))
      try {
        const params = new URLSearchParams()
        if (excursionId) params.set('excursionId', excursionId)
        if (transferId) params.set('transferId', transferId)
        const res = await fetch(`/api/participants?${params.toString()}`)
        if (!res.ok) throw new Error('Fetch participants failed')
        const items = await res.json()
        const activePax = (items || []).reduce((sum: number, p: any) => {
          if (currentParticipantId && p?.id === currentParticipantId) return sum
          const isRejected = p?.approvalStatus === 'REJECTED' || p?.paymentStatus === 'REJECTED'
          const isRefunded = p?.paymentType === 'REFUNDED' || p?.status === 'REFUNDED'
          const isActive = !p?.status || p?.status === 'ACTIVE'
          const isExpired = !!p?.isExpired
          if (isRejected || isRefunded || !isActive || isExpired) return sum
          const pax = (p?.adults || 0) + (p?.children || 0) + (p?.infants || 0)
          return sum + (pax > 0 ? pax : 1)
        }, 0)

        if (!cancelled) {
          setCapacityInfo({ loading: false, activePax })
        }
      } catch (e) {
        if (!cancelled) {
          setCapacityInfo({ loading: false, activePax: null })
        }
      }
    }

    compute()
    return () => {
      cancelled = true
    }
  }, [maxParticipants, excursionId, transferId, currentParticipantId])

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const res = await fetch('/api/suppliers')
        if (res.ok) {
          const data = await res.json()
          
          // Ensure data is an array before setting state
          if (Array.isArray(data)) {
            setSuppliers(data)
            
            // Se stiamo creando un nuovo partecipante
            if (!initialData && data.length > 0) {
            setFormData(prev => {
              // 1. Se Assistant (o comunque c'è un defaultSupplier passato)
              if (defaultSupplier) {
                const match = data.find((s: any) => s?.name === defaultSupplier)
                if (match) return { ...prev, supplier: match.name }
              }

              // 2. Fallback a GO4SEA
              const go4sea = data.find((s: any) => s?.name?.toLowerCase() === 'go4sea')
              if (go4sea) {
                return { ...prev, supplier: go4sea.name }
              }

              // 3. Fallback al primo della lista se il corrente non è valido
              const isCurrentInList = data.some((s: any) => s?.name === prev.supplier)
              if (!isCurrentInList && data[0]?.name) {
                return { ...prev, supplier: data[0].name }
              }
              
              return prev
            })
          }
        }
      }
    } catch (e) {
        console.error("Failed to fetch suppliers", e)
      }
    }
    fetchSuppliers()
  }, [initialData, userRole, defaultSupplier])

  useEffect(() => {
    if (initialData) {
      const isStandard = NATIONALITIES.some(n => n.code === initialData.nationality)
      setFormData({
        firstName: initialData.firstName || '',
        lastName: initialData.lastName || '',
        nationality: isStandard ? initialData.nationality : 'OTHER',
        dateOfBirth: !isNaN(new Date(initialData.dateOfBirth).getTime()) 
          ? new Date(initialData.dateOfBirth).toISOString().split('T')[0] 
          : '',
        docNumber: initialData.docNumber || '',
        docType: initialData.docType || 'ID_CARD',
        phoneNumber: initialData.phoneNumber || '',
        email: initialData.email || '',
        notes: initialData.notes || '',
        supplier: initialData.supplier || 'GO4SEA',
        isOption: initialData.isOption,
        paymentType: initialData.paymentType,
        paymentMethod: initialData.paymentMethod,
        depositPaymentMethod: initialData.depositPaymentMethod || initialData.paymentMethod || 'CASH',
        balancePaymentMethod: initialData.balancePaymentMethod || '',
        adults: initialData.adults ?? 1,
        children: initialData.children || 0,
        infants: initialData.infants || 0,
        price: initialData.price || 0,
        deposit: initialData.deposit || 0,
        tax: initialData.tax || 0,
        
        pickupLocation: initialData.pickupLocation || '',
        dropoffLocation: initialData.dropoffLocation || '',
        pickupTime: initialData.pickupTime || '',
        returnPickupLocation: initialData.returnPickupLocation || '',
        returnDropoffLocation: initialData.returnDropoffLocation || '',
        returnDate: initialData.returnDate ? new Date(initialData.returnDate).toISOString().split('T')[0] : '',
        returnTime: initialData.returnTime || '',
        
        rentalType: initialData.rentalType === 'CAR_GROSS' ? 'MOTO' : (initialData.rentalType || 'CAR'),
        rentalStartDate: initialData.rentalStartDate ? new Date(initialData.rentalStartDate).toISOString().split('T')[0] : '',
        rentalEndDate: initialData.rentalEndDate ? new Date(initialData.rentalEndDate).toISOString().split('T')[0] : '',
        accommodation: initialData.accommodation || '',
        needsTransfer: (initialData as any).needsTransfer || false,
        licenseType: (initialData as any).licenseType || '',
        insurancePrice: (initialData as any).insurancePrice || 0,
        supplementPrice: (initialData as any).supplementPrice || 0,
        commissionPercentage: (initialData as any).commissionPercentage || 0,
        assistantCommission: (initialData as any).assistantCommission || 0,
        assistantCommissionType: (initialData as any).assistantCommissionType || 'PERCENTAGE',
        agencyId: (initialData as any).agencyId || userAgencyId || ''
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

    // Depositi abilitati per Escursioni/Trasferimenti e per Noleggio Auto.
    // Per Moto/Barca il flusso rimane senza acconto (Brokerage).
  }, [formData.deposit, formData.price, formData.isOption, formData.paymentType, type, (formData as any).rentalType])

  useEffect(() => {
    if (type !== 'RENTAL') {
      setRentalCostsError('')
      return
    }
    if ((formData as any).rentalType !== 'CAR') {
      setRentalCostsError('')
      return
    }

    const price = parseFloat(String(formData.price)) || 0
    const tax = parseFloat(String((formData as any).tax)) || 0
    const insurance = parseFloat(String((formData as any).insurancePrice)) || 0
    const supplement = parseFloat(String((formData as any).supplementPrice)) || 0
    const excludedCosts = Math.max(0, tax) + Math.max(0, insurance) + Math.max(0, supplement)

    if (excludedCosts > price + 0.01) {
      setRentalCostsError('Tasse + assicurazione + supplementi non possono superare il prezzo totale.')
    } else {
      setRentalCostsError('')
    }
  }, [type, (formData as any).rentalType, formData.price, (formData as any).tax, (formData as any).insurancePrice, (formData as any).supplementPrice])

  useEffect(() => {
    if (type !== 'RENTAL') return
    setFormData(prev => {
      const price = Number(prev.price || 0)
      const rentalType = String((prev as any).rentalType || '')
      const isCar = rentalType === 'CAR'
      const tax = parseFloat(String((prev as any).tax)) || 0
      const insurance = parseFloat(String((prev as any).insurancePrice)) || 0
      const supplement = parseFloat(String((prev as any).supplementPrice)) || 0
      const excludedCosts = isCar ? Math.max(0, tax) + Math.max(0, insurance) + Math.max(0, supplement) : 0
      const commissionBase = isCar ? Math.max(0, price - excludedCosts) : Math.max(0, price)
      const deposit = commissionBase * 0.2
      const roundedDeposit = Math.round(deposit * 100) / 100
      if (prev.paymentType === 'BALANCE' && Math.abs(Number(prev.deposit || 0) - roundedDeposit) < 0.01) return prev
      return {
        ...prev,
        paymentType: 'BALANCE',
        deposit: roundedDeposit,
      }
    })
  }, [type, formData.price, (formData as any).rentalType, (formData as any).tax, (formData as any).insurancePrice, (formData as any).supplementPrice])

  useEffect(() => {
    if (!initialData && (type === 'EXCURSION' || type === 'TRANSFER') && (priceAdult > 0 || priceChild > 0)) {
      setFormData(prev => {
        if (prev.price === 0) {
          const newPrice = (prev.adults * priceAdult) + (prev.children * priceChild)
          return { 
            ...prev, 
            price: newPrice,
            deposit: prev.paymentType === 'BALANCE' ? newPrice : prev.deposit
          }
        }
        return prev
      })
    }
  }, [initialData, type, priceAdult, priceChild])

  const handleCounterChange = (field: 'adults' | 'children' | 'infants', value: number) => {
    setFormData(prev => {
        const adults = field === 'adults' ? value : prev.adults
        const children = field === 'children' ? value : prev.children
        const infants = field === 'infants' ? value : prev.infants
        let newPrice = prev.price
        
        if ((type === 'EXCURSION' || type === 'TRANSFER') && (priceAdult > 0 || priceChild > 0)) {
            newPrice = (adults * priceAdult) + (children * priceChild)
        }

        return {
            ...prev,
            [field]: value,
            price: newPrice,
            deposit: prev.paymentType === 'BALANCE' ? newPrice : prev.deposit
        }
    })
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked

    if (name === 'nationality' && value !== 'OTHER') {
      setCustomNationality('')
    }

    if (name === 'adults' || name === 'children' || name === 'infants') {
        // Handled by handleCounterChange, but if it comes from input (not counter), we need to handle it.
        // We will use custom counters in UI, so this might not be reached for adults/children if we use separate handler.
        // But let's keep it safe.
        const val = parseInt(value) || 0
        handleCounterChange(name as 'adults' | 'children' | 'infants', val)
        return
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

      // Handle needsTransfer logic
      if (name === 'needsTransfer' && checked) {
           if (!newData.pickupLocation && excursionTransferDepartureLocation) {
               newData.pickupLocation = excursionTransferDepartureLocation
           }
           if (!newData.dropoffLocation && excursionTransferDestinationLocation) {
               newData.dropoffLocation = excursionTransferDestinationLocation
           }
           if (!newData.pickupTime && excursionTransferTime) {
               newData.pickupTime = excursionTransferTime
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

    try {
      if (maxParticipants && maxParticipants > 0 && (excursionId || transferId)) {
        const params = new URLSearchParams()
        if (excursionId) params.set('excursionId', excursionId)
        if (transferId) params.set('transferId', transferId)
        const res = await fetch(`/api/participants?${params.toString()}`)
        if (res.ok) {
          const items = await res.json()
          const activeCount = items.reduce((sum: number, p: any) => {
            if (currentParticipantId && p?.id === currentParticipantId) return sum
            const isRejected = p.approvalStatus === 'REJECTED' || p.paymentStatus === 'REJECTED'
            const isRefunded = p.paymentType === 'REFUNDED'
            const isActive = !p.status || p.status === 'ACTIVE'
            if (isRejected || isRefunded || !isActive) return sum
            const pax = (p.adults || 0) + (p.children || 0) + (p.infants || 0)
            return sum + (pax > 0 ? pax : 1)
          }, 0)
          const newPax = (formData.adults || 0) + (formData.children || 0) + (formData.infants || 0)
          if (activeCount + (newPax || 1) > maxParticipants) {
            setLoading(false)
            setError(`Numero massimo di partecipanti raggiunto (${maxParticipants}).`)
            return
          }
        }
      }
    } catch (preErr) {
      console.error('Pre-check max participants failed:', preErr)
      // Fallback: continue, backend will enforce
    }

    // Transfer requirements for excursions
    if (type === 'EXCURSION' && (formData as any).needsTransfer) {
      const changedPickup = excursionTransferDepartureLocation && formData.pickupLocation && formData.pickupLocation.trim() !== excursionTransferDepartureLocation.trim()
      const changedDropoff = excursionTransferDestinationLocation && formData.dropoffLocation && formData.dropoffLocation.trim() !== excursionTransferDestinationLocation.trim()
      if ((changedPickup || changedDropoff) && !formData.pickupTime) {
        setError('Per il trasferimento con partenza/destinazione modificata è obbligatorio indicare l\'orario di partenza.')
        setLoading(false)
        return
      }
    }

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

    if (((type === 'EXCURSION') ? (formData.adults + formData.children) : (formData.adults + formData.children + formData.infants)) < 1) {
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

    if (type === 'RENTAL' && (formData as any).rentalType === 'CAR') {
      const taxVal = parseFloat(String((formData as any).tax)) || 0
      const insuranceVal = parseFloat(String((formData as any).insurancePrice)) || 0
      const supplementVal = parseFloat(String((formData as any).supplementPrice)) || 0
      const excludedCosts = Math.max(0, taxVal) + Math.max(0, insuranceVal) + Math.max(0, supplementVal)
      if (excludedCosts > priceVal + 0.01) {
        setError('Tasse + assicurazione + supplementi non possono superare il prezzo totale.')
        setLoading(false)
        return
      }
    }

    // Validation for Boat Rentals
    if (type === 'RENTAL' && (formData as any).rentalType === 'BOAT' && !formData.supplier) {
      setError('Il fornitore è obbligatorio per il noleggio barche.')
      setLoading(false)
      return
    }

    const isManaged =
      type !== 'RENTAL' ||
      ['CAR', 'MOTO', 'BOAT'].includes(String((formData as any).rentalType || ''))

    try {
      // Preparazione dati da inviare
      const rentalType = String((formData as any).rentalType || '')
      const isCarRental = type === 'RENTAL' && rentalType === 'CAR'
      const excludedCostsForCar = isCarRental ? (() => {
        const taxVal = parseFloat(String((formData as any).tax)) || 0
        const insuranceVal = parseFloat(String((formData as any).insurancePrice)) || 0
        const supplementVal = parseFloat(String((formData as any).supplementPrice)) || 0
        return Math.max(0, taxVal) + Math.max(0, insuranceVal) + Math.max(0, supplementVal)
      })() : 0
      const commissionBase = isCarRental ? Math.max(0, priceVal - excludedCostsForCar) : Math.max(0, priceVal)
      const depositAmount = type === 'RENTAL' ? (commissionBase * 0.2) : (isManaged ? (parseFloat(String(formData.deposit)) || 0) : 0)
      const payload: any = {
        ...formData,
        nationality: formData.nationality === 'OTHER' ? customNationality : formData.nationality,
        price: parseFloat(String(formData.price)) || 0,
        deposit: Math.round(Math.max(0, depositAmount) * 100) / 100,
        tax: type === 'RENTAL' && (formData as any).rentalType === 'CAR' ? (parseFloat(String((formData as any).tax)) || 0) : 0,
        commissionPercentage: type === 'RENTAL' ? 0 : (parseFloat(String(formData.commissionPercentage)) || 0),
        adults: formData.adults,
        children: formData.children,
        infants: formData.infants,
        excursionId: type === 'EXCURSION' ? excursionId : undefined,
        transferId: type === 'TRANSFER' ? transferId : undefined,
        isRental: type === 'RENTAL',
        rentalType: type === 'RENTAL' ? (formData as any).rentalType : undefined,
        rentalStartDate: type === 'RENTAL' ? (formData as any).rentalStartDate : undefined,
        rentalEndDate: type === 'RENTAL' ? (formData as any).rentalEndDate : undefined,
        licenseType: type === 'RENTAL' ? (formData as any).licenseType : undefined,
        assignedToId: type === 'RENTAL' ? null : undefined,
        insurancePrice: type === 'RENTAL' && (formData as any).rentalType === 'CAR' ? (parseFloat(String((formData as any).insurancePrice)) || 0) : 0,
        supplementPrice: type === 'RENTAL' && (formData as any).rentalType === 'CAR' ? (parseFloat(String((formData as any).supplementPrice)) || 0) : 0,
        assistantCommission: type === 'RENTAL' ? 0 : 0,
        assistantCommissionType: type === 'RENTAL' ? null : 'PERCENTAGE',
        paymentMethod: formData.depositPaymentMethod, // Legacy sync
        depositPaymentMethod: formData.depositPaymentMethod,
        balancePaymentMethod: formData.balancePaymentMethod,
      }

      // Se c'è un'email, genera il PDF (sia per creazione che per modifica)
      if (formData.email) {
        let entityName = excursionName
        let entityDate = excursionDate

        if (type === 'TRANSFER') {
            entityName = transferName
            entityDate = transferDate
        } else if (type === 'RENTAL') {
             const rentalTypeMap: Record<string, string> = {
                 'CAR': 'Auto',
                 'MOTO': 'Moto',
                 'BOAT': 'Barca'
             }
             const typeLabel = rentalTypeMap[(formData as any).rentalType] || (formData as any).rentalType
             entityName = `Noleggio ${typeLabel}`
             entityDate = (formData as any).rentalStartDate
        }

        if (!entityName || !entityDate) {
          await sendData(payload);
          return;
        }

        let eventData: any;

        if (type === 'TRANSFER') {
            const pendingApproval = transferApprovalStatus ? transferApprovalStatus !== 'APPROVED' : false
            eventData = {
                type: 'TRANSFER',
                name: entityName,
                date: entityDate,
                pickupLocation: formData.pickupLocation,
                dropoffLocation: formData.dropoffLocation,
                pickupTime: formData.pickupTime,
                returnDate: formData.returnDate,
                returnTime: formData.returnTime,
                returnPickupLocation: formData.returnPickupLocation,
                pendingApproval
            }
        } else if (type === 'RENTAL') {
             eventData = {
                type: 'RENTAL',
                name: entityName,
                date: entityDate,
                pickupLocation: formData.pickupLocation,
                dropoffLocation: formData.dropoffLocation
             }
        } else {
            eventData = {
                type: 'EXCURSION',
                name: entityName,
                date: entityDate
            }
        }

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

        // Generate Italian PDF
        const docIT = generateParticipantPDF(
          { 
            ...payload, 
            firstName: formData.firstName,
            lastName: formData.lastName
          }, 
          eventData as any,
          'it'
        )
        const pdfBlobIT = docIT.output('blob')
        const base64IT = await blobToBase64(pdfBlobIT)

        // Generate English PDF
        const docEN = generateParticipantPDF(
          { 
            ...payload, 
            firstName: formData.firstName,
            lastName: formData.lastName
          }, 
          eventData as any,
          'en'
        )
        const pdfBlobEN = docEN.output('blob')
        const base64EN = await blobToBase64(pdfBlobEN)

        payload.pdfAttachmentIT = base64IT
        payload.pdfAttachmentEN = base64EN
        
        if (notifyAdminsEnabled && canNotifyAdmins) {
          const ids = notifyAllAdmins ? adminUsers.map(a => a.id) : notifyAdminIds
          if (ids.length > 0) {
            payload.notifyAdminUserIds = ids
          }
        }
        await sendData(payload)
      } else {
        if (notifyAdminsEnabled && canNotifyAdmins) {
          const ids = notifyAllAdmins ? adminUsers.map(a => a.id) : notifyAdminIds
          if (ids.length > 0) {
            payload.notifyAdminUserIds = ids
          }
        }
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
        
        // Check for pending approval
        if (data.approvalStatus === 'PENDING') {
            setAlertModal({
              isOpen: true,
              title: 'Approvazione richiesta',
              message: 'Il partecipante è stato salvato come BOZZA perché richiede approvazione dell\'amministratore.',
              variant: 'warning'
            })
        }
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
  const peopleGridClass = "grid grid-cols-2 gap-4"

  const isManaged =
    type !== 'RENTAL' ||
    ['CAR', 'MOTO', 'BOAT'].includes(String((formData as any).rentalType || ''))
  const allowDeposit = type !== 'RENTAL'
  const isBoat = type === 'RENTAL' && (formData as any).rentalType === 'BOAT'
  const isRental = type === 'RENTAL'

  const rentalType = isRental ? String((formData as any).rentalType || '') : ''
  const isRentalCar = isRental && rentalType === 'CAR'
  const rentalGross = parseFloat(String(formData.price)) || 0
  const rentalTax = parseFloat(String((formData as any).tax)) || 0
  const rentalInsurance = parseFloat(String((formData as any).insurancePrice)) || 0
  const rentalSupplement = parseFloat(String((formData as any).supplementPrice)) || 0
  const rentalExcludedCosts = isRentalCar ? Math.max(0, rentalTax) + Math.max(0, rentalInsurance) + Math.max(0, rentalSupplement) : 0
  const rentalCommissionBase = isRentalCar ? Math.max(0, rentalGross - rentalExcludedCosts) : Math.max(0, rentalGross)
  const rentalAgentShare = rentalCommissionBase * 0.05
  const selectedPax = (formData.adults || 0) + (formData.children || 0) + (formData.infants || 0)
  const expectedPrice =
    (type === 'EXCURSION' || type === 'TRANSFER')
      ? ((formData.adults || 0) * (priceAdult || 0)) + ((formData.children || 0) * (priceChild || 0))
      : 0
  const baselinePrice =
    expectedPrice > 0
      ? expectedPrice
      : (typeof (initialData as any)?.originalPrice === 'number'
          ? (initialData as any).originalPrice
          : (typeof (initialData as any)?.totalPrice === 'number' ? (initialData as any).totalPrice : 0))
  const priceNeedsApproval =
    (type === 'EXCURSION' || type === 'TRANSFER') &&
    baselinePrice > 0 &&
    Math.abs((Number(formData.price) || 0) - baselinePrice) > 0.01
  const transferNeedsApproval = type === 'TRANSFER' && !!transferApprovalStatus && transferApprovalStatus !== 'APPROVED'
  const mayNeedApproval = (userRole || '') !== 'ADMIN' && (priceNeedsApproval || transferNeedsApproval)
  const canNotifyAdmins =
    (userRole || '') !== 'ADMIN' && (type === 'EXCURSION' || type === 'TRANSFER') && !formData.isOption

  useEffect(() => {
    if (!canNotifyAdmins || !notifyAdminsEnabled) return
    let cancelled = false
    const loadAdmins = async () => {
      try {
        setAdminUsersLoading(true)
        const res = await fetch('/api/users/admins')
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && Array.isArray(data)) {
          setAdminUsers(data)
          setNotifyAdminIds(data.map((a: any) => String(a.id)))
        }
      } catch {
      } finally {
        if (!cancelled) setAdminUsersLoading(false)
      }
    }
    loadAdmins()
    return () => {
      cancelled = true
    }
  }, [canNotifyAdmins, notifyAdminsEnabled])
  const showCapacity = !!(maxParticipants && maxParticipants > 0 && (excursionId || transferId))
  const remainingNow =
    showCapacity && typeof capacityInfo.activePax === 'number'
      ? maxParticipants - capacityInfo.activePax
      : null
  const remainingAfter =
    showCapacity && typeof capacityInfo.activePax === 'number'
      ? maxParticipants - (capacityInfo.activePax + (selectedPax > 0 ? selectedPax : 1))
      : null

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
          {/* Dati Noleggio */}
          {type === 'RENTAL' && (
            <div className="space-y-4">
               <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                  <Briefcase className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-800">Dati Noleggio</h3>
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                 <div>
                    <label className={labelClassName}>Tipo Mezzo</label>
                    <select
                      name="rentalType"
                      value={(formData as any).rentalType}
                      onChange={handleChange}
                      className={inputClassName}
                    >
                      <option value="CAR">Auto</option>
                      <option value="MOTO">Moto</option>
                      <option value="BOAT">Barca</option>
                    </select>
                 </div>
                 
                 <div>
                    <label className={labelClassName}>Patente</label>
                    <select
                        name="licenseType"
                        value={(formData as any).licenseType}
                        onChange={handleChange}
                        className={inputClassName}
                    >
                        <option value="">-- Seleziona --</option>
                        {LICENSE_TYPES.map(l => (
                            <option key={l} value={l}>{l}</option>
                        ))}
                    </select>
                 </div>
                 
                 <div>
                    <label className={labelClassName}>Data Inizio</label>
                    <input
                      type="date"
                      name="rentalStartDate"
                      value={(formData as any).rentalStartDate}
                      onChange={handleChange}
                      className={inputClassName}
                      required
                    />
                 </div>
                 <div>
                    <label className={labelClassName}>Data Fine</label>
                    <input
                      type="date"
                      name="rentalEndDate"
                      value={(formData as any).rentalEndDate}
                      onChange={handleChange}
                      className={inputClassName}
                      required
                    />
                 </div>
               </div>
               
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <label className={labelClassName}>Luogo Consegna (Inizio)</label>
                    <input
                      type="text"
                      name="pickupLocation"
                      value={formData.pickupLocation}
                      onChange={handleChange}
                      className={inputClassName}
                      placeholder="Luogo consegna (agenzia -> cliente)"
                    />
                  </div>
                  <div>
                    <label className={labelClassName}>Luogo Ritiro (Fine)</label>
                    <input
                      type="text"
                      name="dropoffLocation"
                      value={formData.dropoffLocation}
                      onChange={handleChange}
                      className={inputClassName}
                      placeholder="Luogo ritiro (cliente -> agenzia)"
                    />
                  </div>
               </div>
            </div>
          )}

          {/* Dati Partecipante */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
              <User className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-800">Dati Partecipante</h3>
            </div>

          {showCapacity && (
            <div
              className={`p-4 rounded-xl border ${
                typeof remainingAfter === 'number' && remainingAfter < 0
                  ? 'bg-red-50 border-red-200'
                  : 'bg-blue-50 border-blue-200'
              }`}
            >
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <div className="font-semibold text-gray-900">
                  Posti massimi: <span className="font-bold">{maxParticipants}</span>
                </div>
                <div className="text-gray-800">
                  Occupati: <span className="font-bold">{capacityInfo.loading ? '...' : (capacityInfo.activePax ?? '-')}</span>
                </div>
                <div className="text-gray-800">
                  Disponibili: <span className="font-bold">{capacityInfo.loading ? '...' : (typeof remainingNow === 'number' ? Math.max(remainingNow, 0) : '-')}</span>
                </div>
                <div className={`${typeof remainingAfter === 'number' && remainingAfter < 0 ? 'text-red-700' : 'text-gray-800'}`}>
                  Dopo questo inserimento: <span className="font-bold">{capacityInfo.loading ? '...' : (typeof remainingAfter === 'number' ? remainingAfter : '-')}</span>
                </div>
              </div>
            </div>
          )}

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

              <div className={peopleGridClass}>
                <div>
                    <label className={labelClassName}>Adulti</label>
                    <div className="relative">
                      <input
                        type="number"
                        name="adults"
                        value={formData.adults}
                        onChange={(e) => handleCounterChange('adults', parseInt(e.target.value) || 0)}
                        min="1"
                        className={`${inputClassName} pl-8`}
                      />
                      <User className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    </div>
                </div>
                <div>
                    <label className={labelClassName}>Bambini</label>
                    <div className="relative">
                      <input
                        type="number"
                        name="children"
                        value={formData.children}
                        onChange={(e) => handleCounterChange('children', parseInt(e.target.value) || 0)}
                        min="0"
                        className={`${inputClassName} pl-8`}
                      />
                      <UserPlus className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    </div>
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



              <div>
                <label className={labelClassName}>Struttura / Hotel</label>
                <div className="relative">
                  <input
                    type="text"
                    name="accommodation"
                    value={formData.accommodation}
                    onChange={handleChange}
                    className={`${inputClassName} pl-9`}
                    placeholder="Nome struttura o hotel"
                  />
                  <Home className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {type === 'EXCURSION' && (
                <div className="col-span-1 sm:col-span-2 md:col-span-4 bg-gray-50 p-4 rounded-lg border border-gray-200 mt-2">
                   <div className="flex items-center gap-2 mb-4">
                      <input
                        type="checkbox"
                        id="needsTransfer"
                        name="needsTransfer"
                        checked={(formData as any).needsTransfer}
                        onChange={handleChange}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <label htmlFor="needsTransfer" className="text-sm font-bold text-gray-900 cursor-pointer select-none flex items-center gap-2">
                        <span className="bg-blue-100 text-blue-700 p-1 rounded text-xs">🚌</span> Richiede Trasferimento
                      </label>
                   </div>
                   
                   {(formData as any).needsTransfer && (
                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in slide-in-from-top-2 duration-200">
                        <div>
                          <label className={labelClassName}>Partenza (Pickup)</label>
                          <input
                            type="text"
                            name="pickupLocation"
                            value={formData.pickupLocation}
                            onChange={handleChange}
                            className={inputClassName}
                            placeholder="Luogo di ritrovo"
                          />
                        </div>
                        <div>
                          <label className={labelClassName}>Destinazione (Dropoff)</label>
                          <input
                            type="text"
                            name="dropoffLocation"
                            value={formData.dropoffLocation}
                            onChange={handleChange}
                            className={inputClassName}
                            placeholder="Destinazione"
                          />
                        </div>
                        <div>
                          <label className={labelClassName}>Ora Partenza</label>
                          <input
                            type="time"
                            name="pickupTime"
                            value={formData.pickupTime}
                            onChange={handleChange}
                            className={inputClassName}
                          />
                        </div>
                     </div>
                   )}
                </div>
              )}

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
                
                <div>
                  <label className={labelClassName}>Agenzia</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Briefcase className="h-4 w-4 text-gray-400" />
                    </div>
                    <select
                      name="agencyId"
                      value={formData.agencyId}
                      onChange={handleChange}
                      className={`${inputClassName} pl-9`}
                    >
                      <option value="">Seleziona Agenzia</option>
                      {agencies.map((agency) => (
                        <option key={agency.id} value={agency.id}>
                          {agency.name}
                        </option>
                      ))}
                    </select>
                  </div>
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
                    {suppliers && suppliers.length > 0 && suppliers.map((s) => (
                      s ? <option key={s.id || s.name} value={s.name}>{s.name}</option> : null
                    ))}
                    {/* Mantieni il valore attuale se non è presente nella lista (es. vecchi record o lista vuota) */}
          {formData.supplier && !suppliers.some(s => s?.name === formData.supplier) && (
            <option value={formData.supplier}>{formData.supplier}</option>
          )}
                  </select>
                  <Briefcase className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {type === 'TRANSFER' && (
                <div className="col-span-1 sm:col-span-2 md:col-span-4 space-y-6 border-t border-b border-gray-100 py-6 my-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-gray-800">
                      <MapIcon className="w-5 h-5 text-blue-600" />
                      <h4 className="font-semibold text-lg">Dettagli Trasferimento</h4>
                    </div>
                     {/* Commission Badge */}
                     {(() => {
                        const displayValue = (formData as any).commissionPercentage;
                        if (displayValue > 0) {
                            let displayType = '%';
                            if (userAgencyId) {
                                 const agency = agencies.find(a => a.id === userAgencyId);
                                 if (agency && agency.commissionType === 'FIXED') displayType = '€';
                            } else if (userRole === 'ADMIN') {
                                 const agency = agencies.find(a => a.name.toLowerCase().includes('corfumania') || a.name.toLowerCase().includes('amministrazione'));
                                 if (agency && agency.commissionType === 'FIXED') displayType = '€';
                            }
                            return (
                                <div className="flex items-center gap-2 bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-100 shadow-sm">
                                    <Briefcase className="w-3.5 h-3.5 text-purple-600" />
                                    <span className="text-xs font-bold text-purple-700 uppercase">Comm.</span>
                                    <span className="font-bold text-purple-900">{displayValue} {displayType}</span>
                                </div>
                            )
                        }
                        return null;
                    })()}
                  </div>
                  
                  {/* Info Trasferimento (Editable) */}
                  <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 mb-6 text-blue-900">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className={labelClassName}>Partenza</label>
                            <input
                                type="text"
                                name="pickupLocation"
                                value={formData.pickupLocation}
                                onChange={handleChange}
                                className={inputClassName}
                                placeholder="Luogo di partenza"
                            />
                        </div>
                        <div>
                            <label className={labelClassName}>Destinazione</label>
                            <input
                                type="text"
                                name="dropoffLocation"
                                value={formData.dropoffLocation}
                                onChange={handleChange}
                                className={inputClassName}
                                placeholder="Luogo di destinazione"
                            />
                        </div>
                        <div>
                            <label className={labelClassName}>Ora Partenza</label>
                            <input
                                type="time"
                                name="pickupTime"
                                value={formData.pickupTime}
                                onChange={handleChange}
                                className={inputClassName}
                            />
                        </div>
                        {/* Display Date (Read Only or Editable? Keeping Read Only for now as date is event-bound usually) */}
                        {transferDate && (
                            <div className="space-y-1">
                                <span className="text-blue-600 uppercase text-xs font-bold block">Data Trasferimento</span>
                                <div className="font-medium flex items-center gap-2 h-[42px]">
                                  <Calendar className="w-4 h-4 text-blue-500" />
                                  {new Date(transferDate).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                                </div>
                            </div>
                        )}
                    </div>
                  </div>

                  {/* Ritorno details */}
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <div className="flex items-center gap-2 mb-4">
                      <input
                        type="checkbox"
                        id="requestReturn"
                        checked={requestReturn}
                        onChange={(e) => {
                          const isChecked = e.target.checked
                          setRequestReturn(isChecked)
                          if (isChecked) {
                            // Auto-fill return details by swapping outbound locations
                            setFormData(prev => ({
                              ...prev,
                              returnPickupLocation: prev.returnPickupLocation || prev.dropoffLocation,
                              returnDropoffLocation: prev.returnDropoffLocation || prev.pickupLocation,
                              // If transferDate is set, maybe suggest same day or next? 
                              // Keeping date empty to force selection is safer, or same date.
                              returnDate: prev.returnDate || (transferDate ? new Date(transferDate).toISOString().split('T')[0] : '')
                            }))
                          } else {
                            // Clear return details? Maybe keep them in case of accidental toggle.
                            // But usually clearing is better to indicate "no return".
                            // Let's keep them in state but they won't be submitted if we filter them, 
                            // OR we just rely on requestReturn to show/hide and let backend handle empty strings.
                            // Ideally we should clear them if they are not needed.
                            setFormData(prev => ({
                              ...prev,
                              returnPickupLocation: '',
                              returnDropoffLocation: '',
                              returnDate: '',
                              returnTime: ''
                            }))
                          }
                        }}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <label htmlFor="requestReturn" className="text-sm font-bold text-gray-900 cursor-pointer select-none flex items-center gap-2">
                        <RotateCcw className="w-4 h-4 text-blue-600" />
                        Richiedi Ritorno
                      </label>
                    </div>

                    {requestReturn && (
                      <div className="bg-purple-50/50 p-4 rounded-lg border border-purple-100 mb-6 text-purple-900 animate-in slide-in-from-top-2 duration-200">
                        <h5 className="font-semibold text-sm mb-3 text-purple-800 flex items-center gap-2">
                           Dettagli Ritorno
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClassName}>Partenza Ritorno</label>
                                <input
                                    type="text"
                                    name="returnPickupLocation"
                                    value={formData.returnPickupLocation}
                                    onChange={handleChange}
                                    className={inputClassName}
                                    placeholder="Luogo di partenza ritorno"
                                />
                            </div>
                            <div>
                                <label className={labelClassName}>Destinazione Ritorno</label>
                                <input
                                    type="text"
                                    name="returnDropoffLocation"
                                    value={formData.returnDropoffLocation}
                                    onChange={handleChange}
                                    className={inputClassName}
                                    placeholder="Luogo di destinazione ritorno"
                                />
                            </div>
                            <div>
                                <label className={labelClassName}>Data Ritorno</label>
                                <input
                                    type="date"
                                    name="returnDate"
                                    value={formData.returnDate}
                                    onChange={handleChange}
                                    className={inputClassName}
                                />
                            </div>
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
                        </div>
                      </div>
                    )}
                  </div>
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
              
              {isManaged ? (
                // MANAGED FLOW (Existing Logic)
                <>
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
                    {allowDeposit && (
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
                    )}

                    {(type !== 'RENTAL' || rentalType === 'BOAT') && (
                      <div className="col-span-1 sm:col-span-2">
                          <label className={labelClassName}>Metodo Pagamento</label>
                          <div className="flex flex-col sm:flex-row gap-4">
                              <div className="flex-1">
                                  <span className="text-[10px] text-gray-500 mb-1 block uppercase">
                                      {type === 'RENTAL' ? 'Commissione (20%)' : (allowDeposit && formData.paymentType === 'BALANCE' ? 'Acconto / Unico' : (allowDeposit ? 'Acconto' : 'Pagamento'))}
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

                              {type !== 'RENTAL' && allowDeposit && formData.paymentType === 'BALANCE' && (
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
                    )}

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

                    {canNotifyAdmins && (
                      <div className="col-span-1 sm:col-span-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={notifyAdminsEnabled}
                            onChange={e => setNotifyAdminsEnabled(e.target.checked)}
                            className="h-4 w-4"
                          />
                          <span className="text-sm font-semibold text-gray-800">Notifica admin per approvazione (opzionale)</span>
                        </div>

                        {notifyAdminsEnabled && (
                          <div className="mt-3 border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-3">
                            {adminUsersLoading && (
                              <div className="text-sm text-gray-600">Caricamento admin...</div>
                            )}
                            {!adminUsersLoading && adminUsers.length === 0 && (
                              <div className="text-sm text-gray-600">Nessun admin trovato</div>
                            )}
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={notifyAllAdmins}
                                onChange={e => setNotifyAllAdmins(e.target.checked)}
                                className="h-4 w-4"
                                disabled={adminUsers.length === 0}
                              />
                              <span className="text-sm text-gray-800">Notifica tutti gli admin</span>
                            </div>

                            {!notifyAllAdmins && adminUsers.length > 0 && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {adminUsers.map(a => {
                                  const label = `${a.firstName || ''} ${a.lastName || ''}`.trim() || a.email
                                  const checked = notifyAdminIds.includes(a.id)
                                  return (
                                    <label key={a.id} className="flex items-center gap-2 text-sm text-gray-800">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={e => {
                                          setNotifyAdminIds(prev =>
                                            e.target.checked ? [...prev, a.id] : prev.filter(x => x !== a.id)
                                          )
                                        }}
                                        className="h-4 w-4"
                                      />
                                      <span className="truncate">{label}</span>
                                    </label>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {type === 'RENTAL' && rentalType === 'CAR' && (
                      <>
                        <div>
                          <label className={labelClassName}>Tasse (€)</label>
                          <div className="relative">
                            <input
                              type="number"
                              name="tax"
                              value={(formData as any).tax}
                              onChange={handleChange}
                              step="0.01"
                              min="0"
                              className={`${inputClassName} pl-8 font-mono ${rentalCostsError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}`}
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                          </div>
                        </div>

                        <div>
                          <label className={labelClassName}>Assicurazione (€)</label>
                          <div className="relative">
                            <input
                              type="number"
                              name="insurancePrice"
                              value={(formData as any).insurancePrice}
                              onChange={handleChange}
                              step="0.01"
                              min="0"
                              className={`${inputClassName} pl-8 font-mono ${rentalCostsError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}`}
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                          </div>
                        </div>

                        <div>
                          <label className={labelClassName}>Supplementi (€)</label>
                          <div className="relative">
                            <input
                              type="number"
                              name="supplementPrice"
                              value={(formData as any).supplementPrice}
                              onChange={handleChange}
                              step="0.01"
                              min="0"
                              className={`${inputClassName} pl-8 font-mono ${rentalCostsError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}`}
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                          </div>
                        </div>
                        {rentalCostsError && (
                          <div className="sm:col-span-4">
                            <p className="text-sm text-red-600 font-medium">{rentalCostsError}</p>
                          </div>
                        )}
                      </>
                    )}

                    {allowDeposit && (
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
                    )}
                    
                    {type === 'RENTAL' && (
                      <>
                        <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-white text-center">
                          <div className="w-full">
                            <span className="text-xs text-gray-500 uppercase font-bold block mb-1">Lordo</span>
                            <span className="text-lg font-mono font-bold text-gray-700">€ {rentalGross.toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-white text-center">
                          <div className="w-full">
                            <span className="text-xs text-gray-500 uppercase font-bold block mb-1">Agente (5%)</span>
                            <span className="text-lg font-mono font-bold text-gray-700">€ {rentalAgentShare.toFixed(2)}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  
                </>
              ) : (
                // BROKERAGE FLOW (Barche/Moto - Agency Only Commission)
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                    <div>
                      <label className={labelClassName}>Prezzo Totale Cliente (€)</label>
                      <div className="relative">
                        <input
                          type="number"
                          name="price"
                          value={formData.price}
                          onChange={handleChange}
                          step="0.01"
                          min="0"
                          className={`${inputClassName} pl-8 font-mono bg-blue-50/50`}
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-white text-center">
                      <div className="w-full">
                        <span className="text-xs text-gray-500 uppercase font-bold block mb-1">Lordo</span>
                        <span className="text-lg font-mono font-bold text-gray-700">€ {rentalGross.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-white text-center">
                      <div className="w-full">
                        <span className="text-xs text-gray-500 uppercase font-bold block mb-1">Agente (5%)</span>
                        <span className="text-lg font-mono font-bold text-gray-700">€ {rentalAgentShare.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
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

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => {
          setAlertModal(prev => ({ ...prev, isOpen: false }))
          if (alertModal.onClose) alertModal.onClose()
        }}
        title={alertModal.title}
        message={alertModal.message}
        variant={alertModal.variant}
      />
    </div>
  )
}
