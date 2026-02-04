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
    // A valid row should probably have a Last Name or N File.
    
    // Find header row or just skip fixed amount?
    // Image shows headers on Row 1. Data starts Row 4.
    const START_ROW_INDEX = 3 

    for (let i = START_ROW_INDEX; i < jsonData.length; i++) {
      const row = jsonData[i]
      if (!row || row.length === 0) continue

      // Basic validation: Check if Last Name (Index 4) exists
      if (!row[4]) continue 

      const type = parseInt(row[2]) // Column C
      
      const item: ArrivalData = {
        nFile: row[0] || '',
        adv: row[1] || '',
        type: isNaN(type) ? 0 : type, // Default to 0 if missing/invalid?
        pax: parseInt(row[3]) || 0,
        lastName: row[4] || '',
        firstName: row[5] || '',
        birthDate: formatDate(row[6]),
        flightInfo: `${row[7] || ''} ${row[8] || ''} ${row[9] || ''}`, // Date + Volo + Company
        hotel: row[14] || '', // Adjusted index based on shift?
        // Let's re-verify indexes if Col C is inserted.
        // Orig: Hotel was N (13). New: O (14). Correct.
        roomType: row[15] || '',
        checkIn: formatDate(row[17]), // R (17)
        checkOut: formatDate(row[18]), // S (18)
        transfer: row[19] || '', // T (19)
        car: row[20] || '', // U (20)
        phone: row[21] || '', // V (21)
        notes: row[row.length - 1] || '' // Last column
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
