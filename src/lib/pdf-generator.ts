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
  paymentType: 'DEPOSIT' | 'BALANCE' | 'REFUNDED' | 'CANCELLED'
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
  supplier?: string
  createdAt?: string | Date
  accommodation?: string
  pickupLocation?: string
  pickupTime?: string
  rentalType?: string // Added for Rental logic
  returnDate?: string | Date
  returnTime?: string
  returnPickupLocation?: string
  returnDropoffLocation?: string
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

interface RentalData extends ExcursionData {
    pickupLocation?: string
    dropoffLocation?: string
}

const TRANSLATIONS = {
  it: {
    title: 'Dettagli Prenotazione',
    generatedOn: 'Generato il',
    status: {
      refunded: 'RIMBORSATO',
      cancelled: 'CANCELLATO',
      unpaid: 'NON PAGATO',
      confirmed: 'CONFERMATO',
      paid: 'SALDATO',
      deposit: 'ACCONTO'
    },
    startDate: 'Data Inizio',
    pickup: 'Ritiro',
    dropoff: 'Consegna',
    destination: 'Destinazione',
    date: 'Data',
    pickupTime: 'Ora Ritiro',
    return: 'Ritorno',
    at: 'ore',
    from: 'da',
    meetingPoint: 'Punto di incontro',
    personalInfo: 'Informazioni Personali',
    fields: {
      name: 'Nome e Cognome',
      nationality: 'Nazionalità',
      doc: 'Documento',
      phone: 'Telefono',
      email: 'Email',
      pax: 'Numero Partecipanti',
      notes: 'Note'
    },
    paymentSummary: 'Riepilogo Pagamento',
    totalPrice: 'Prezzo Totale',
    depositPaid: 'Acconto Versato',
    remaining: 'Rimanente da Saldare',
    paymentMethod: {
      deposit: 'Metodo Acconto',
      balance: 'Metodo Saldo',
      single: 'Metodo Pagamento',
      cash: 'Contanti',
      transfer: 'Bonifico',
      card: 'Carta'
    },
    nonRefundable: "NOTA IMPORTANTE: L'acconto versato non è rimborsabile.",
    footer: 'Corfumania - Gestionale Escursioni'
  },
  en: {
    title: 'Booking Details',
    generatedOn: 'Generated on',
    status: {
      refunded: 'REFUNDED',
      cancelled: 'CANCELLED',
      unpaid: 'UNPAID',
      confirmed: 'CONFIRMED',
      paid: 'PAID',
      deposit: 'DEPOSIT'
    },
    startDate: 'Start Date',
    pickup: 'Pickup',
    dropoff: 'Dropoff',
    destination: 'Destination',
    date: 'Date',
    pickupTime: 'Pickup Time',
    return: 'Return',
    at: 'at',
    from: 'from',
    meetingPoint: 'Meeting Point',
    personalInfo: 'Personal Information',
    fields: {
      name: 'Name',
      nationality: 'Nationality',
      doc: 'Document',
      phone: 'Phone',
      email: 'Email',
      pax: 'Participants',
      notes: 'Notes'
    },
    paymentSummary: 'Payment Summary',
    totalPrice: 'Total Price',
    depositPaid: 'Deposit Paid',
    remaining: 'Remaining Balance',
    paymentMethod: {
      deposit: 'Deposit Method',
      balance: 'Balance Method',
      single: 'Payment Method',
      cash: 'Cash',
      transfer: 'Bank Transfer',
      card: 'Card'
    },
    nonRefundable: 'IMPORTANT NOTE: The deposit is non-refundable.',
    footer: 'Corfumania - Excursion Management'
  }
}

