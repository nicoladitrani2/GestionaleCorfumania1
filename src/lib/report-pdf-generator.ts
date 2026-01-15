import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export const generateAdvancedReportPDF = (data: any, filters: any) => {
  const doc = new jsPDF()

  // --- Header ---
  doc.setFillColor(37, 99, 235) // Blue-600
  doc.rect(0, 0, 210, 40, 'F')
  
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('Report Avanzato - Corfumania', 14, 18)
  
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  const dateStr = new Date().toLocaleDateString('it-IT', { 
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
  })
  doc.text(`Generato il: ${dateStr}`, 14, 28)

  // --- Filter Summary ---
  let yPos = 50
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Riepilogo Filtri', 14, yPos)
  
  yPos += 8
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  
  const filterText = [
    `Periodo: ${filters.startDate || 'Inizio'} - ${filters.endDate || 'Oggi'}`,
    `Tipi: ${filters.types?.join(', ') || 'Tutti'}`,
    `Fornitori: ${filters.supplierIds?.length ? 'Selezionati' : 'Tutti'}`,
    `Assistenti: ${filters.assistantIds?.length ? 'Selezionati' : 'Tutti'}`,
    `Escursioni: ${filters.excursionIds?.length ? 'Selezionate' : 'Tutte'}`
  ]
  
  filterText.forEach(text => {
    doc.text(`• ${text}`, 14, yPos)
    yPos += 5
  })

  // --- Financial Summary Cards (Simulated with text/boxes) ---
  yPos += 10
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Riepilogo Finanziario', 14, yPos)
  
  yPos += 10
  const summaryData = [
    ['Incasso Totale', `€ ${data.summary.totalRevenue.toFixed(2)}`],
    ['Commissioni Assistenti', `€ ${data.summary.totalCommission.toFixed(2)}`],
    ['Netto', `€ ${data.summary.netRevenue.toFixed(2)}`],
    ['Numero Prenotazioni', `${data.summary.count}`],
    ['Pax Totali', `${data.summary.totalPax || 0}`]
  ]

  autoTable(doc, {
    startY: yPos,
    head: [['Voce', 'Valore']],
    body: summaryData,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246] },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'right' }
    }
  })

  // --- Supplier Breakdown ---
  // @ts-ignore
  yPos = doc.lastAutoTable.finalY + 15
  doc.setFontSize(14)
  doc.text('Dettaglio per Fornitore (Agenzia)', 14, yPos)
  
  const supplierRows = data.bySupplier.map((s: any) => [
    s.name,
    s.pax || s.count, // Default to count if pax is missing
    `€ ${s.revenue.toFixed(2)}`,
    `€ ${s.commission.toFixed(2)}`,
    `€ ${(s.revenue - s.commission).toFixed(2)}`
  ])

  autoTable(doc, {
    startY: yPos + 5,
    head: [['Fornitore', 'Pax', 'Incasso', 'Comm.', 'Netto']],
    body: supplierRows,
    theme: 'striped',
    headStyles: { fillColor: [16, 185, 129] }, // Emerald-500
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' }
    }
  })

  // --- Assistant Breakdown ---
  // @ts-ignore
  yPos = doc.lastAutoTable.finalY + 15
  
  // Check page break
  if (yPos > 250) {
    doc.addPage()
    yPos = 20
  }

  doc.setFontSize(14)
  doc.text('Dettaglio per Assistente', 14, yPos)

  const assistantRows = data.byAssistant.map((a: any) => [
    a.name,
    a.pax || a.count,
    `€ ${a.revenue.toFixed(2)}`,
    `€ ${a.commission.toFixed(2)}`
  ])

  autoTable(doc, {
    startY: yPos + 5,
    head: [['Assistente', 'Pax', 'Incasso', 'Comm.']],
    body: assistantRows,
    theme: 'striped',
    headStyles: { fillColor: [249, 115, 22] }, // Orange-500
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right' }
    }
  })

  // --- Excursion Breakdown ---
  if (data.byExcursion && data.byExcursion.length > 0) {
    // @ts-ignore
    yPos = doc.lastAutoTable.finalY + 15

    // Check page break
    if (yPos > 250) {
        doc.addPage()
        yPos = 20
    }

    doc.setFontSize(14)
    doc.text('Dettaglio per Escursione', 14, yPos)

    const excursionRows = data.byExcursion.map((e: any) => [
        e.name,
        e.pax || e.count,
        `€ ${e.revenue.toFixed(2)}`,
        `€ ${e.commission.toFixed(2)}`,
        `€ ${(e.revenue - e.commission).toFixed(2)}`
    ])

    autoTable(doc, {
        startY: yPos + 5,
        head: [['Escursione', 'Pax', 'Incasso', 'Comm.', 'Netto']],
        body: excursionRows,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] }, // Blue-500
        columnStyles: {
            2: { halign: 'right' },
            3: { halign: 'right' },
            4: { halign: 'right' }
        }
    })
  }

  doc.save('report-avanzato.pdf')
}
