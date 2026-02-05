'use client'

import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { Upload, FileSpreadsheet, X, Users, Building2, Calendar, FileText } from 'lucide-react'

interface ArrivalData {
  nFile: string
  adv: string
  type: number // 0 = Privato, 1 = Agenzia
  pax: number
  lastName: string
  firstName: string
  birthDate: string
  flightInfo: string
  hotel: string
  roomType: string
  checkIn: string
  checkOut: string
  transfer: string
  car: string
  phone: string
  notes: string
}

interface GroupedData {
  privati: ArrivalData[]
  agenzia: ArrivalData[]
}

export function ArrivalsImportModal({ onClose }: { onClose: () => void }) {
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null)
  const [sheets, setSheets] = useState<string[]>([])
  const [selectedSheet, setSelectedSheet] = useState<string>('')
  const [data, setData] = useState<GroupedData | null>(null)
  const [loading, setLoading] = useState(false)
  const [fileName, setFileName] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setFileName(file.name)
    const reader = new FileReader()

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        setWorkbook(wb)
        setSheets(wb.SheetNames)
        // Auto-select first sheet or let user choose? 
        // User said "read a determined sheet". We'll let them choose.
        if (wb.SheetNames.length > 0) {
           handleSheetSelect(wb.SheetNames[wb.SheetNames.length - 1], wb) // Default to latest (last) sheet?
        }
      } catch (error) {
        console.error('Error reading file:', error)
        alert('Errore nella lettura del file Excel')
      } finally {
        setLoading(false)
      }
    }

    reader.readAsBinaryString(file)
  }

  const handleSheetSelect = (sheetName: string, wbInstance = workbook) => {
    if (!wbInstance) return
    setSelectedSheet(sheetName)
    parseSheet(sheetName, wbInstance)
  }

  const parseSheet = (sheetName: string, wb: XLSX.WorkBook) => {
    const ws = wb.Sheets[sheetName]
    // Get all data as array of arrays
    const jsonData = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 })
    
    // Process data
    // Assumption based on user request:
    // Col A (0): N FILE
    // Col B (1): ADV
    // Col C (2): LEGENDA (0=Priv, 1=Ag)
    // Col D (3): N. PAX
    // Col E (4): LAST NAME
    // Col F (5): FIRST NAME
    // Col G (6): BIRTH DATE
    // ...
    
    const privati: ArrivalData[] = []
    const agenzia: ArrivalData[] = []

    // Start from row 4 (index 3) based on image, but let's be safe and iterate
    // finding rows that look like data.
    // Updated logic based on new screenshot
    // Headers are on Row 1 (Index 0). Data starts Row 3 or 4.
    // Columns:
    // A(0): N FILE
    // B(1): ADV
    // C(2): LEGENDA (0=Priv, 1=Ag)
    // D(3): N. PAX
    // E(4): LAST NAME
    // F(5): FIRST NAME
    // G(6): BIRTH DATE
    // H(7): FLIGHT DATE
    // I(8): NR VOLO
    // J(9): COMPANY
    // K(10): FROM
    // L(11): TO
    // M(12): DEPT TIME
    // N(13): ARRIV TIME
    // O(14): HOTEL/APARTMENT
    // P(15): ROOM TYPE
    // Q(16): TRAT
    // R(17): IN
    // S(18): OUT
    // T(19): TRF
    // U(20): CAR
    // V(21): TELEFONO
    // W(22): NOTE

    const START_ROW_INDEX = 2 // Start scanning from Row 3 (Index 2) to be safe

    for (let i = START_ROW_INDEX; i < jsonData.length; i++) {
      const row = jsonData[i]
      if (!row) continue

      // We identify a new booking/entry by the presence of "N FILE" (Col A/0)
      const nFile = row[0]
      if (!nFile) continue 

      // Skip header row if it was caught (checks if N FILE is "N FILE")
      if (String(nFile).toUpperCase().includes('FILE')) continue

      // Look for Legenda (Col C/2). 
      // Sometimes it's on the same row, sometimes on the next row (e.g., merged cells).
      let type = parseInt(row[2])
      
      // If type is NaN (empty in this row), check the next row
      if (isNaN(type) && i + 1 < jsonData.length) {
         const nextRow = jsonData[i + 1]
         if (nextRow) {
             const nextType = parseInt(nextRow[2])
             if (!isNaN(nextType)) {
                 type = nextType
             }
         }
      }

      // Default to 0 (Private) if still not found
      if (isNaN(type)) type = 0

      // Flight Info Construction
      // Date(7) + Volo(8) + Company(9) + From(10) + To(11) + Time(12/13)
      const flightDate = formatDate(row[7])
      const flightNr = row[8] || ''
      const flightCo = row[9] || ''
      const flightFrom = row[10] || ''
      const flightTo = row[11] || ''
      const flightTime = row[13] || row[12] || '' // Arrival or Dept time
      
      const flightInfo = [flightDate, flightNr, flightCo, flightFrom ? `(${flightFrom}-${flightTo})` : '', flightTime]
        .filter(Boolean).join(' ')

      const item: ArrivalData = {
        nFile: String(nFile),
        adv: row[1] || '', // ADV might also be on next row, but usually primary row has it or it's irrelevant if NFile is key
        type: type,
        pax: parseInt(row[3]) || 0,
        lastName: row[4] || '',
        firstName: row[5] || '',
        birthDate: formatDate(row[6]), 
        flightInfo: flightInfo,
        hotel: row[14] || '', 
        roomType: row[15] || '',
        checkIn: formatDate(row[17]), 
        checkOut: formatDate(row[18]), 
        transfer: row[19] || '', 
        car: row[20] || '', 
        phone: row[21] || '', 
        notes: row[22] || '' 
      }

      if (item.type === 1) {
        agenzia.push(item)
      } else {
        privati.push(item)
      }
    }

    setData({ privati, agenzia })
  }

  // Helper to format Excel dates
  const formatDate = (cell: any) => {
    if (!cell) return ''
    // If it's a number (Excel date), convert it
    if (typeof cell === 'number') {
        const date = new Date(Math.round((cell - 25569)*86400*1000));
        return date.toLocaleDateString('it-IT');
    }
    return cell
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
            <p className="text-sm text-gray-500">Carica il file Excel degli arrivi settimanali</p>
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
              {/* Sheet Selector */}
              <div className="flex items-center gap-4 overflow-x-auto pb-2 border-b">
                <span className="text-sm font-medium text-gray-500 whitespace-nowrap">Seleziona Settimana:</span>
                <div className="flex gap-2">
                  {sheets.map(sheet => (
                    <button
                      key={sheet}
                      onClick={() => handleSheetSelect(sheet)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                        selectedSheet === sheet 
                          ? 'bg-blue-600 text-white shadow-md' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {sheet}
                    </button>
                  ))}
                </div>
              </div>

              {/* Data Display */}
              {data && (
                <div className="grid grid-cols-1 gap-8">
                  {/* Privati Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-purple-700 bg-purple-50 p-3 rounded-lg border border-purple-100">
                      <Users className="w-5 h-5" />
                      <h3 className="font-bold text-lg">Clienti Privati ({data.privati.length})</h3>
                    </div>
                    <ArrivalsTable data={data.privati} type="private" />
                  </div>

                  {/* Agenzia Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-orange-700 bg-orange-50 p-3 rounded-lg border border-orange-100">
                      <Building2 className="w-5 h-5" />
                      <h3 className="font-bold text-lg">Clienti Agenzia ({data.agenzia.length})</h3>
                    </div>
                    <ArrivalsTable data={data.agenzia} type="agency" />
                  </div>
                </div>
              )}
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
                        setSelectedSheet('')
                    }}
                    className="text-sm text-red-600 hover:text-red-700 font-medium"
                >
                    Resetta e carica nuovo file
                </button>
            )}
            <button 
                onClick={onClose}
                className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
            >
                Chiudi
            </button>
        </div>
      </div>
    </div>
  )
}

function ArrivalsTable({ data, type }: { data: ArrivalData[], type: 'private' | 'agency' }) {
  if (data.length === 0) {
    return <p className="text-gray-500 italic text-center py-4">Nessun arrivo trovato per questa categoria.</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
      <table className="w-full text-sm text-left">
        <thead className={`text-xs uppercase ${type === 'private' ? 'bg-purple-50 text-purple-700' : 'bg-orange-50 text-orange-700'}`}>
          <tr>
            <th className="px-4 py-3 font-bold">N File</th>
            <th className="px-4 py-3 font-bold">Nominativo</th>
            <th className="px-4 py-3 font-bold text-center">Pax</th>
            <th className="px-4 py-3 font-bold">Data Nascita</th>
            <th className="px-4 py-3 font-bold">Check-In/Out</th>
            <th className="px-4 py-3 font-bold">Alloggio</th>
            <th className="px-4 py-3 font-bold">Note</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((row, idx) => (
            <tr key={idx} className="bg-white hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 font-mono text-gray-500">{row.nFile}</td>
              <td className="px-4 py-3">
                <div className="font-bold text-gray-900">{row.lastName} {row.firstName}</div>
                {row.adv && <div className="text-xs text-gray-500">{row.adv}</div>}
              </td>
              <td className="px-4 py-3 text-center font-medium">{row.pax}</td>
              <td className="px-4 py-3 text-gray-600">{row.birthDate}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1 text-gray-900">
                  <Calendar className="w-3 h-3 text-gray-400" />
                  {row.checkIn} - {row.checkOut}
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="font-medium text-gray-800">{row.hotel}</div>
                <div className="text-xs text-gray-500">{row.roomType}</div>
              </td>
              <td className="px-4 py-3 text-gray-500 italic max-w-xs truncate" title={row.notes}>
                {row.notes}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
