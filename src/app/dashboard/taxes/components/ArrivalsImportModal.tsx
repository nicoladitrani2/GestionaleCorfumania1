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
                // Key matches Prisma constraint: nFile + week
                const key = `${item.nFile}__${item.week}`.toUpperCase()
                
                if (seenKeys.has(key)) {
                    // Duplicate found!
                    const originalNFile = item.nFile
                    // Append suffix to make it unique
                    item.nFile = `${item.nFile}_DUP${Math.floor(Math.random() * 10000)}`
                    console.warn(`Duplicate booking detected: ${originalNFile} (${item.week}). Renamed to ${item.nFile}`)
                    
                    // Add the NEW key to seen
                    seenKeys.add(`${item.nFile}__${item.week}`.toUpperCase())
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

    // A(0): N FILE
    // B(1): ADV / NOME AGENZIA
    // C(2): PROVENIENZA (1=Privato, 2=Agenzia)
    // D(3): CODICE SERVIZIO (1=Brac, 2=Tax, 3=Both)
    // E(4): N. PAX
    // F(5): LAST NAME (Lead / Pax)
    // G(6): FIRST NAME

    const START_ROW_INDEX = 2 

    let currentBooking: TaxBookingData | null = null;

    for (let i = START_ROW_INDEX; i < jsonData.length; i++) {
        const row = jsonData[i]
        if (!row || row.length === 0) continue

        // STRICT RULE: New Booking STARTS if and only if Column C (Index 2) AND Column D (Index 3) have valid values
        // C: Provenienza (1 or 2)
        // D: Service Code (1, 2, or 3)
        const rawProv = row[2]
        const rawService = row[3]
        const leadNameCheck = String(row[1] || '').toUpperCase()
        
        // Skip TOTAL rows or Summary rows
        if (leadNameCheck.includes('TOTALE') || leadNameCheck.includes('RIEPILOGO')) continue

        let isNewBooking = false
        let provenienzaCode = 0
        let serviceCode = 0

        if (rawProv !== undefined && rawProv !== null && rawProv !== '' &&
            rawService !== undefined && rawService !== null && rawService !== '') {
            
            const parsedProv = parseInt(rawProv)
            const parsedService = parseInt(rawService)

            if (!isNaN(parsedProv) && (parsedProv === 1 || parsedProv === 2) &&
                !isNaN(parsedService) && [1, 2, 3].includes(parsedService)) {
                
                isNewBooking = true
                provenienzaCode = parsedProv
                serviceCode = parsedService
            }
        }

        if (isNewBooking) {
            // 1. Close previous booking if exists
            if (currentBooking) {
                // Calculate cost using KNOWN participants AND Stated Pax to handle ghosts
                const { totalAmount, pax } = calculateBookingCost(
                    currentBooking.participants, 
                    currentBooking.serviceCode,
                    currentBooking.pax // Pass the stated pax from Excel
                )
                currentBooking.totalAmount = totalAmount
                // Ensure currentBooking.pax reflects the MAX count
                currentBooking.pax = pax
                
                // Update rawData with latest participants list
                try {
                    const existingRaw = JSON.parse(currentBooking.rawData || '{}')
                    existingRaw.participants = currentBooking.participants
                    currentBooking.rawData = JSON.stringify(existingRaw)
                } catch (e) {
                    console.error('Error updating rawData', e)
                }
                
                // ONLY add if there is at least 1 pax or 1 participant
                if (currentBooking.pax > 0) {
                    // Ensure unique nFile for Agency bookings if missing or generic
                    if (currentBooking.provenienza === 'AGENZIA') {
                        if (!currentBooking.nFile || currentBooking.nFile === currentBooking.week || currentBooking.nFile.length < 3) {
                            currentBooking.nFile = `AGENCY_${currentBooking.week.replace(/\s+/g, '')}_ROW${currentBooking.rowIndex}`
                        }
                        agenzia.push(currentBooking)
                    } else {
                        // FIX: Ensure unique nFile for Private bookings too if missing
                        if (!currentBooking.nFile) {
                             currentBooking.nFile = `PRIV_${currentBooking.week.replace(/\s+/g, '')}_ROW${currentBooking.rowIndex}`
                        }
                        privati.push(currentBooking)
                    }
                }
            }

            // 2. Start NEW Booking
            let nFile = String(row[0] || '').trim()
            // FIX: If nFile is missing in Excel, generate a temporary one immediately
            // This prevents "Skipping booking with missing nFile" warning later
            if (!nFile) {
                 // Use row index and type to create unique ID
                 const prefix = provenienzaCode === 2 ? 'AGENCY' : 'PRIV'
                 nFile = `${prefix}_${sheetName.replace(/\s+/g, '')}_ROW${i + 1}`
            }

            // serviceCode is already parsed and validated above
            const statedPax = parseInt(row[4]) || 0
            const room = row[15] || ''
            const flightInfo = `${formatDate(row[8]) || ''} ${row[9] || ''}`
            
            // Extract Booking Name / Lead Name from Column B (Left of C)
            // User instruction: "vedi il numero nella colonna C e prendi come prenotazione ciò che sta scritto a sinistra"
            // "A sinistra" of C(2) is B(1) [ADV/NAME].
            let leadName = String(row[1] || '').trim()

            // Extract first passenger (Lead)
            const participants = []
            
            if (row[5]) { // Last Name present in header row
                participants.push({
                    lastName: row[5],
                    firstName: row[6],
                    birthDate: row[7],
                })
            }

            // Fallback if Col B was empty
            if (!leadName) {
                if (participants.length > 0) {
                     leadName = `${participants[0].lastName} ${participants[0].firstName}`
                } else {
                     leadName = 'Unknown' 
                }
            }

            currentBooking = {
                rowIndex: i + 1,
                nFile: nFile, 
                week: sheetName,
                provenienza: provenienzaCode === 2 ? 'AGENZIA' : 'PRIVATO',
                serviceCode: serviceCode,
                pax: statedPax, 
                leadName: leadName,
                room: room,
                totalAmount: 0, 
                // Store flight info AND participants in rawData
                rawData: JSON.stringify({ flightInfo, participants }),
                participants: participants
            }
        } else {
            // Continuation of current booking?
            if (currentBooking) {
                // DO NOT ACUMULATE PAX blindly. Trust the first row or the participants count.
                // const extraPax = parseInt(row[4]) || 0
                // currentBooking.pax += extraPax

                // Check if it has passenger data (Col F/5)
                if (row[5]) {
                    currentBooking.participants?.push({
                        lastName: row[5],
                        firstName: row[6],
                        birthDate: row[7],
                    })
                    
                    // Increment PAX count for each actual participant found in continuation rows
                    // User instruction: "il numero dei pax devono essere considerati solo quelli che hanno la corrispondente colonna C e D successivamente si vanno a contare nella colonna E"
                    // However, user also said "ovviamente il numero dei pax devono essere considerati solo quelli che hanno la corrispondente colonna C e D"
                    // And then "successivamente si vanno a contare nella colonna E"
                    
                    // The most robust way based on "si vanno a contare nella colonna E" IF they don't have C/D
                    // But usually E is empty on continuation rows or has 1.
                    // Let's increment based on finding a person.
                    
                    // Actually, let's recalculate total pax based on participants array length at the end.
                    // This is handled in the "Close previous booking" and "Close last booking" blocks:
                    // if (pax > 0) currentBooking.pax = pax; (where pax is participants.length)
                    
                    // So we don't need to manually increment currentBooking.pax here, 
                    // because it will be overwritten by the count of participants array.
                    
                    // If Lead Name was temporary (e.g. Agency Name or Unknown) and we found a real person, update it?
                    // Optional: keep Agency Name as Lead for Agency bookings? 
                    // Usually user prefers the actual person name if available.
                    // Let's stick to the first person found if current lead is "Unknown".
                    if (currentBooking.leadName === 'Unknown') {
                        currentBooking.leadName = `${row[5]} ${row[6]}`
                    }
                    // If it was Agency Name, keep it? Or switch to pax? 
                    // Let's keep Agency Name if it was set from Col B, it's useful.
                }
            } else {
                // Orphaned row logic (Skipped)
                const potentialPax = parseInt(row[4]) || 0
                if (potentialPax > 0 && !leadNameCheck.includes('TOTALE') && !leadNameCheck.includes('RIEPILOGO')) {
                    skipped.push({
                        rowIndex: i + 1,
                        reason: 'Pax > 0 ma mancano codici C o D validi',
                        pax: potentialPax,
                        rawC: rawProv,
                        rawD: rawService,
                        rawE: row[4],
                        rawName: row[1] || row[5] || '???'
                    })
                }
            }
        }
    }

    // Close the last booking
    if (currentBooking) {
         const { totalAmount, pax } = calculateBookingCost(
             currentBooking.participants || [], 
             currentBooking.serviceCode,
             currentBooking.pax // Pass stated pax
         )
         currentBooking.totalAmount = totalAmount
         currentBooking.pax = pax

         // Update rawData with latest participants list
         try {
             const existingRaw = JSON.parse(currentBooking.rawData || '{}')
             existingRaw.participants = currentBooking.participants
             currentBooking.rawData = JSON.stringify(existingRaw)
         } catch (e) {
             console.error('Error updating rawData', e)
         }

         if (currentBooking.pax > 0) {
             if (currentBooking.provenienza === 'AGENZIA') {
                if (!currentBooking.nFile || currentBooking.nFile === currentBooking.week || currentBooking.nFile.length < 3) {
                    currentBooking.nFile = `AGENCY_${currentBooking.week.replace(/\s+/g, '')}_ROW${currentBooking.rowIndex}`
                }
                agenzia.push(currentBooking)
            } else {
                // FIX: Ensure unique nFile for Private bookings too if missing
                if (!currentBooking.nFile) {
                        currentBooking.nFile = `PRIV_${currentBooking.week.replace(/\s+/g, '')}_ROW${currentBooking.rowIndex}`
                }
                privati.push(currentBooking)
            }
         }
    }
    
    return { privati, agenzia, skipped }
  }

  const calculateBookingCost = (participants: any[], serviceCode: number, statedPax: number = 0) => {
      let braceletCost = 0
      const knownPaxCount = participants.length
      
      if (serviceCode === 1 || serviceCode === 3) {
          // 1. Calculate for KNOWN participants (where we might know age)
          participants.forEach(p => {
              let isChild = false
              if (p.birthDate) {
                  const birthDateObj = parseExcelDate(p.birthDate)
                  if (birthDateObj) {
                      const age = new Date().getFullYear() - birthDateObj.getFullYear()
                      if (age < 12) isChild = true
                  }
              }
              braceletCost += isChild ? 5 : 10
          })

          // 2. Handle "Ghost" participants (Stated Pax > Known Names)
          // If Excel says 4 Pax but we only have 2 names, we must charge for the other 2.
          // Since we don't know their age, we assume Standard Adult Price (10€) to avoid revenue loss.
          if (statedPax > knownPaxCount) {
              const diff = statedPax - knownPaxCount
              braceletCost += diff * 10 
          }
      }
      
      let taxCost = 0
      if (serviceCode === 2 || serviceCode === 3) {
          taxCost = 2 // Fixed cost per Booking (Room)
      }
      
      // Return total amount and the pax count
      // STRICT RULE: Use statedPax from Excel Column E if available (>0)
      // User instruction: "il numero dei pax deve essere totale alla somma della colonna E"
      const finalPax = statedPax > 0 ? statedPax : knownPaxCount

      return { 
          totalAmount: braceletCost + taxCost, 
          pax: finalPax
      }
  }

  const handleSave = async () => {
      if (!data) return
      setUploading(true)
      setProgress('Preparazione dati...')
      setError(null)

      try {
          const allBookings = [...data.privati, ...data.agenzia]
          const BATCH_SIZE = 20 // Reduced from 50 to avoid timeouts
          const totalBatches = Math.ceil(allBookings.length / BATCH_SIZE)

          for (let i = 0; i < totalBatches; i++) {
              const start = i * BATCH_SIZE
              const end = start + BATCH_SIZE
              const batch = allBookings.slice(start, end)
              
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
      if (typeof cell === 'number') {
          return new Date(Math.round((cell - 25569)*86400*1000));
      }
      // Try string parsing DD/MM/YYYY
      if (typeof cell === 'string') {
          const parts = cell.split('/')
          if (parts.length === 3) return new Date(parseInt(parts[2]), parseInt(parts[1])-1, parseInt(parts[0]))
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

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm max-h-96">
      <table className="w-full text-sm text-left">
        <thead className={`text-xs uppercase sticky top-0 z-10 ${type === 'private' ? 'bg-purple-50 text-purple-700' : 'bg-orange-50 text-orange-700'}`}>
          <tr>
            <th className="px-4 py-3 font-bold">N File</th>
            <th className="px-4 py-3 font-bold">Capogruppo</th>
            <th className="px-4 py-3 font-bold text-center">Pax</th>
            <th className="px-4 py-3 font-bold text-center">Cod. Serv.</th>
            <th className="px-4 py-3 font-bold text-right">Totale</th>
            <th className="px-4 py-3 font-bold">Alloggio</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((row, idx) => (
            <tr key={idx} className="bg-white hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 font-mono text-gray-500">{row.nFile}</td>
              <td className="px-4 py-3">
                <div className="font-bold text-gray-900">{row.leadName}</div>
                <div className="text-xs text-gray-500">
                    {row.participants?.slice(1).map(p => p.firstName).join(', ')}
                </div>
              </td>
              <td className="px-4 py-3 text-center font-medium">{row.pax}</td>
              <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                      row.serviceCode === 3 ? 'bg-blue-100 text-blue-700' : 
                      row.serviceCode === 2 ? 'bg-yellow-100 text-yellow-700' : 
                      'bg-green-100 text-green-700'
                  }`}>
                      {row.serviceCode === 1 ? 'Brac' : row.serviceCode === 2 ? 'Tax' : 'All'}
                  </span>
              </td>
              <td className="px-4 py-3 text-right font-bold text-gray-900">€ {row.totalAmount}</td>
              <td className="px-4 py-3 text-gray-600 truncate max-w-xs">{row.room}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
