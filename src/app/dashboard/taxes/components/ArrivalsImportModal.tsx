'use client'

import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { Upload, FileSpreadsheet, X, Users, Building2, Calendar, FileText, CheckCircle, AlertCircle } from 'lucide-react'

interface TaxBookingData {
  rowIndex: number // Debug helper
  nFile: string
  week: string
  provenienza: string // PRIVATO, AGENZIA
  serviceCode: number
  pax: number
  leadName: string
  room: string
  totalAmount: number
  rawData: string // JSON
  // UI helper
  participants?: any[] 
}

interface SkippedRowData {
  rowIndex: number
  reason: string
  pax: number
  rawC: any
  rawD: any
  rawE: any
  rawName: string
}

interface GroupedData {
  privati: TaxBookingData[]
  agenzia: TaxBookingData[]
  skipped: SkippedRowData[]
}

interface ArrivalsImportModalProps {
  onClose: () => void
  onSuccess?: () => void
}

export function ArrivalsImportModal({ onClose, onSuccess }: ArrivalsImportModalProps) {
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null)
  const [data, setData] = useState<GroupedData | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [showDebug, setShowDebug] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setLoading(true)
    setError(null)
    const reader = new FileReader()

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        setWorkbook(wb)
        
        const allPrivati: TaxBookingData[] = []
        const allAgenzia: TaxBookingData[] = []
        const allSkipped: SkippedRowData[] = []

        wb.SheetNames.forEach(sheetName => {
            // Skip "ESEMPIO" sheet as it contains dummy data
            if (sheetName.toUpperCase().includes('ESEMPIO')) return

            const ws = wb.Sheets[sheetName]
            const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][]
            const { privati, agenzia, skipped } = parseSheet(jsonData, sheetName)
            allPrivati.push(...privati)
            allAgenzia.push(...agenzia)
            allSkipped.push(...skipped)
        })

        // Post-processing: Ensure uniqueness of nFile per Week
        // If duplicates exist (e.g. same ID in Excel), the second one would overwrite the first in DB.
        // We auto-fix this by appending a suffix.
        const seenKeys = new Set<string>()
        
        const ensureUnique = (list: TaxBookingData[]) => {
            for (const item of list) {
                // Key matches Prisma constraint: nFile + week + serviceCode
                const key = `${item.nFile}__${item.week}__${item.serviceCode}`.toUpperCase()
                
                if (seenKeys.has(key)) {
                    // Duplicate found!
                    const originalNFile = item.nFile
                    // Append suffix to make it unique
                    item.nFile = `${item.nFile}_DUP${Math.floor(Math.random() * 10000)}`
                    console.warn(`Duplicate booking detected: ${originalNFile} (${item.week}). Renamed to ${item.nFile}`)
                    
                    // Add the NEW key to seen
                    seenKeys.add(`${item.nFile}__${item.week}__${item.serviceCode}`.toUpperCase())
                } else {
                    seenKeys.add(key)
                }
            }
        }

        // Check across both lists as they share the same DB table
        ensureUnique(allPrivati)
        ensureUnique(allAgenzia)

        setData({ privati: allPrivati, agenzia: allAgenzia, skipped: allSkipped })
      } catch (error) {
        console.error('Error reading file:', error)
        setError('Errore nella lettura del file Excel')
      } finally {
        setLoading(false)
      }
    }

    reader.readAsBinaryString(file)
  }

  const parseSheet = (jsonData: any[], sheetName: string) => {
    
    const privati: TaxBookingData[] = []
    const agenzia: TaxBookingData[] = []
    const skipped: SkippedRowData[] = []

    // Formato nuovo (come screenshot):
    // A(0): N FILE
    // B(1): ADV / Nome Agenzia (testo)
    // C(2): Legenda provenienza: "A" (Agenzia) | "P" (Privato)
    // D(3): N. PAX (numero)
    // E(4): LAST NAME
    // F(5): FIRST NAME
    // G(6): BIRTHDATE (può essere vuota)
    // O(14): HOTEL/APARTMENT (es. SUNRISE) -> se SUNRISE niente tassa di soggiorno
    // R(17): IN
    // S(18): OUT

    const START_ROW_INDEX = 2
    let currentBase: any = null

    const flushCurrent = () => {
      if (!currentBase) return

      const participants = currentBase.participants || []
      const statedPax = currentBase.pax || 0
      const finalPax = statedPax > 0 ? statedPax : participants.length

      const { braceletCost, cityTaxCost } = calculateBookingCost({
        participants,
        provenienza: currentBase.provenienza,
        pax: finalPax,
        inDate: currentBase.inDate,
        outDate: currentBase.outDate,
        hotel: currentBase.hotel,
      })

      const records: TaxBookingData[] = []

      const totalBracelet = braceletCost
      const totalCityTax = cityTaxCost

      if (totalBracelet > 0 && totalCityTax > 0) {
        records.push({
          ...currentBase,
          pax: finalPax,
          serviceCode: 3,
          totalAmount: totalBracelet + totalCityTax,
          rawData: JSON.stringify({ ...currentBase.raw, participants, braceletCost: totalBracelet, cityTaxCost: totalCityTax })
        })
      } else if (totalBracelet > 0) {
        records.push({
          ...currentBase,
          pax: finalPax,
          serviceCode: 1,
          totalAmount: totalBracelet,
          rawData: JSON.stringify({ ...currentBase.raw, participants, braceletCost: totalBracelet, cityTaxCost: 0 })
        })
      } else if (totalCityTax > 0) {
        records.push({
          ...currentBase,
          pax: finalPax,
          serviceCode: 2,
          totalAmount: totalCityTax,
          rawData: JSON.stringify({ ...currentBase.raw, participants, braceletCost: 0, cityTaxCost: totalCityTax })
        })
      }

      records.push({
        ...currentBase,
        pax: finalPax,
        serviceCode: 4,
        totalAmount: 50,
        rawData: JSON.stringify({ ...currentBase.raw, participants, depositAmount: 50 })
      })

      for (const r of records) {
        if (r.provenienza === 'AGENZIA') agenzia.push(r)
        else privati.push(r)
      }

      currentBase = null
    }

    for (let i = START_ROW_INDEX; i < jsonData.length; i++) {
      const row = jsonData[i]
      if (!row || row.length === 0) continue

      const a0 = String(row[0] || '').trim().toUpperCase()
      const b1 = String(row[1] || '').trim()
      const c2 = String(row[2] || '').trim().toUpperCase()

      if (a0.includes('TOTALE') || a0.includes('RIEPILOGO') || b1.toUpperCase().includes('TOTALE') || b1.toUpperCase().includes('RIEPILOGO')) continue
      if (a0.includes('ARRIVAL') || a0.includes('CORFU')) continue

      const isNewBooking = (c2 === 'A' || c2 === 'P') && row[3] !== undefined && row[3] !== null && String(row[3]).trim() !== ''

      if (isNewBooking) {
        flushCurrent()

        let nFile = String(row[0] || '').trim()
        if (!nFile) {
          const prefix = c2 === 'A' ? 'AGENCY' : 'PRIV'
          nFile = `${prefix}_${sheetName.replace(/\s+/g, '')}_ROW${i + 1}`
        }

        const statedPax = parseInt(String(row[3] || 0), 10) || 0
        const hotel = String(row[14] || '').trim()
        const room = String(row[15] || '').trim()
        const inDate = row[17]
        const outDate = row[18]

        const participants: any[] = []
        if (row[4]) {
          participants.push({
            lastName: row[4],
            firstName: row[5],
            birthDate: row[6],
          })
        }

        const leadName = participants.length > 0 ? `${participants[0].lastName} ${participants[0].firstName}`.trim() : (b1 || 'Unknown')

        currentBase = {
          rowIndex: i + 1,
          nFile,
          week: sheetName,
          provenienza: c2 === 'A' ? 'AGENZIA' : 'PRIVATO',
          pax: statedPax,
          leadName,
          room: room || null,
          totalAmount: 0,
          rawData: '{}',
          participants,
          hotel,
          inDate,
          outDate,
          raw: {
            agencyName: b1,
            hotel,
            room,
            inDate: formatDate(inDate),
            outDate: formatDate(outDate),
            source: c2 === 'A' ? 'AGENZIA' : 'PRIVATO',
            importSource: 'EXCEL',
          }
        }
      } else {
        if (!currentBase) continue
        if (row[4]) {
          currentBase.participants.push({
            lastName: row[4],
            firstName: row[5],
            birthDate: row[6],
          })
        }
      }
    }

    flushCurrent()
    
    return { privati, agenzia, skipped }
  }

  const calculateBookingCost = (input: {
    participants: any[]
    provenienza: string
    pax: number
    hotel: string
    inDate: any
    outDate: any
  }) => {
    const { participants, provenienza, pax, hotel, inDate, outDate } = input

    let braceletCost = 0
    if (provenienza === 'AGENZIA') {
      let computed = 0
      participants.forEach(p => {
        const birthDateObj = parseExcelDate(p.birthDate)
        if (birthDateObj) {
          const now = new Date()
          let age = now.getFullYear() - birthDateObj.getFullYear()
          const m = now.getMonth() - birthDateObj.getMonth()
          if (m < 0 || (m === 0 && now.getDate() < birthDateObj.getDate())) age -= 1
          braceletCost += age < 12 ? 5 : 10
          computed += 1
        } else if (p.lastName || p.firstName) {
          braceletCost += 10
          computed += 1
        }
      })

      if (pax > computed) {
        braceletCost += (pax - computed) * 10
      }
    }

    let cityTaxCost = 0
    const hotelName = String(hotel || '').trim().toUpperCase()
    if (hotelName && !hotelName.includes('SUNRISE')) {
      const inObj = parseExcelDate(inDate)
      const outObj = parseExcelDate(outDate)
      if (inObj && outObj) {
        const diffDays = Math.floor((outObj.getTime() - inObj.getTime()) / (1000 * 60 * 60 * 24))
        const nights = diffDays - 1
        if (nights > 0) cityTaxCost = nights * 2
      }
    }

    return { braceletCost, cityTaxCost }
  }

  const handleSave = async () => {
      if (!data) return
      setUploading(true)
      setProgress('Preparazione dati...')
      setError(null)

      try {
          setProgress('Creazione import...')
          const batchRes = await fetch('/api/taxes/import-batches', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName })
          })
          if (!batchRes.ok) {
            const errText = await batchRes.text()
            throw new Error(`Errore creazione import: ${errText}`)
          }
          const batchJson = await batchRes.json()
          const importBatchId = String(batchJson?.batch?.id || '')
          if (!importBatchId) throw new Error('Errore creazione import: batchId mancante')

          const allBookings = [...data.privati, ...data.agenzia]
          const BATCH_SIZE = 20 // Reduced from 50 to avoid timeouts
          const totalBatches = Math.ceil(allBookings.length / BATCH_SIZE)

          for (let i = 0; i < totalBatches; i++) {
              const start = i * BATCH_SIZE
              const end = start + BATCH_SIZE
              const batch = allBookings.slice(start, end).map(b => ({
                ...b,
                importBatchId
              }))
              
              setProgress(`Salvataggio batch ${i + 1} di ${totalBatches}...`)

              const response = await fetch('/api/taxes/bookings', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ bookings: batch })
              })
              
              if (!response.ok) {
                  const errText = await response.text()
                  throw new Error(`Errore nel salvataggio (Batch ${i + 1}): ${errText}`)
              }
          }
          
          setSuccess(true)
          setProgress('Completato!')
          setTimeout(() => {
              if (onSuccess) onSuccess()
              onClose()
              window.location.reload() // Refresh to show new data
          }, 1500)
      } catch (err: any) {
          console.error(err)
          setError(err.message || 'Errore durante il salvataggio dei dati')
      } finally {
          setUploading(false)
          setProgress('')
      }
  }

  // Helper to format Excel dates
  const formatDate = (cell: any) => {
    if (!cell) return ''
    if (typeof cell === 'number') {
        const date = new Date(Math.round((cell - 25569)*86400*1000));
        return date.toLocaleDateString('it-IT');
    }
    return cell
  }
  
  const parseExcelDate = (cell: any): Date | null => {
      if (!cell) return null
      if (cell instanceof Date && !isNaN(cell.getTime())) return cell
      if (typeof cell === 'number') {
          return new Date(Math.round((cell - 25569)*86400*1000));
      }
      // Try string parsing DD/MM/YYYY
      if (typeof cell === 'string') {
          const parts = cell.split('/')
          if (parts.length === 3) return new Date(parseInt(parts[2]), parseInt(parts[1])-1, parseInt(parts[0]))
          if (parts.length === 2) {
            const now = new Date()
            return new Date(now.getFullYear(), parseInt(parts[1]) - 1, parseInt(parts[0]))
          }
      }
      return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-7xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white rounded-t-2xl z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-green-600" />
              Importa Lista Arrivi
            </h2>
            <p className="text-sm text-gray-500">Carica il file Excel con la nuova struttura</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {!workbook ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all group"
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".xlsx, .xls"
                onChange={handleFileUpload}
              />
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Upload className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Clicca per caricare il file Excel</h3>
              <p className="text-gray-500 mt-2">Supporta formati .xlsx e .xls</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Info Bar */}
              <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-700 rounded-lg border border-blue-100 text-sm">
                <FileSpreadsheet className="w-4 h-4" />
                <span>Importazione da <strong>{workbook.SheetNames.length} fogli</strong> (Tutte le settimane)</span>
                {data && (
                    <span className="ml-2 font-bold text-green-700 bg-green-50 px-2 py-1 rounded border border-green-200">
                        Totale Trovati: {[...data.privati, ...data.agenzia].length} Prenotazioni
                    </span>
                )}
              </div>

              {/* Debug Toggle */}
              {data && (
                  <div className="flex flex-col gap-2 mb-4">
                    <div className="flex justify-end">
                        <button 
                            onClick={() => setShowDebug(!showDebug)}
                            className="text-xs text-gray-500 underline hover:text-gray-800 flex items-center gap-1"
                        >
                            <AlertCircle className="w-3 h-3" />
                            {showDebug ? 'Nascondi Dettagli Debug' : 'Mostra Dettagli Debug (Righe)'}
                        </button>
                    </div>

                    {/* Debug View */}
                    {showDebug && (
                        <div className="bg-gray-50 p-4 rounded-lg overflow-y-auto max-h-96 border border-gray-200 shadow-inner">
                            <h4 className="text-xs font-bold uppercase text-red-600 mb-2">RIGHE IGNORATE (Con Pax &gt; 0)</h4>
                            {data.skipped && data.skipped.length > 0 ? (
                                <table className="w-full mb-6 border-collapse border border-red-200 text-xs">
                                    <thead className="bg-red-50">
                                        <tr>
                                            <th className="border p-1">Riga</th>
                                            <th className="border p-1">Nome/Ref</th>
                                            <th className="border p-1">Pax (Col E)</th>
                                            <th className="border p-1">Col C</th>
                                            <th className="border p-1">Col D</th>
                                            <th className="border p-1">Motivo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.skipped.map((s, idx) => (
                                            <tr key={idx} className="hover:bg-red-50">
                                                <td className="border p-1 text-center">{s.rowIndex}</td>
                                                <td className="border p-1">{s.rawName}</td>
                                                <td className="border p-1 text-center font-bold">{s.pax}</td>
                                                <td className="border p-1 text-center">{String(s.rawC)}</td>
                                                <td className="border p-1 text-center">{String(s.rawD)}</td>
                                                <td className="border p-1 text-red-600">{s.reason}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <p className="mb-6 text-green-600 italic text-xs">Nessuna riga con Pax ignorata.</p>
                            )}

                            <h4 className="text-xs font-bold uppercase text-gray-500 mb-2">Log di Importazione (Totale: {[...data.privati, ...data.agenzia].length})</h4>
                            <table className="w-full text-xs text-left">
                                <thead className="bg-gray-100 text-gray-600 sticky top-0">
                                    <tr>
                                        <th className="p-2">Riga</th>
                                        <th className="p-2">N. File</th>
                                        <th className="p-2">Prov.</th>
                                        <th className="p-2">Serv.</th>
                                        <th className="p-2">Pax</th>
                                        <th className="p-2">Lead</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {[...data.privati, ...data.agenzia].sort((a,b) => a.rowIndex - b.rowIndex).map((b, idx) => (
                                        <tr key={idx} className="hover:bg-blue-50 transition-colors">
                                            <td className="p-2 font-mono text-gray-500">{b.rowIndex}</td>
                                            <td className="p-2 font-medium">{b.nFile}</td>
                                            <td className="p-2">{b.provenienza}</td>
                                            <td className="p-2">{b.serviceCode}</td>
                                            <td className="p-2">{b.pax}</td>
                                            <td className="p-2 text-gray-500 truncate max-w-[150px]">{b.leadName}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                  </div>
              )}

              {/* Data Display */}
              {data && (
                <div className="grid grid-cols-1 gap-8">
                  {/* Privati Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-purple-700 bg-purple-50 p-3 rounded-lg border border-purple-100">
                        <div className="flex items-center gap-2">
                            <Users className="w-5 h-5" />
                            <h3 className="font-bold text-lg">Privati ({data.privati.length} Prenotazioni, {data.privati.reduce((acc, x) => acc + x.pax, 0)} Pax)</h3>
                        </div>
                        <div className="text-sm font-medium">
                            Totale Stimato: € {data.privati.reduce((acc, x) => acc + x.totalAmount, 0)}
                        </div>
                    </div>
                    <ArrivalsTable data={data.privati} type="private" />
                  </div>

                  {/* Agenzia Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-orange-700 bg-orange-50 p-3 rounded-lg border border-orange-100">
                        <div className="flex items-center gap-2">
                            <Building2 className="w-5 h-5" />
                            <h3 className="font-bold text-lg">Agenzia ({data.agenzia.length} Prenotazioni, {data.agenzia.reduce((acc, x) => acc + x.pax, 0)} Pax)</h3>
                        </div>
                        <div className="text-sm font-medium">
                            Totale Stimato: € {data.agenzia.reduce((acc, x) => acc + x.totalAmount, 0)}
                        </div>
                    </div>
                    <ArrivalsTable data={data.agenzia} type="agency" />
                  </div>
                </div>
              )}
            </div>
          )}
          
          {error && (
              <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  {error}
              </div>
          )}
          
          {success && (
              <div className="mt-4 p-4 bg-green-50 text-green-600 rounded-lg flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Importazione completata con successo!
              </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 rounded-b-2xl flex justify-between items-center">
            {workbook && (
                <button 
                    onClick={() => {
                        setWorkbook(null)
                        setData(null)
                    }}
                    className="text-sm text-red-600 hover:text-red-700 font-medium"
                >
                    Resetta
                </button>
            )}
            <div className="flex gap-2">
                <button 
                    onClick={onClose}
                    className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                    Annulla
                </button>
                {data && (
                    <button 
                        onClick={handleSave}
                        disabled={uploading || success}
                        className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 min-w-[180px]"
                    >
                        {uploading ? (progress || 'Salvataggio...') : 'Conferma e Importa'}
                    </button>
                )}
            </div>
        </div>
      </div>
    </div>
  )
}

function ArrivalsTable({ data, type }: { data: TaxBookingData[], type: 'private' | 'agency' }) {
  if (data.length === 0) {
    return <p className="text-gray-500 italic text-center py-4">Nessun arrivo trovato per questa categoria.</p>
  }

  const grouped = (() => {
    const map = new Map<string, {
      week: string
      nFile: string
      leadName: string
      pax: number
      room: string
      minRowIndex: number
      amountBracelet: number
      amountCityTax: number
      amountDeposit: number
      totalAmount: number
      participants: any[]
    }>()

    for (const row of data) {
      const key = `${row.week}__${row.nFile}`.toUpperCase()
      const existing = map.get(key)
      const rawParticipants = row.participants || []

      const next = existing || {
        week: row.week,
        nFile: row.nFile,
        leadName: row.leadName,
        pax: row.pax,
        room: row.room,
        minRowIndex: row.rowIndex,
        amountBracelet: 0,
        amountCityTax: 0,
        amountDeposit: 0,
        totalAmount: 0,
        participants: rawParticipants,
      }

      next.leadName = next.leadName || row.leadName
      next.pax = Math.max(next.pax || 0, row.pax || 0)
      next.room = next.room || row.room
      next.minRowIndex = Math.min(next.minRowIndex, row.rowIndex)
      if (next.participants.length === 0 && rawParticipants.length > 0) next.participants = rawParticipants

      if (row.serviceCode === 4) next.amountDeposit += row.totalAmount || 0
      else if (row.serviceCode === 2) next.amountCityTax += row.totalAmount || 0
      else next.amountBracelet += row.totalAmount || 0

      next.totalAmount = next.amountBracelet + next.amountCityTax + next.amountDeposit
      map.set(key, next)
    }

    return Array.from(map.values()).sort((a, b) => a.minRowIndex - b.minRowIndex)
  })()

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm max-h-96">
      <table className="w-full text-sm text-left">
        <thead className={`text-xs uppercase sticky top-0 z-10 ${type === 'private' ? 'bg-purple-50 text-purple-700' : 'bg-orange-50 text-orange-700'}`}>
          <tr>
            <th className="px-4 py-3 font-bold">N File</th>
            <th className="px-4 py-3 font-bold">Capogruppo</th>
            <th className="px-4 py-3 font-bold text-center">Pax</th>
            <th className="px-4 py-3 font-bold text-right">Braccialetto</th>
            <th className="px-4 py-3 font-bold text-right">Tassa</th>
            <th className="px-4 py-3 font-bold text-right">Cauzione</th>
            <th className="px-4 py-3 font-bold text-right">Totale</th>
            <th className="px-4 py-3 font-bold">Alloggio</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {grouped.map((row, idx) => (
            <tr key={idx} className="bg-white hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 font-mono text-gray-500">{row.nFile}</td>
              <td className="px-4 py-3">
                <div className="font-bold text-gray-900">{row.leadName}</div>
                <div className="text-xs text-gray-500">
                    {row.participants?.slice(1).map(p => p.firstName).join(', ')}
                </div>
              </td>
              <td className="px-4 py-3 text-center font-medium">{row.pax}</td>
              <td className="px-4 py-3 text-right font-bold text-gray-900">€ {row.amountBracelet.toFixed(2)}</td>
              <td className="px-4 py-3 text-right font-bold text-gray-900">€ {row.amountCityTax.toFixed(2)}</td>
              <td className="px-4 py-3 text-right font-bold text-gray-900">€ {row.amountDeposit.toFixed(2)}</td>
              <td className="px-4 py-3 text-right font-bold text-gray-900">€ {row.totalAmount.toFixed(2)}</td>
              <td className="px-4 py-3 text-gray-600 truncate max-w-xs">{row.room}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
