import { useState, useEffect, Fragment } from 'react'
import { User, Users, CheckCircle, Clock, DollarSign, Search, Filter, ChevronDown, ChevronUp, UserCheck, Wallet, Calendar, Trash2, FileDown, Plus, RotateCcw } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { ManualTaxBookingModal } from './ManualTaxBookingModal'
import { ExportTaxBookingsModal, TAX_EXPORT_FIELDS, type ExportTaxBookingsFormat, type ExportTaxBookingsOptions } from './ExportTaxBookingsModal'
import { ConfirmationModal } from '../../components/ConfirmationModal'
import { AlertModal } from '../../components/AlertModal'

interface TaxBooking {
  id: string
  nFile: string
  week: string
  provenienza: string
  serviceCode: number
  pax: number
  leadName: string
  room: string | null
  totalAmount: number
  assignedToId: string | null
  assignedTo?: {
    id: string
    firstName: string
    lastName: string
  }
  customerPaid: boolean
  adminPaid: boolean
  depositStatus?: string
  depositProcessedAt?: string | null
  rawData: string
}

interface TaxBookingsListProps {
  currentUserId: string
  userRole: string
  refreshTrigger?: number
}

export function TaxBookingsList({ currentUserId, userRole, refreshTrigger = 0 }: TaxBookingsListProps) {
  const [bookings, setBookings] = useState<TaxBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [assistants, setAssistants] = useState<any[]>([])
  const [lastImport, setLastImport] = useState<{ id: string; fileName: string | null; createdAt: string } | null>(null)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [exportModalList, setExportModalList] = useState<TaxBooking[]>([])
  const [exportModalTitle, setExportModalTitle] = useState('Tasse & Non Commissionabile')
  const [exportModalDefaultFormat, setExportModalDefaultFormat] = useState<ExportTaxBookingsFormat>('PDF')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    variant?: 'danger' | 'warning' | 'info'
    onConfirm: () => void
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'danger',
    onConfirm: () => {}
  })
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    variant?: 'danger' | 'success' | 'info' | 'warning'
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'info'
  })

  // Helper to parse participants from rawData
  const getParticipants = (booking: TaxBooking) => {
      try {
          const raw = JSON.parse(booking.rawData || '{}')
          return raw.participants || []
      } catch (e) {
          return []
      }
  }

  const getRaw = (booking: TaxBooking) => {
    try {
      return JSON.parse(booking.rawData || '{}') || {}
    } catch {
      return {}
    }
  }

  const parseDdMm = (s: string): Date | null => {
    const t = String(s || '').trim()
    if (!t) return null
    const parts = t.split('/')
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10)
      const m = parseInt(parts[1], 10)
      const y = parseInt(parts[2], 10)
      const dt = new Date(y, m - 1, d)
      return isNaN(dt.getTime()) ? null : dt
    }
    if (parts.length === 2) {
      const d = parseInt(parts[0], 10)
      const m = parseInt(parts[1], 10)
      const y = new Date().getFullYear()
      const dt = new Date(y, m - 1, d)
      return isNaN(dt.getTime()) ? null : dt
    }
    const dt = new Date(t)
    return isNaN(dt.getTime()) ? null : dt
  }

  const getOutDate = (booking: TaxBooking): Date | null => {
    const raw = getRaw(booking)
    if (raw.outDate) return parseDdMm(String(raw.outDate))
    return null
  }

  const isEnded = (booking: TaxBooking) => {
    const out = getOutDate(booking)
    if (!out) return false
    const today = new Date()
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    return out.getTime() < start.getTime()
  }

  // Filters
  const [selectedWeek, setSelectedWeek] = useState<string>('')
  const [weeks, setWeeks] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [provenienzaFilter, setProvenienzaFilter] = useState<string>('')
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>('')

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkAssistantId, setBulkAssistantId] = useState<string>('')
  const [selectedAssistantFilter, setSelectedAssistantFilter] = useState<string>('')
  const [showManualModal, setShowManualModal] = useState(false)

  const getServiceLabel = (code: number) => {
    if (code === 1) return 'BRACCIALETTO'
    if (code === 2) return 'TASSA_SOGGIORNO'
    if (code === 3) return 'BRACCIALETTO+TASSA'
    if (code === 4) return 'CAUZIONE'
    return String(code)
  }

  const safeJson = (raw: string): Record<string, unknown> => {
    try {
      const parsed = JSON.parse(raw || '{}')
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>
      return {}
    } catch {
      return {}
    }
  }

  const getAmounts = (b: TaxBooking) => {
    const raw = safeJson(b.rawData || '{}')
    const braceletCost = Number(raw.braceletCost ?? 0)
    const cityTaxCost = Number(raw.cityTaxCost ?? 0)

    if (b.serviceCode === 4) {
      return { bracelet: 0, cityTax: 0, deposit: b.totalAmount, total: b.totalAmount }
    }

    if (b.serviceCode === 2) {
      return { bracelet: 0, cityTax: b.totalAmount, deposit: 0, total: b.totalAmount }
    }

    if (b.serviceCode === 3) {
      const cityTax = cityTaxCost > 0 ? cityTaxCost : 0
      const bracelet = braceletCost > 0 ? braceletCost : Math.max(0, b.totalAmount - cityTax)
      return { bracelet, cityTax, deposit: 0, total: b.totalAmount }
    }

    return { bracelet: b.totalAmount, cityTax: 0, deposit: 0, total: b.totalAmount }
  }

  const getReportMeta = (b: TaxBooking) => {
    const raw = safeJson(b.rawData || '{}')
    const hotel = typeof raw.hotel === 'string' ? raw.hotel : ''
    const inDate = typeof raw.inDate === 'string' ? raw.inDate : ''
    const outDate = typeof raw.outDate === 'string' ? raw.outDate : ''
    const agencyName = typeof raw.agencyName === 'string' ? raw.agencyName : ''
    return { hotel, inDate, outDate, agencyName }
  }

  const buildCsv = (rows: string[][]) => {
    const escape = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`
    return rows.map(r => r.map(escape).join(',')).join('\r\n')
  }

  const downloadFile = (content: string, fileName: string, mime: string) => {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const labelMap = (() => {
    const m = new Map<string, string>()
    for (const f of TAX_EXPORT_FIELDS) m.set(f.id, f.label)
    return m
  })()

  const buildFiltersLine = () => {
    return [
      selectedWeek ? `Settimana=${selectedWeek}` : null,
      serviceTypeFilter ? `Servizio=${getServiceLabel(Number(serviceTypeFilter))}` : null,
      provenienzaFilter ? `Prov=${provenienzaFilter}` : null,
      selectedAssistantFilter ? `Assistente=${selectedAssistantFilter}` : null,
      searchTerm ? `Cerca="${searchTerm}"` : null,
    ].filter(Boolean).join(' | ')
  }

  const getExportValues = (b: TaxBooking, forCsv: boolean) => {
    const amounts = getAmounts(b)
    const meta = getReportMeta(b)
    const status = b.serviceCode === 4 ? String(b.depositStatus || 'PENDING').toUpperCase() : ''

    const depositIn = b.serviceCode === 4 ? (b.totalAmount || 0) : 0
    const depositOut = b.serviceCode === 4 && status === 'RETURNED' ? (b.totalAmount || 0) : 0
    const depositNet = depositIn - depositOut

    const assistantName = b.assignedTo ? `${b.assignedTo.firstName || ''} ${b.assignedTo.lastName || ''}`.trim() : ''

    return {
      section: b.serviceCode === 4 ? 'CAUZIONI' : 'SERVIZI',
      week: b.week,
      nFile: b.nFile,
      provenienza: b.provenienza,
      service: getServiceLabel(b.serviceCode),
      pax: String(b.pax),
      leadName: b.leadName,
      agencyName: meta.agencyName || '',
      hotel: meta.hotel || '',
      inDate: meta.inDate || '',
      outDate: meta.outDate || '',
      bracelet: forCsv ? amounts.bracelet.toFixed(2) : `€ ${amounts.bracelet.toFixed(2)}`,
      cityTax: forCsv ? amounts.cityTax.toFixed(2) : `€ ${amounts.cityTax.toFixed(2)}`,
      total: forCsv ? b.totalAmount.toFixed(2) : `€ ${b.totalAmount.toFixed(2)}`,
      depositIn: forCsv ? depositIn.toFixed(2) : `€ ${depositIn.toFixed(2)}`,
      depositOut: forCsv ? depositOut.toFixed(2) : `€ ${depositOut.toFixed(2)}`,
      depositNet: forCsv ? depositNet.toFixed(2) : `€ ${depositNet.toFixed(2)}`,
      depositStatus: status,
      assistant: assistantName || (forCsv ? '' : 'Non assegnato'),
      customerPaid: forCsv ? (b.customerPaid ? '1' : '0') : (b.customerPaid ? 'SI' : 'NO'),
      adminPaid: forCsv ? (b.adminPaid ? '1' : '0') : (b.adminPaid ? 'SI' : 'NO'),
    }
  }

  const exportWithOptions = (list: TaxBooking[], title: string, options: ExportTaxBookingsOptions) => {
    const fields = options.fields
    const filtersLine = buildFiltersLine()

    const services = options.includeServices ? list.filter(b => b.serviceCode !== 4) : []
    const deposits = options.includeDeposits ? list.filter(b => b.serviceCode === 4) : []

    if (options.format === 'CSV') {
      const header = fields.map(f => labelMap.get(f) || f)
      const rows: string[][] = [header]

      const pushRows = (items: TaxBooking[]) => {
        for (const b of items) {
          const v = getExportValues(b, true) as any
          rows.push(fields.map(f => String(v[f] ?? '')))
        }
      }

      pushRows(services)
      pushRows(deposits)

      const csv = buildCsv(rows)
      downloadFile(csv, `${title.toLowerCase().replace(/\s+/g, '_')}.csv`, 'text/csv;charset=utf-8')
      return
    }

    const doc = new jsPDF()
    doc.text(title, 14, 20)
    doc.setFontSize(10)
    doc.text(`Generato il: ${new Date().toLocaleDateString()}`, 14, 25)
    if (filtersLine) {
      doc.setFontSize(9)
      doc.text(`Filtri: ${filtersLine}`, 14, 29)
    }

    const head = [fields.map(f => labelMap.get(f) || f)]

    const makeBody = (items: TaxBooking[]) => {
      return items.map(b => {
        const v = getExportValues(b, false) as any
        return fields.map(f => String(v[f] ?? '-'))
      })
    }

    let startY = filtersLine ? 34 : 30

    if (services.length > 0) {
      autoTable(doc, {
        head,
        body: makeBody(services),
        startY,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [240, 240, 240], textColor: [30, 30, 30] },
      })
      startY = ((doc as any).lastAutoTable?.finalY || startY) + 10
    }

    if (deposits.length > 0) {
      const depositIn = deposits.reduce((acc, b) => acc + (b.totalAmount || 0), 0)
      const depositOut = deposits.reduce((acc, b) => {
        const status = String(b.depositStatus || 'PENDING').toUpperCase()
        return acc + (status === 'RETURNED' ? (b.totalAmount || 0) : 0)
      }, 0)
      const depositNet = depositIn - depositOut

      doc.setFontSize(11)
      doc.text('Cauzioni (sezione separata)', 14, startY)
      doc.setFontSize(9)
      doc.text(
        `Entrate: € ${depositIn.toFixed(2)}  |  Uscite (restituite): € ${depositOut.toFixed(2)}  |  Netto: € ${depositNet.toFixed(2)}`,
        14,
        startY + 5
      )

      autoTable(doc, {
        head,
        body: makeBody(deposits),
        startY: startY + 10,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [235, 255, 245], textColor: [10, 80, 50] },
      })
    }

    doc.save(`${title.toLowerCase().replace(/\s+/g, '_')}.pdf`)
  }

  const handleExportPDF = (list: TaxBooking[], title: string) => {
    const doc = new jsPDF()
    
    doc.text(title, 14, 20)
    doc.setFontSize(10)
    doc.text(`Generato il: ${new Date().toLocaleDateString()}`, 14, 25)

    const filtersLine = [
      selectedWeek ? `Settimana=${selectedWeek}` : null,
      serviceTypeFilter ? `Servizio=${getServiceLabel(Number(serviceTypeFilter))}` : null,
      provenienzaFilter ? `Prov=${provenienzaFilter}` : null,
      selectedAssistantFilter ? `Assistente=${selectedAssistantFilter}` : null,
      searchTerm ? `Cerca="${searchTerm}"` : null,
    ].filter(Boolean).join(' | ')

    if (filtersLine) {
      doc.setFontSize(9)
      doc.text(`Filtri: ${filtersLine}`, 14, 29)
    }

    const nonDeposits = list.filter(b => b.serviceCode !== 4)
    const deposits = list.filter(b => b.serviceCode === 4)

    const tableData = nonDeposits.map(b => {
      const amounts = getAmounts(b)
      const meta = getReportMeta(b)
      return [
        b.week,
        b.nFile,
        b.provenienza,
        getServiceLabel(b.serviceCode),
        String(b.pax),
        b.leadName,
        meta.agencyName || '-',
        meta.hotel || '-',
        meta.inDate || '-',
        meta.outDate || '-',
        `€ ${amounts.bracelet.toFixed(2)}`,
        `€ ${amounts.cityTax.toFixed(2)}`,
        `€ ${b.totalAmount.toFixed(2)}`,
        b.assignedTo ? `${b.assignedTo.firstName || ''} ${b.assignedTo.lastName || ''}`.trim() : 'Non assegnato',
        b.customerPaid ? 'INCASSATO' : 'DA INCASSARE',
        b.adminPaid ? 'VERSATO' : 'NON VERSATO',
      ]
    })

    autoTable(doc, {
        head: [[
          'Settimana',
          'N File',
          'Prov',
          'Servizio',
          'Pax',
          'Capogruppo',
          'Agenzia',
          'Hotel',
          'IN',
          'OUT',
          'Bracc',
          'Tassa',
          'Tot',
          'Assistente',
          'Incasso',
          'Versato Admin',
        ]],
        body: tableData,
        startY: filtersLine ? 34 : 30,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [240, 240, 240], textColor: [30, 30, 30] },
    })

    if (deposits.length > 0) {
      const depositIn = deposits.reduce((acc, b) => acc + (b.totalAmount || 0), 0)
      const depositOut = deposits.reduce((acc, b) => {
        const status = (b.depositStatus || 'PENDING').toUpperCase()
        return acc + (status === 'RETURNED' ? (b.totalAmount || 0) : 0)
      }, 0)
      const depositNet = depositIn - depositOut

      const startY = ((doc as any).lastAutoTable?.finalY || (filtersLine ? 34 : 30)) + 10
      doc.setFontSize(11)
      doc.text('Cauzioni (sezione separata)', 14, startY)
      doc.setFontSize(9)
      doc.text(
        `Entrate: € ${depositIn.toFixed(2)}  |  Uscite (restituite): € ${depositOut.toFixed(2)}  |  Netto: € ${depositNet.toFixed(2)}`,
        14,
        startY + 5
      )

      const depositRows = deposits.map(b => {
        const meta = getReportMeta(b)
        const status = (b.depositStatus || 'PENDING').toUpperCase()
        const entrata = b.totalAmount || 0
        const uscita = status === 'RETURNED' ? entrata : 0
        const netto = entrata - uscita
        return [
          b.week,
          b.nFile,
          b.provenienza,
          String(b.pax),
          b.leadName,
          meta.hotel || '-',
          meta.inDate || '-',
          meta.outDate || '-',
          `€ ${entrata.toFixed(2)}`,
          `€ ${uscita.toFixed(2)}`,
          `€ ${netto.toFixed(2)}`,
          status,
          b.assignedTo ? `${b.assignedTo.firstName || ''} ${b.assignedTo.lastName || ''}`.trim() : 'Non assegnato',
          b.customerPaid ? 'INCASSATO' : 'DA INCASSARE',
          b.adminPaid ? 'VERSATO' : 'NON VERSATO',
        ]
      })

      autoTable(doc, {
        head: [[
          'Settimana',
          'N File',
          'Prov',
          'Pax',
          'Capogruppo',
          'Hotel',
          'IN',
          'OUT',
          'Entrata',
          'Uscita',
          'Netto',
          'Esito',
          'Assistente',
          'Incasso',
          'Versato Admin',
        ]],
        body: depositRows,
        startY: startY + 10,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [235, 255, 245], textColor: [10, 80, 50] },
      })
    }

    doc.save(`${title.toLowerCase().replace(/\s+/g, '_')}.pdf`)
  }

  const handleExportFilteredPDF = () => {
    setExportModalList(allVisible)
    setExportModalTitle('Tasse & Non Commissionabile (Filtri)')
    setExportModalDefaultFormat('PDF')
    setExportModalOpen(true)
  }

  const handleExportFilteredCSV = () => {
    setExportModalList(allVisible)
    setExportModalTitle('Tasse & Non Commissionabile (Filtri)')
    setExportModalDefaultFormat('CSV')
    setExportModalOpen(true)
  }

  useEffect(() => {
    fetchBookings()
    if (userRole === 'ADMIN') {
        fetchAssistants()
        fetchLastImport()
    }
  }, [refreshTrigger])

  const fetchLastImport = async () => {
    try {
      const res = await fetch('/api/taxes/import-batches')
      if (!res.ok) return
      const json = await res.json()
      const b = json?.batches?.[0]
      if (b?.id) {
        setLastImport({ id: String(b.id), fileName: b.fileName ? String(b.fileName) : null, createdAt: String(b.createdAt) })
      } else {
        setLastImport(null)
      }
    } catch {
      setLastImport(null)
    }
  }

  const handleRollbackLastImport = () => {
    if (userRole !== 'ADMIN') return
    setConfirmModal({
      isOpen: true,
      title: 'Annulla ultimo import Excel',
      message: 'Verranno eliminati/ripristinati i dati dell’ultimo file Excel importato. Confermi?',
      variant: 'warning',
      onConfirm: async () => {
        try {
          const res = await fetch('/api/taxes/import-batches/rollback-last', { method: 'POST' })
          if (!res.ok) {
            const t = await res.text()
            setAlertModal({ isOpen: true, title: 'Errore', message: t || 'Errore durante il rollback', variant: 'danger' })
            return
          }
          const json = await res.json()
          setAlertModal({
            isOpen: true,
            title: 'Operazione completata',
            message: `Ripristinate: ${json.restored ?? 0}, Eliminate: ${json.deleted ?? 0}`,
            variant: 'success',
          })
          await fetchBookings()
          await fetchLastImport()
        } catch {
          setAlertModal({ isOpen: true, title: 'Errore', message: 'Errore durante il rollback', variant: 'danger' })
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }))
        }
      },
    })
  }

  const handleBulkAssign = async () => {
    if (selectedIds.size === 0) {
      setAlertModal({
        isOpen: true,
        title: 'Selezione richiesta',
        message: 'Seleziona almeno una prenotazione',
        variant: 'warning'
      })
      return
    }
    if (!bulkAssistantId) {
      setAlertModal({
        isOpen: true,
        title: 'Assistente mancante',
        message: 'Seleziona un assistente',
        variant: 'warning'
      })
      return
    }

    setLoading(true)
    try {
        const res = await fetch('/api/taxes/bookings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ids: Array.from(selectedIds),
                action: 'assign',
                value: bulkAssistantId
            })
        })

        if (res.ok) {
            setSelectedIds(new Set())
            setBulkAssistantId('')
            fetchBookings()
        } else {
            setAlertModal({
              isOpen: true,
              title: 'Errore',
              message: 'Errore durante l\'assegnazione massiva',
              variant: 'danger'
            })
        }
    } catch (error) {
        console.error('Error bulk assigning:', error)
        setAlertModal({
          isOpen: true,
          title: 'Errore',
          message: 'Errore di rete',
          variant: 'danger'
        })
    } finally {
        setLoading(false)
    }
  }

  const toggleSelect = (id: string) => {
      const newSet = new Set(selectedIds)
      if (newSet.has(id)) {
          newSet.delete(id)
      } else {
          newSet.add(id)
      }
      setSelectedIds(newSet)
  }


  useEffect(() => {
      // Extract unique weeks and sort them
      const uniqueWeeks = Array.from(new Set(bookings.map(b => b.week))).sort((a, b) => {
          return a.localeCompare(b)
      })
      setWeeks(uniqueWeeks)
  }, [bookings])

  const fetchBookings = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/taxes/bookings')
      if (res.ok) {
        const data = await res.json()
        setBookings(data)
      }
    } catch (error) {
      console.error('Error fetching bookings:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAssistants = async () => {
      try {
          const res = await fetch('/api/users?role=ASSISTANT')
          if (res.ok) {
              const data = await res.json()
              setAssistants(data)
          }
      } catch (error) {
          console.error('Error fetching assistants:', error)
      }
  }

  const handleAssign = async (bookingId: string, assistantId: string) => {
      try {
          const res = await fetch('/api/taxes/bookings', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  id: bookingId,
                  action: 'assign',
                  value: assistantId
              })
          })
          if (res.ok) {
              fetchBookings()
          }
      } catch (error) {
          console.error('Error assigning booking:', error)
      }
  }

  const handleStatusUpdate = async (bookingId: string, action: 'customerPaid' | 'adminPaid', value: boolean) => {
      try {
          const res = await fetch('/api/taxes/bookings', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  id: bookingId,
                  action,
                  value
              })
          })
          if (res.ok) {
              fetchBookings()
          }
      } catch (error) {
          console.error('Error updating status:', error)
      }
  }

  const handleDepositDecision = async (bookingId: string, decision: 'RETURNED' | 'RETAINED') => {
    try {
      const res = await fetch('/api/taxes/bookings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: bookingId,
          action: 'depositStatus',
          value: decision,
        }),
      })
      if (res.ok) {
        fetchBookings()
      }
    } catch (error) {
      console.error('Error updating deposit status:', error)
    }
  }

  const handleDelete = async (bookingId: string) => {
      setConfirmModal({
        isOpen: true,
        title: 'Elimina Prenotazione',
        message: 'Sei sicuro di voler eliminare questa prenotazione?',
        variant: 'danger',
        onConfirm: async () => {
          try {
              const res = await fetch(`/api/taxes/bookings?id=${bookingId}`, {
                  method: 'DELETE'
              })
              
              if (!res.ok) {
                  const text = await res.text()
                  setAlertModal({
                    isOpen: true,
                    title: 'Errore',
                    message: text || 'Errore durante l\'eliminazione',
                    variant: 'danger'
                  })
                  return
              }
              
              fetchBookings()
          } catch (error) {
              console.error('Error deleting:', error)
              setAlertModal({
                isOpen: true,
                title: 'Errore',
                message: 'Errore di rete',
                variant: 'danger'
              })
          }
        }
      })
  }

  const handleDeleteAll = async () => {
      setConfirmModal({
        isOpen: true,
        title: 'Eliminazione Massiva',
        message: 'ATTENZIONE: Eliminerai TUTTE le prenotazioni NON assegnate e NON pagate. Confermi?',
        variant: 'danger',
        onConfirm: async () => {
          setLoading(true)
          try {
              const res = await fetch('/api/taxes/bookings?all=true', {
                  method: 'DELETE'
              })

              if (!res.ok) {
                  const text = await res.text()
                  setAlertModal({
                    isOpen: true,
                    title: 'Errore',
                    message: text || 'Errore durante l\'eliminazione',
                    variant: 'danger'
                  })
              } else {
                  fetchBookings()
              }
          } catch (error) {
              console.error('Error deleting all:', error)
              setAlertModal({
                isOpen: true,
                title: 'Errore',
                message: 'Errore di rete',
                variant: 'danger'
              })
          } finally {
              setLoading(false)
          }
        }
      })
  }

  const baseFiltered = bookings.filter(b => {
      if (selectedWeek && b.week !== selectedWeek) return false
      if (userRole === 'ADMIN' && provenienzaFilter && b.provenienza !== provenienzaFilter) return false
      if (serviceTypeFilter && b.serviceCode !== Number(serviceTypeFilter)) return false
      if (searchTerm && !b.leadName.toLowerCase().includes(searchTerm.toLowerCase()) && !b.nFile.includes(searchTerm)) return false
      if (userRole === 'ADMIN' && selectedAssistantFilter && b.assignedToId !== selectedAssistantFilter) return false
      return true
  })

  const unpaidBookings = baseFiltered.filter(b => !b.customerPaid)
  const paidBookings = baseFiltered.filter(b => {
      if (!b.customerPaid) return false
      return true
  })

  const depositsToClose = baseFiltered.filter(b => b.serviceCode === 4 && isEnded(b) && (b.depositStatus || 'PENDING') === 'PENDING')

  const toggleSelectAllUnpaid = () => {
      const allUnpaidSelected = unpaidBookings.length > 0 && unpaidBookings.every(b => selectedIds.has(b.id))
      
      const newSet = new Set(selectedIds)
      if (allUnpaidSelected) {
          unpaidBookings.forEach(b => newSet.delete(b.id))
      } else {
          unpaidBookings.forEach(b => newSet.add(b.id))
      }
      setSelectedIds(newSet)
  }

  // Calculate Totals for filtered view
  const allVisible = [...unpaidBookings, ...paidBookings]
  
  // Calculate Summaries
  const totalPax = allVisible.reduce((acc, b) => acc + b.pax, 0)
  const totalAmount = allVisible.reduce((acc, b) => acc + b.totalAmount, 0)
  const totalPaid = allVisible.filter(b => b.customerPaid).reduce((acc, b) => acc + b.totalAmount, 0)
  const totalUnpaid = totalAmount - totalPaid
  const totalAdminPaid = allVisible.filter(b => b.adminPaid).reduce((acc, b) => acc + b.totalAmount, 0)
  
  const byService = {
      bracelet: {
          pax: allVisible.filter(b => b.serviceCode === 1).reduce((acc, b) => acc + b.pax, 0),
          amount: allVisible.filter(b => b.serviceCode === 1).reduce((acc, b) => acc + b.totalAmount, 0)
      },
      tax: {
          pax: allVisible.filter(b => b.serviceCode === 2).reduce((acc, b) => acc + b.pax, 0),
          amount: allVisible.filter(b => b.serviceCode === 2).reduce((acc, b) => acc + b.totalAmount, 0)
      },
      both: {
          pax: allVisible.filter(b => b.serviceCode === 3).reduce((acc, b) => acc + b.pax, 0),
          amount: allVisible.filter(b => b.serviceCode === 3).reduce((acc, b) => acc + b.totalAmount, 0)
      },
      deposit: {
          pax: allVisible.filter(b => b.serviceCode === 4).reduce((acc, b) => acc + b.pax, 0),
          amount: allVisible.filter(b => b.serviceCode === 4).reduce((acc, b) => acc + b.totalAmount, 0),
          returned: allVisible.filter(b => b.serviceCode === 4 && (b.depositStatus || 'PENDING') === 'RETURNED').reduce((acc, b) => acc + b.totalAmount, 0),
          retained: allVisible.filter(b => b.serviceCode === 4 && (b.depositStatus || 'PENDING') === 'RETAINED').reduce((acc, b) => acc + b.totalAmount, 0),
          pendingClose: depositsToClose.length,
      }
  }

  const byProvenienza = {
      agency: allVisible.filter(b => b.provenienza === 'AGENZIA').length,
      agencyAmount: allVisible.filter(b => b.provenienza === 'AGENZIA').reduce((acc, b) => acc + b.totalAmount, 0),
      private: allVisible.filter(b => b.provenienza === 'PRIVATO').length,
      privateAmount: allVisible.filter(b => b.provenienza === 'PRIVATO').reduce((acc, b) => acc + b.totalAmount, 0)
  }

  const openExportModal = (list: TaxBooking[], title: string, format: ExportTaxBookingsFormat) => {
    setExportModalList(list)
    setExportModalTitle(title)
    setExportModalDefaultFormat(format)
    setExportModalOpen(true)
  }

  const renderTable = (list: TaxBooking[], title: string, isPaidList: boolean) => (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
          <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
              <h3 className={`font-bold text-lg flex items-center gap-2 ${isPaidList ? 'text-green-700' : 'text-orange-700'}`}>
                  {isPaidList ? <CheckCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                  {title} ({list.length})
              </h3>
              <button 
                  onClick={() => openExportModal(list, title, 'PDF')}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                  <FileDown className="w-4 h-4" />
                  Esporta PDF
              </button>
          </div>
          {/* Table Content */}
          <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-semibold">
                  <tr>
                      {userRole === 'ADMIN' && !isPaidList && (
                          <th className="px-6 py-4 w-10">
                              <input 
                                  type="checkbox" 
                                  onChange={toggleSelectAllUnpaid}
                                  checked={list.length > 0 && list.every(b => selectedIds.has(b.id))}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                          </th>
                      )}
                      <th className="px-6 py-4">N File / Settimana</th>
                      <th className="px-6 py-4">Cliente</th>
                      <th className="px-6 py-4 text-center">Pax / Servizio</th>
                      <th className="px-6 py-4 text-right">Importo</th>
                      <th className="px-6 py-4 text-center">Assegnato A</th>
                      <th className="px-6 py-4 text-center">Stato Pagamento</th>
                      {userRole === 'ADMIN' && <th className="px-6 py-4 text-center">Versato Admin</th>}
                      <th className="px-6 py-4"></th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                  {list.map(booking => (
                      <Fragment key={booking.id}>
                      <tr className={`hover:bg-gray-50 transition-colors ${selectedIds.has(booking.id) ? 'bg-blue-50' : ''}`}>
                          {userRole === 'ADMIN' && !isPaidList && (
                              <td className="px-6 py-4">
                                  <input 
                                      type="checkbox" 
                                      checked={selectedIds.has(booking.id)}
                                      onChange={() => toggleSelect(booking.id)}
                                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                              </td>
                          )}
                          <td className="px-6 py-4">
                              <div className="font-mono font-medium text-gray-900">{booking.nFile}</div>
                              <div className="text-xs text-gray-500 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" /> {booking.week}
                              </div>
                          </td>
                          <td className="px-6 py-4">
                              <div className="font-bold text-gray-900">{booking.leadName}</div>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1 ${
                                  booking.provenienza === 'AGENZIA' ? 'bg-orange-100 text-orange-800' : 'bg-purple-100 text-purple-800'
                              }`}>
                                  {booking.provenienza}
                              </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                              <div className="font-medium">{booking.pax} Pax</div>
                              <div className="text-xs text-gray-500 mt-1">
                                  {booking.serviceCode === 1 ? 'Solo Braccialetto' :
                                   booking.serviceCode === 2 ? 'Tassa di Soggiorno' :
                                   booking.serviceCode === 3 ? 'Braccialetto + Tassa' :
                                   'Cauzione'}
                              </div>
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-gray-900">
                              € {booking.totalAmount.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-center">
                              {userRole === 'ADMIN' ? (
                                  <select 
                                      value={booking.assignedToId || ''}
                                      onChange={(e) => handleAssign(booking.id, e.target.value)}
                                      className="text-xs border rounded px-2 py-1 bg-white focus:ring-2 focus:ring-blue-500 outline-none max-w-[120px]"
                                  >
                                      <option value="">-- Non Assegnato --</option>
                                      {assistants.map(a => (
                                          <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
                                      ))}
                                  </select>
                              ) : (
                                  <span className="text-sm text-gray-600">
                                      {booking.assignedTo ? `${booking.assignedTo.firstName} ${booking.assignedTo.lastName}` : '-'}
                                  </span>
                              )}
                          </td>
                          <td className="px-6 py-4 text-center">
                              {!isPaidList ? (
                                  <button
                                      onClick={() => handleStatusUpdate(booking.id, 'customerPaid', true)}
                                      className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-emerald-700 transition-all transform hover:scale-105 active:scale-95"
                                  >
                                      <Wallet className="w-4 h-4" />
                                      INCASSA
                                  </button>
                              ) : (
                                  <button
                                      onClick={() => handleStatusUpdate(booking.id, 'customerPaid', false)}
                                      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 hover:bg-green-200 transition-colors border border-green-200"
                                      title="Clicca per annullare il pagamento"
                                  >
                                      PAGATO
                                  </button>
                              )}
                          </td>
                          {userRole === 'ADMIN' && (
                              <td className="px-6 py-4 text-center">
                                  <button
                                      onClick={() => handleStatusUpdate(booking.id, 'adminPaid', !booking.adminPaid)}
                                      disabled={!booking.customerPaid}
                                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                                          booking.adminPaid
                                              ? 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                                              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                                      } ${!booking.customerPaid ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  >
                                      {booking.adminPaid ? 'VERSATO' : 'NON VERSATO'}
                                  </button>
                              </td>
                          )}
                          <td className="px-6 py-4 text-right">
                              <div className="flex justify-end items-center gap-2">
                                  <button 
                                      onClick={() => setExpandedRow(expandedRow === booking.id ? null : booking.id)}
                                      className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                      title="Vedi Partecipanti"
                                  >
                                      {expandedRow === booking.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                  </button>
                                  {userRole === 'ADMIN' && (
                                      <button 
                                          onClick={() => handleDelete(booking.id)}
                                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                          title="Elimina"
                                      >
                                          <Trash2 className="w-4 h-4" />
                                      </button>
                                  )}
                              </div>
                          </td>
                      </tr>
                      {expandedRow === booking.id && (
                          <tr className="bg-gray-50/50">
                              <td colSpan={userRole === 'ADMIN' ? 9 : 7} className="px-6 py-4 border-t border-gray-100">
                                  <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm max-w-2xl">
                                      <h4 className="text-xs font-bold uppercase text-gray-500 mb-2 flex items-center gap-2">
                                          <Users className="w-3 h-3" />
                                          Lista Partecipanti ({getParticipants(booking).length})
                                      </h4>
                                      {getParticipants(booking).length > 0 ? (
                                          <ul className="divide-y divide-gray-100">
                                              {getParticipants(booking).map((p: any, idx: number) => (
                                                  <li key={idx} className="py-2 flex justify-between items-center text-sm">
                                                      <span className="font-medium text-gray-800">
                                                          {p.lastName} {p.firstName}
                                                      </span>
                                                      <span className="text-xs text-gray-500">
                                                          {p.birthDate ? `Nato il: ${p.birthDate}` : ''}
                                                      </span>
                                                  </li>
                                              ))}
                                          </ul>
                                      ) : (
                                          <p className="text-sm text-gray-400 italic">Nessun partecipante registrato.</p>
                                      )}
                                      
                                      {/* Debug info if needed */}
                                      {booking.room && (
                                          <div className="mt-3 pt-3 border-t border-gray-100">
                                              <span className="text-xs text-gray-500 font-bold">Camera:</span>
                                              <span className="text-sm ml-2">{booking.room}</span>
                                          </div>
                                      )}
                                  </div>
                              </td>
                          </tr>
                      )}
                      </Fragment>
                  ))}
                  {list.length === 0 && (
                      <tr>
                          <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                              Nessuna prenotazione in questa lista.
                          </td>
                      </tr>
                  )}
              </tbody>
          </table>
      </div>
  )

  if (loading) return <div className="p-8 text-center">Caricamento...</div>

  return (
    <div className="space-y-6">
        <div className="flex items-center gap-2 mb-2">
            <h2 className="text-xl font-bold text-gray-800">Lista Tasse & Non Commissionabile</h2>
            <span className="text-sm text-gray-500 font-normal">({bookings.length} totali)</span>
        </div>

        {/* Controls */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="flex gap-4 items-center w-full md:w-auto flex-wrap">
                <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="Cerca N File o Nome..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-64"
                    />
                </div>
                <select 
                    value={selectedWeek} 
                    onChange={(e) => setSelectedWeek(e.target.value)}
                    className="px-4 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                    <option value="">Tutte le settimane</option>
                    {weeks.map(w => <option key={w} value={w}>{w}</option>)}
                </select>

                <select 
                    value={serviceTypeFilter} 
                    onChange={(e) => setServiceTypeFilter(e.target.value)}
                    className="px-4 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                    <option value="">Tutti i servizi</option>
                    <option value="1">Solo Braccialetto</option>
                    <option value="2">Solo Tassa</option>
                    <option value="3">Braccialetto + Tassa</option>
                    <option value="4">Cauzione</option>
                </select>

                {userRole === 'ADMIN' && (
                    <>
                        <select
                            value={provenienzaFilter}
                            onChange={(e) => setProvenienzaFilter(e.target.value)}
                            className="px-4 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            <option value="">Tutte le provenienze</option>
                            <option value="AGENZIA">Agenzia</option>
                            <option value="PRIVATO">Privato</option>
                        </select>

                        <button
                            onClick={() => setShowManualModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-bold shadow-sm"
                        >
                            <Plus className="w-4 h-4" />
                            Nuova
                        </button>
                    </>
                )}

                {userRole === 'ADMIN' && (
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">Filtra per Assistente:</span>
                        <select 
                            value={selectedAssistantFilter} 
                            onChange={(e) => setSelectedAssistantFilter(e.target.value)}
                            className="px-4 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            <option value="">Tutti gli assistenti</option>
                            {assistants.map(a => (
                                <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={handleExportFilteredPDF}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-sm font-medium"
                  >
                    <FileDown className="w-4 h-4" />
                    Esporta PDF (filtri)
                  </button>
                  <button
                    onClick={handleExportFilteredCSV}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-sm font-medium"
                  >
                    <FileDown className="w-4 h-4" />
                    Esporta CSV (filtri)
                  </button>
                  {userRole === 'ADMIN' && (
                    <>
                      <button
                        onClick={handleRollbackLastImport}
                        disabled={!lastImport}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-800 rounded-lg border border-amber-100 hover:bg-amber-100 transition-colors text-sm font-medium disabled:opacity-50"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Annulla ultimo import
                      </button>
                      <button
                        onClick={handleDeleteAll}
                        className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg border border-red-100 hover:bg-red-100 transition-colors text-sm font-medium"
                      >
                        <Trash2 className="w-4 h-4" />
                        Elimina Tutte (Non Assegnate)
                      </button>
                    </>
                  )}
                </div>
            </div>

            {/* Batch Assign Bar */}
            {userRole === 'ADMIN' && selectedIds.size > 0 && (
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-center gap-4 animate-in fade-in slide-in-from-top-2">
                    <span className="text-sm font-medium text-blue-800">
                        {selectedIds.size} selezionati
                    </span>
                    <div className="h-4 w-px bg-blue-200"></div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-blue-600 font-semibold uppercase">Assegna a:</span>
                        <select 
                            value={bulkAssistantId}
                            onChange={(e) => setBulkAssistantId(e.target.value)}
                            className="text-sm border rounded px-2 py-1 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            <option value="">-- Seleziona --</option>
                            {assistants.map(a => (
                                <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
                            ))}
                        </select>
                        <button 
                            onClick={handleBulkAssign}
                            disabled={!bulkAssistantId}
                            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
                        >
                            Conferma
                        </button>
                    </div>
                </div>
            )}

        </div>

        {/* Detailed Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {/* General Stats */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Generale</h4>
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Pax Totali</span>
                        <span className="font-bold text-gray-900">{totalPax}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Incasso Totale</span>
                        <span className="font-bold text-gray-900">€ {totalAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-dashed">
                        <span className="text-xs text-green-600 font-medium">Già Incassato</span>
                        <span className="text-xs font-bold text-green-700">€ {totalPaid.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-orange-600 font-medium">Da Incassare</span>
                        <span className="text-xs font-bold text-orange-700">€ {totalUnpaid.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            {/* Service Breakdown */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 col-span-1 md:col-span-2">
                <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Dettaglio Servizi</h4>
                <div className="grid grid-cols-4 gap-4">
                    <div className="bg-blue-50 p-2 rounded-lg text-center">
                        <div className="text-xs text-blue-600 font-medium mb-1">Braccialetto</div>
                        <div className="font-bold text-blue-900">{byService.bracelet.pax} pax</div>
                        <div className="text-xs text-blue-700">€ {byService.bracelet.amount.toFixed(2)}</div>
                    </div>
                    <div className="bg-purple-50 p-2 rounded-lg text-center">
                        <div className="text-xs text-purple-600 font-medium mb-1">Tassa</div>
                        <div className="font-bold text-purple-900">{byService.tax.pax} pax</div>
                        <div className="text-xs text-purple-700">€ {byService.tax.amount.toFixed(2)}</div>
                    </div>
                    <div className="bg-indigo-50 p-2 rounded-lg text-center">
                        <div className="text-xs text-indigo-600 font-medium mb-1">Entrambi</div>
                        <div className="font-bold text-indigo-900">{byService.both.pax} pax</div>
                        <div className="text-xs text-indigo-700">€ {byService.both.amount.toFixed(2)}</div>
                    </div>
                    <div className="bg-emerald-50 p-2 rounded-lg text-center">
                        <div className="text-xs text-emerald-600 font-medium mb-1">Cauzioni</div>
                        <div className="font-bold text-emerald-900">€ {byService.deposit.amount.toFixed(2)}</div>
                        <div className="text-[10px] text-emerald-700 mt-1">
                          Da chiudere: {byService.deposit.pendingClose}
                        </div>
                    </div>
                </div>
            </div>

            {/* Provenienza Stats */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Provenienza</h4>
                <div className="space-y-2">
                     <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Agenzia ({byProvenienza.agency})</span>
                        <span className="font-bold text-gray-900">€ {byProvenienza.agencyAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Privati ({byProvenienza.private})</span>
                        <span className="font-bold text-gray-900">€ {byProvenienza.privateAmount.toFixed(2)}</span>
                    </div>
                    {userRole === 'ADMIN' && (
                         <div className="mt-2 pt-2 border-t border-gray-100">
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-purple-600 font-medium">Versato Admin</span>
                                <span className="text-xs font-bold text-purple-700">€ {totalAdminPaid.toFixed(2)}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {depositsToClose.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-amber-50 border-b border-amber-100 flex justify-between items-center">
              <h3 className="font-bold text-lg flex items-center gap-2 text-amber-800">
                <Clock className="w-5 h-5" />
                Cauzioni - Prenotazioni terminate (da chiudere) ({depositsToClose.length})
              </h3>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4">N File / Settimana</th>
                  <th className="px-6 py-4">Cliente</th>
                  <th className="px-6 py-4 text-center">Data OUT</th>
                  <th className="px-6 py-4 text-right">Importo</th>
                  <th className="px-6 py-4 text-center">Esito</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {depositsToClose.map(b => {
                  const out = getOutDate(b)
                  return (
                    <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-mono font-medium text-gray-900">{b.nFile}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {b.week}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900">{b.leadName}</div>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1 ${
                          b.provenienza === 'AGENZIA' ? 'bg-orange-100 text-orange-800' : 'bg-purple-100 text-purple-800'
                        }`}>
                          {b.provenienza}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm text-gray-700">{out ? out.toLocaleDateString('it-IT') : '-'}</span>
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-gray-900">€ {b.totalAmount.toFixed(2)}</td>
                      <td className="px-6 py-4 text-center">
                        {userRole === 'ADMIN' ? (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleDepositDecision(b.id, 'RETURNED')}
                              className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                            >
                              Restituita
                            </button>
                            <button
                              onClick={() => handleDepositDecision(b.id, 'RETAINED')}
                              className="px-3 py-1 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700"
                            >
                              Non restituita
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">Solo admin</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Lists */}
        {renderTable(unpaidBookings, "Da Pagare", false)}
        {renderTable(paidBookings, "Pagati", true)}

        {exportModalOpen && (
          <ExportTaxBookingsModal
            title={`Esporta: ${exportModalTitle}`}
            defaultFormat={exportModalDefaultFormat}
            onClose={() => setExportModalOpen(false)}
            onExport={(options: ExportTaxBookingsOptions) => exportWithOptions(exportModalList, exportModalTitle, options)}
          />
        )}

        {showManualModal && (
            <ManualTaxBookingModal 
                onClose={() => setShowManualModal(false)} 
                onSuccess={() => {
                    fetchBookings()
                }} 
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