export const generateParticipantPDF = (
  participant: ParticipantData, 
  event: ExcursionData | TransferData,
  language: 'it' | 'en' = 'it'
): jsPDF => {
  const doc = new jsPDF()
  const t = TRANSLATIONS[language]

  // --- Header ---
  // Background for header
  doc.setFillColor(249, 250, 251) // gray-50
  doc.rect(0, 0, 210, 40, 'F')
  
  // Title
  doc.setTextColor(31, 41, 55) // gray-800
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text(t.title, 20, 20)
  
  // Subtitle
  doc.setFontSize(10)
  doc.setTextColor(107, 114, 128) // gray-500
  doc.setFont('helvetica', 'normal')
  const dateLocale = language === 'it' ? 'it-IT' : 'en-GB'
  const dateStr = new Date().toLocaleDateString(dateLocale, { day: '2-digit', month: 'long', year: 'numeric' })
  doc.text(`${t.generatedOn} ${dateStr}`, 20, 28)

  // Status Badge Logic (Simulated with text/color)
  let statusText = ''
  let statusColor = [0, 0, 0]
  
  const isRental = (event as any).type === 'RENTAL'
  const isCarRental = isRental && participant.rentalType === 'CAR'
  const isOtherRental = isRental && participant.rentalType !== 'CAR'

  if (participant.paymentType === 'REFUNDED') {
    statusText = t.status.refunded
    statusColor = [156, 163, 175] // gray-400
  } else if (participant.paymentType === 'CANCELLED') {
    statusText = t.status.cancelled
    statusColor = [220, 38, 38] // red-600
  } else if (participant.isOption) {
    statusText = t.status.unpaid
    statusColor = [220, 38, 38] // red-600
  } else if (isOtherRental) {
    // Force CONFERMATO for all non-CAR rentals (including legacy undefined rentalType)
    statusText = t.status.confirmed
    statusColor = [22, 163, 74] // green-600
  } else if (participant.paymentType === 'BALANCE') {
    statusText = t.status.paid
    statusColor = [22, 163, 74] // green-600
  } else {
    statusText = t.status.deposit
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
  // isRental already defined above

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
    
    const rentalDate = new Date(rental.date).toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    doc.text(`${t.startDate}: ${rentalDate.charAt(0).toUpperCase() + rentalDate.slice(1)}`, 30, yPos + 20)
    
    // Pickup / Dropoff details
    doc.setFont('helvetica', 'bold')
    doc.text(`${t.pickup}:`, 30, yPos + 30)
    doc.text(`${t.dropoff}:`, 30, yPos + 38)
    
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
    
    const transferDate = new Date(transfer.date).toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    doc.text(`${t.date}: ${transferDate.charAt(0).toUpperCase() + transferDate.slice(1)}`, 30, yPos + 20)
    
    if (transfer.pickupTime) {
      doc.text(`${t.pickupTime}: ${transfer.pickupTime}`, 120, yPos + 20)
    }

    // Pickup / Dropoff details
    doc.setFont('helvetica', 'bold')
    doc.text(`${t.pickup}:`, 30, yPos + 30)
    doc.text(`${t.destination}:`, 30, yPos + 38)
    
    doc.setFont('helvetica', 'normal')
    doc.text(transfer.pickupLocation || '-', 50, yPos + 30)
    doc.text(transfer.dropoffLocation || '-', 60, yPos + 38)
    
    // Return Info if present
    if (transfer.returnDate) {
       const retDate = new Date(transfer.returnDate).toLocaleDateString(dateLocale, { day: 'numeric', month: 'numeric' })
       let retText = `${t.return}: ${retDate}`
       if (transfer.returnTime) retText += ` ${t.at} ${transfer.returnTime}`
       if (transfer.returnPickupLocation) retText += ` ${t.from} ${transfer.returnPickupLocation}`
       
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
        const dateStr = date.toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        excDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1)
      }
    } catch (e) { console.error('Excursion date parsing error', e) }
    
    doc.text(excDate, 30, yPos + 20)
    
    if (excursion.meetingPoint) {
        doc.text(`${t.meetingPoint}: ${excursion.meetingPoint}`, 30, yPos + 28)
    }
  }

  // --- Participant Details ---
  yPos += 45
  doc.setTextColor(17, 24, 39) // gray-900
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(t.personalInfo, 20, yPos)
  
  yPos += 5
  
  const details = [
    [t.fields.name, `${participant.firstName} ${participant.lastName}`],
    [t.fields.nationality, participant.nationality],
    [t.fields.doc, `${participant.docType} - ${participant.docNumber}`],
    [t.fields.phone, participant.phoneNumber || '-'],
    [t.fields.email, participant.email || '-'],
    [t.fields.pax, participant.groupSize.toString()],
    [t.fields.notes, participant.notes || '-']
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
  doc.text(t.paymentSummary, 20, yPos)

  yPos += 5

  const paymentDetails = [
    [t.totalPrice, `€ ${participant.price.toFixed(2)}`]
  ]

  // Only show deposit details if it's NOT an unmanaged rental (i.e. show for CAR or Excursion/Transfer)
  if (!isOtherRental) {
    paymentDetails.push([t.depositPaid, `€ ${participant.deposit.toFixed(2)}`])
    paymentDetails.push([t.remaining, `€ ${(participant.price - participant.deposit).toFixed(2)}`])
  }

  // Add Payment Methods Details
  const paymentMethodMap: Record<string, string> = {
    'CASH': t.paymentMethod.cash,
    'TRANSFER': t.paymentMethod.transfer,
    'CARD': t.paymentMethod.card
  }

  const translateMethod = (method?: string) => {
    if (!method) return '-';
    return paymentMethodMap[method] || method;
  }

  // Determine what to show
  if (isOtherRental) {
     // No payment details for brokerage rentals
  } else if (participant.isOption) {
     // For options, usually no payment, but if we want to show intent
  } else if (participant.paymentType === 'BALANCE') {
     const depMethod = participant.depositPaymentMethod || participant.paymentMethod;
     const balMethod = participant.balancePaymentMethod || participant.paymentMethod; // Fallback if same

     if (depMethod && balMethod && depMethod !== balMethod) {
        // Split payments
        paymentDetails.push([t.paymentMethod.deposit, translateMethod(depMethod)]);
        paymentDetails.push([t.paymentMethod.balance, translateMethod(balMethod)]);
     } else {
        // Unified or single method
        paymentDetails.push([t.paymentMethod.single, translateMethod(depMethod || balMethod)]);
     }
  } else {
     // Deposit only
     const depMethod = participant.depositPaymentMethod || participant.paymentMethod;
     paymentDetails.push([t.paymentMethod.deposit, translateMethod(depMethod)]);
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
  
  // Non-refundable Notice
  if (!isOtherRental) {
    const finalY = (doc as any).lastAutoTable?.finalY || 150
    yPos = finalY + 15
    
    // Check if we need a new page
    if (yPos > 250) {
      doc.addPage()
      yPos = 20
    }
    
    doc.setDrawColor(252, 165, 165) // red-300
    doc.setFillColor(254, 242, 242) // red-50
    doc.roundedRect(20, yPos, 170, 14, 1, 1, 'FD')
    
    doc.setTextColor(185, 28, 28) // red-700
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    
    // Icona "!" simulata
    doc.text('!', 26, yPos + 9)
    doc.circle(27, yPos + 7, 3)
    
    doc.text(t.nonRefundable, 105, yPos + 9, { align: 'center' })
  }

  // Footer
  const footerY = 280
  doc.setFontSize(8)
  doc.setTextColor(156, 163, 175)
  doc.text(t.footer, 105, footerY, { align: 'center' })
  
  return doc
}

export const generateParticipantsListPDF = (
  participants: ParticipantData[], 
  event: ExcursionData | TransferData,
  selectedFields: string[]
): jsPDF => {
  const doc = new jsPDF({ orientation: 'landscape' }) // Landscape for better fit

  // --- Header ---
  const eventName = event.name
  let eventDate = ''
  if (event.date) {
    try {
      const d = new Date(event.date)
      eventDate = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    } catch (e) { console.error(e) }
  }

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(eventName, 14, 20)
  
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text(eventDate.charAt(0).toUpperCase() + eventDate.slice(1), 14, 28)

  const totalPax = participants.reduce((acc, p) => acc + (p.groupSize || 1), 0)
  doc.text(`Totale Partecipanti: ${totalPax}`, 270, 20, { align: 'right' })
  const dateStr = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  doc.setFontSize(8)
  doc.setTextColor(100)
  doc.text(`Generato il: ${dateStr}`, 270, 28, { align: 'right' })

  // --- Table Columns ---
  const head = [['#', 'Nome e Cognome', 'Tel.', 'Pax']]
  const body: any[] = []

  // Add dynamic headers
  if (selectedFields.includes('nationality')) head[0].push('Nazionalità')
  if (selectedFields.includes('docType') || selectedFields.includes('docNumber')) head[0].push('Documento')
  if (selectedFields.includes('email')) head[0].push('Email')
  if (selectedFields.includes('price')) head[0].push('Prezzo')
  if (selectedFields.includes('deposit')) head[0].push('Acconto')
  if (selectedFields.includes('paymentType')) head[0].push('Stato')
  if (selectedFields.includes('paymentMethod')) head[0].push('Metodo')
  if (selectedFields.includes('supplier')) head[0].push('Fornitore')
  if (selectedFields.includes('createdBy')) head[0].push('Inserito da')
  if (selectedFields.includes('createdAt')) head[0].push('Data Ins.')
  if (selectedFields.includes('notes')) head[0].push('Note')
  if (selectedFields.includes('accommodation')) head[0].push('Struttura')
  if (selectedFields.includes('pickupLocation')) head[0].push('Partenza')
  if (selectedFields.includes('pickupTime')) head[0].push('Ora Part.')
  if (selectedFields.includes('returnDetails')) {
    head[0].push('Partenza Rit.')
    head[0].push('Destinazione Rit.')
    head[0].push('Data/Ora Rit.')
  }

  // --- Table Body ---
  const buildRow = (p: ParticipantData, index: number) => {
    const row = [
      (index + 1).toString(),
      `${p.firstName} ${p.lastName}`,
      p.phoneNumber || '-',
      (p.groupSize || 1).toString()
    ]

    if (selectedFields.includes('nationality')) row.push(p.nationality || '-')
    
    if (selectedFields.includes('docType') || selectedFields.includes('docNumber')) {
      row.push(`${p.docType || ''} ${p.docNumber || ''}`.trim() || '-')
    }
    
    if (selectedFields.includes('email')) row.push(p.email || '-')
    if (selectedFields.includes('price')) row.push(`€ ${p.price?.toFixed(2) || '0.00'}`)
    if (selectedFields.includes('deposit')) row.push(`€ ${p.deposit?.toFixed(2) || '0.00'}`)
    
    if (selectedFields.includes('paymentType')) {
      let status = 'N/A'
      if (p.paymentType === 'REFUNDED') status = 'Rimborsato'
      else if (p.isOption) status = 'Opzione'
      else if (p.paymentType === 'BALANCE') status = 'Saldato'
      else if (p.paymentType === 'DEPOSIT') status = 'Acconto'
      row.push(status)
    }

    if (selectedFields.includes('paymentMethod')) {
       const method = p.balancePaymentMethod || p.depositPaymentMethod || p.paymentMethod || '-'
       row.push(method)
    }

    if (selectedFields.includes('supplier')) row.push(p.supplier || '-')
    
    if (selectedFields.includes('createdBy')) {
       row.push(p.createdBy ? `${p.createdBy.firstName} ${p.createdBy.lastName}` : '-')
    }

    if (selectedFields.includes('createdAt')) {
       const d = p.createdAt ? new Date(p.createdAt).toLocaleDateString('it-IT') : '-'
       row.push(d)
    }

    if (selectedFields.includes('notes')) row.push(p.notes || '-')
    if (selectedFields.includes('accommodation')) row.push(p.accommodation || '-')
    if (selectedFields.includes('pickupLocation')) row.push(p.pickupLocation || '-')
    if (selectedFields.includes('pickupTime')) row.push(p.pickupTime || '-')
    if (selectedFields.includes('returnDetails')) {
        row.push(p.returnPickupLocation || '-')
        row.push(p.returnDropoffLocation || '-')
        let dt = '-'
        if (p.returnDate) {
             try {
                const d = new Date(p.returnDate).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })
                dt = `${d} ${p.returnTime || ''}`.trim()
             } catch(e) { dt = p.returnTime || '-' }
        }
        row.push(dt)
    }

    return row
  }

  if (selectedFields.includes('pickupLocation')) {
    const groups: Record<string, ParticipantData[]> = {}
    const noLocation: ParticipantData[] = []

    participants.forEach(p => {
      if (p.pickupLocation) {
        const key = p.pickupLocation.trim()
        if (!groups[key]) groups[key] = []
        groups[key].push(p)
      } else {
        noLocation.push(p)
      }
    })

    const sortedLocations = Object.keys(groups).sort()
    let globalIndex = 0

    sortedLocations.forEach(loc => {
      // Add Header Row
      const groupTotal = groups[loc].reduce((acc, p) => acc + (p.groupSize || 1), 0)
      body.push([{ 
        content: `Partenza: ${loc} (Pax: ${groupTotal})`, 
        colSpan: head[0].length, 
        styles: { fillColor: [230, 240, 255], fontStyle: 'bold', textColor: [30, 64, 175], halign: 'left' } 
      }])
      
      groups[loc].forEach(p => {
        body.push(buildRow(p, globalIndex++))
      })
    })

    if (noLocation.length > 0) {
      body.push([{ 
        content: `Nessun Punto di Partenza Specificato`, 
        colSpan: head[0].length, 
        styles: { fillColor: [243, 244, 246], fontStyle: 'bold', textColor: [107, 114, 128], halign: 'left' } 
      }])
      noLocation.forEach(p => {
        body.push(buildRow(p, globalIndex++))
      })
    }

  } else {
    participants.forEach((p, index) => {
      body.push(buildRow(p, index))
    })
  }

  autoTable(doc, {
    head: head,
    body: body,
    startY: 35,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [66, 66, 66] },
    alternateRowStyles: { fillColor: [245, 245, 245] }
  })

  return doc
}
