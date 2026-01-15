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
  paymentMethod?: string // Legacy or fallback
  depositPaymentMethod?: string
  balancePaymentMethod?: string
  groupSize: number
  isOption: boolean
  notes?: string
  createdBy?: {
    code: string
    firstName: string
    lastName: string
  }
}

interface TransferData {
  type: 'TRANSFER'
  name: string
  date: string | Date
  pickupLocation?: string
  dropoffLocation?: string
  pickupTime?: string
  returnDate?: string | Date
  returnTime?: string
  returnPickupLocation?: string
}

interface ExcursionData {
  type?: 'EXCURSION' // Optional for backward compatibility, defaults to EXCURSION if undefined
  name: string
  date: string | Date
  departureTime?: string
  meetingPoint?: string
}

export const generateParticipantPDF = (participant: ParticipantData, event: ExcursionData | TransferData): jsPDF => {
  const doc = new jsPDF()

  // --- Header ---
  // Background for header
  doc.setFillColor(249, 250, 251) // gray-50
  doc.rect(0, 0, 210, 40, 'F')
  
  // Title
  doc.setTextColor(31, 41, 55) // gray-800
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('Dettagli Prenotazione', 20, 20)
  
  // Subtitle
  doc.setFontSize(10)
  doc.setTextColor(107, 114, 128) // gray-500
  doc.setFont('helvetica', 'normal')
  const dateStr = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
  doc.text(`Generato il ${dateStr}`, 20, 28)

  // Status Badge Logic (Simulated with text/color)
  let statusText = ''
  let statusColor = [0, 0, 0]
  
  if (participant.paymentType === 'REFUNDED') {
    statusText = 'RIMBORSATO'
    statusColor = [156, 163, 175] // gray-400
  } else if (participant.paymentType === 'CANCELLED') {
    statusText = 'CANCELLATO'
    statusColor = [220, 38, 38] // red-600
  } else if (participant.isOption) {
    statusText = 'NON PAGATO'
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

  // --- Event Section ---
  doc.setDrawColor(229, 231, 235) // gray-200
  doc.setFillColor(243, 244, 246) // gray-100
  
  // Determine if it's a Transfer or Excursion
  const isTransfer = (event as any).type === 'TRANSFER'
  const isRental = (event as any).type === 'RENTAL'

  if (isRental) {
    const rental = event as RentalData
    // Taller box for rental details
    doc.roundedRect(20, yPos, 170, 50, 3, 3, 'FD') 
    
    doc.setTextColor(55, 65, 81) // gray-700
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(rental.name, 30, yPos + 12)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    
    const rentalDate = new Date(rental.date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    doc.text(`Data Inizio: ${rentalDate.charAt(0).toUpperCase() + rentalDate.slice(1)}`, 30, yPos + 20)
    
    // Pickup / Dropoff details
    doc.setFont('helvetica', 'bold')
    doc.text('Ritiro:', 30, yPos + 30)
    doc.text('Consegna:', 30, yPos + 38)
    
    doc.setFont('helvetica', 'normal')
    doc.text(rental.pickupLocation || '-', 50, yPos + 30)
    doc.text(rental.dropoffLocation || '-', 60, yPos + 38)
    
    yPos += 15 // Adjust yPos for next section
  } else if (isTransfer) {
    const transfer = event as TransferData
    // Taller box for transfer details
    doc.roundedRect(20, yPos, 170, 50, 3, 3, 'FD') 
    
    doc.setTextColor(55, 65, 81) // gray-700
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(transfer.name, 30, yPos + 12)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    
    const transferDate = new Date(transfer.date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    doc.text(`Data: ${transferDate.charAt(0).toUpperCase() + transferDate.slice(1)}`, 30, yPos + 20)
    
    if (transfer.pickupTime) {
      doc.text(`Ora Ritiro: ${transfer.pickupTime}`, 120, yPos + 20)
    }

    // Pickup / Dropoff details
    doc.setFont('helvetica', 'bold')
    doc.text('Ritiro:', 30, yPos + 30)
    doc.text('Destinazione:', 30, yPos + 38)
    
    doc.setFont('helvetica', 'normal')
    doc.text(transfer.pickupLocation || '-', 50, yPos + 30)
    doc.text(transfer.dropoffLocation || '-', 60, yPos + 38)
    
    // Return Info if present
    if (transfer.returnDate) {
       const retDate = new Date(transfer.returnDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'numeric' })
       let retText = `Ritorno: ${retDate}`
       if (transfer.returnTime) retText += ` ore ${transfer.returnTime}`
       if (transfer.returnPickupLocation) retText += ` da ${transfer.returnPickupLocation}`
       
       doc.text(retText, 30, yPos + 46)
    }

    yPos += 15 // Adjust yPos for next section
  } else {
    // Excursion Logic (Standard)
    const excursion = event as ExcursionData
    doc.roundedRect(20, yPos, 170, 35, 3, 3, 'FD')
    
    doc.setTextColor(55, 65, 81) // gray-700
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(excursion.name, 30, yPos + 12)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    
    let excDate = '-'
    try {
      if (excursion.date && !isNaN(new Date(excursion.date).getTime())) {
        const date = new Date(excursion.date)
        const dateStr = date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        excDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1)
      }
    } catch (e) { console.error('Excursion date parsing error', e) }
    
    doc.text(excDate, 30, yPos + 20)
    
    if (excursion.meetingPoint) {
        doc.text(`Punto di incontro: ${excursion.meetingPoint}`, 30, yPos + 28)
    }
  }

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

  // Add Payment Methods Details
  const paymentMethodMap: Record<string, string> = {
    'CASH': 'Contanti',
    'TRANSFER': 'Bonifico',
    'CARD': 'Carta'
  }

  const translateMethod = (method?: string) => {
    if (!method) return '-';
    return paymentMethodMap[method] || method;
  }

  // Determine what to show
  if (participant.isOption) {
     // For options, usually no payment, but if we want to show intent
  } else if (participant.paymentType === 'BALANCE') {
     const depMethod = participant.depositPaymentMethod || participant.paymentMethod;
     const balMethod = participant.balancePaymentMethod || participant.paymentMethod; // Fallback if same

     if (depMethod && balMethod && depMethod !== balMethod) {
        // Split payments
        paymentDetails.push(['Metodo Acconto', translateMethod(depMethod)]);
        paymentDetails.push(['Metodo Saldo', translateMethod(balMethod)]);
     } else {
        // Unified or single method
        paymentDetails.push(['Metodo Pagamento', translateMethod(depMethod || balMethod)]);
     }
  } else {
     // Deposit only
     const depMethod = participant.depositPaymentMethod || participant.paymentMethod;
     paymentDetails.push(['Metodo Acconto', translateMethod(depMethod)]);
  }

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
