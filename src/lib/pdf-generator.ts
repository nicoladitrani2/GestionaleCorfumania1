import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface ParticipantData {
  firstName: string
  lastName: string
  nationality: string
  docType: string
  docNumber: string
  phoneNumber?: string
  email?: string
  price: number
  deposit: number
  paymentType: 'DEPOSIT' | 'BALANCE'
  groupSize: number
  isOption: boolean
  notes?: string
  createdBy?: {
    code: string
    firstName: string
    lastName: string
  }
}

interface ExcursionData {
  name: string
  date: string | Date
  departureTime?: string
  meetingPoint?: string
}

export const generateParticipantPDF = (participant: ParticipantData, excursion: ExcursionData): jsPDF => {
  const doc = new jsPDF()

  // --- Header ---
  // Background for header
  doc.setFillColor(249, 250, 251) // gray-50
  doc.rect(0, 0, 210, 40, 'F')
  
  // Title
  doc.setTextColor(31, 41, 55) // gray-800
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('Dettagli Partecipante', 20, 20)
  
  // Subtitle
  doc.setFontSize(10)
  doc.setTextColor(107, 114, 128) // gray-500
  doc.setFont('helvetica', 'normal')
  const dateStr = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
  doc.text(`Generato il ${dateStr}`, 20, 28)

  // Status Badge Logic (Simulated with text/color)
  let statusText = ''
  let statusColor = [0, 0, 0]
  
  if (participant.isOption) {
    statusText = 'OPZIONE'
    statusColor = [220, 38, 38] // red-600
  } else if (participant.paymentType === 'BALANCE') {
    statusText = 'SALDATO'
    statusColor = [22, 163, 74] // green-600
  } else {
    statusText = 'ACCONTO'
    statusColor = [234, 88, 12] // orange-600
  }

  // Draw Status Badge
  doc.setDrawColor(statusColor[0], statusColor[1], statusColor[2])
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(160, 12, 30, 10, 2, 2, 'FD')
  doc.setTextColor(statusColor[0], statusColor[1], statusColor[2])
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text(statusText, 175, 18, { align: 'center' })

  let yPos = 50

  // --- Excursion Section ---
  doc.setDrawColor(229, 231, 235) // gray-200
  doc.setFillColor(243, 244, 246) // gray-100
  doc.roundedRect(20, yPos, 170, 35, 3, 3, 'FD')
  
  doc.setTextColor(55, 65, 81) // gray-700
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(excursion.name, 30, yPos + 12)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const excDate = new Date(excursion.date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  doc.text(excDate.charAt(0).toUpperCase() + excDate.slice(1), 30, yPos + 20)

  // --- Participant Details ---
  yPos += 45
  doc.setTextColor(17, 24, 39) // gray-900
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Informazioni Personali', 20, yPos)
  
  yPos += 5
  
  const details = [
    ['Nome e Cognome', `${participant.firstName} ${participant.lastName}`],
    ['Nazionalità', participant.nationality],
    ['Documento', `${participant.docType} - ${participant.docNumber}`],
    ['Telefono', participant.phoneNumber || '-'],
    ['Email', participant.email || '-'],
    ['Numero Partecipanti', participant.groupSize.toString()],
    ['Note', participant.notes || '-']
  ]

  // Use autoTable for clean alignment
  autoTable(doc, {
    startY: yPos,
    head: [],
    body: details,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: [107, 114, 128], cellWidth: 60 },
      1: { textColor: [17, 24, 39] }
    },
    margin: { left: 20 }
  })

  yPos = (doc as any).lastAutoTable.finalY + 15

  // --- Payment Section ---
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 24, 39)
  doc.text('Riepilogo Pagamento', 20, yPos)

  yPos += 5

  const paymentDetails = [
    ['Prezzo Totale', `€ ${participant.price.toFixed(2)}`],
    ['Acconto Versato', `€ ${participant.deposit.toFixed(2)}`],
    ['Rimanente da Saldare', `€ ${(participant.price - participant.deposit).toFixed(2)}`]
  ]

  autoTable(doc, {
    startY: yPos,
    head: [],
    body: paymentDetails,
    theme: 'grid',
    headStyles: { fillColor: [249, 250, 251], textColor: [107, 114, 128] },
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: [55, 65, 81] },
      1: { halign: 'right', fontStyle: 'bold', textColor: [17, 24, 39] }
    },
    margin: { left: 20, right: 100 } // Limit width
  })
  
  // Footer
  const footerY = 280
  doc.setFontSize(8)
  doc.setTextColor(156, 163, 175)
  doc.text('Corfumania - Gestionale Escursioni', 105, footerY, { align: 'center' })
  
  return doc
}
