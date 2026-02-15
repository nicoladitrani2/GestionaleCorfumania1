import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const types = searchParams.get('types')?.split(',')
    const agencyIds = searchParams.get('agencyIds')?.split(',')
    const providerIds = searchParams.get('providerIds')?.split(',')
    const assistantIds = searchParams.get('assistantIds')?.split(',')
    const excursionIds = searchParams.get('excursionIds')?.split(',')

    // 1. Fetch Agencies for mapping
    const agencies = await prisma.agency.findMany()
    const agencyMap = agencies.reduce((acc, a) => {
        acc[a.id] = a
        return acc
    }, {} as Record<string, any>)

    // Admin Agency (Corfumania)
    const adminAgency = agencies.find(a => a.name === 'Corfumania')

    // 2. Build Where Clause
    const whereClause: any = {}

    // Date Filter (Cash Basis -> createdAt)
    if (startDate && endDate) {
        whereClause.createdAt = {
            gte: new Date(startDate),
            lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
        }
    }

    // Type Filter
    if (types && types.length > 0) {
        const typeConditions = []
        if (types.includes('EXCURSION')) typeConditions.push({ excursionId: { not: null } })
        if (types.includes('TRANSFER')) typeConditions.push({ transferId: { not: null } })
        if (types.some(t => t.startsWith('RENTAL'))) typeConditions.push({ rentalId: { not: null } })
        if (types.some(t => t.startsWith('SPECIAL'))) typeConditions.push({ specialServiceType: { not: null } })
        
        if (typeConditions.length > 0) {
            whereClause.OR = typeConditions
        }
    }

    // Agency Filter
    if (agencyIds && agencyIds.length > 0) {
         whereClause.createdBy = {
             agencyId: { in: agencyIds }
         }
    }

    // Provider/Supplier Filter
    if (providerIds && providerIds.length > 0) {
        whereClause.supplier = { in: providerIds }
    }

    // Assistant Filter
    if (assistantIds && assistantIds.length > 0) {
        if (whereClause.user) {
            whereClause.user.id = { in: assistantIds }
        } else {
             whereClause.user = { id: { in: assistantIds } }
        }
    }

    // Excursion Specific Filter
    if (excursionIds && excursionIds.length > 0) {
        whereClause.excursionId = { in: excursionIds }
    }

    const participants = await prisma.participant.findMany({
      where: whereClause,
      include: {
        user: true,
        excursion: true,
        transfer: true,
        rental: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Fetch Commissions
    const excursionIdsList = participants
        .map(p => p.excursionId)
        .filter((id): id is string => !!id)
    
    const transferIdsList = participants
        .map(p => p.transferId)
        .filter((id): id is string => !!id)
    
    let commissionsMap: Record<string, any[]> = {}
    let transferCommissionsMap: Record<string, any[]> = {}
    
    if (excursionIdsList.length > 0) {
        try {
            const commissions = await prisma.excursionAgencyCommission.findMany({
                where: { excursionId: { in: excursionIdsList } }
            })
            commissions.forEach(c => {
                if (!commissionsMap[c.excursionId]) {
                    commissionsMap[c.excursionId] = []
                }
                commissionsMap[c.excursionId].push(c)
            })
        } catch (e) {
            console.error("Failed to fetch commissions:", e)
        }
    }

    if (transferIdsList.length > 0) {
        try {
            const commissions = await prisma.transferAgencyCommission.findMany({
                where: { transferId: { in: transferIdsList } }
            })
            commissions.forEach(c => {
                if (!transferCommissionsMap[c.transferId]) {
                    transferCommissionsMap[c.transferId] = []
                }
                transferCommissionsMap[c.transferId].push(c)
            })
        } catch (e) {
            console.error("Failed to fetch transfer commissions:", e)
        }
    }

    // Process Data
    let totalRevenue = 0
    let totalCommission = 0 // Mixed: agency commissions + brokerage/net components
    let totalAssistantCommission = 0 // Assistant Commission
    let totalNetAgency = 0
    let totalExternalAgencyCommission = 0
    let totalPax = 0
    let totalTax = 0
    
    const byAgency: Record<string, { name: string, revenue: number, commission: number, assistantCommission?: number, netAgency: number, count: number, pax: number, tax: number }> = {}
    const bySupplier: Record<string, { name: string, revenue: number, commission: number, count: number, pax: number, tax: number }> = {}
    const byAssistant: Record<string, { name: string, revenue: number, commission: number, count: number, pax: number, tax: number }> = {}
    const byExcursion: Record<string, { name: string, date: string, revenue: number, commission: number, count: number, pax: number, tax: number }> = {}
    const byTransfer: Record<string, { name: string, revenue: number, commission: number, count: number, pax: number, tax: number }> = {}
    const byRental: Record<string, { name: string, revenue: number, commission: number, assistantCommission: number, supplierShare: number, netAgency: number, count: number, pax: number, tax: number }> = {}
    const bySpecialService: Record<string, { name: string, revenue: number, commission: number, count: number, pax: number }> = {}

    participants.forEach(p => {
        if (p.paymentStatus === 'REJECTED' || p.paymentStatus === 'PENDING_APPROVAL') return

        let isRetained = false
        let revenue = p.paidAmount || 0 
        let pax = (p.adults + p.children + p.infants) || 1
        const tax = p.tax || 0
        
        // Handle Refunded: Only include if there is a retained deposit (Acconto)
        if (p.paymentType === 'REFUNDED') {
             const price = p.totalPrice || 0
             const deposit = p.paidAmount || 0
             // Logic: If deposit exists and is less than price (Partial), assume it's retained.
             // If deposit == price, assume full refund (exclude).
             if (deposit > 0 && deposit < price) {
                 isRetained = true
                 revenue = deposit
                 pax = (p.adults + p.children + p.infants) // Count pax for fixed commissions
             } else {
                 return // Exclude full refund
             }
        }

        let commissionAmount = 0
        let isBrokerageProcessed = false
        let isExternalAgencyCommission = false
        
        // --- SPECIAL SERVICES ---
        if (p.specialServiceType) {
             // Filter by specific Special Service Type
             if (types && types.length > 0) {
                 const currentSpecialType = `SPECIAL_${p.specialServiceType}`
                 if (!types.includes(currentSpecialType)) return
             }

             // For Special Services, Revenue is the Price (Deposit)
             // And Agency Net is 100% of Revenue (No Supplier cost deducted in Commission logic usually, 
             // or Supplier is internal so Commission = Revenue)
             commissionAmount = revenue
             
             // Populate Special Service Breakdown
             let serviceName = p.specialServiceType
             if (serviceName === 'BRACELET') serviceName = 'Braccialetto'
             else if (serviceName === 'CITY_TAX') serviceName = 'Tassa di Soggiorno'
             else if (serviceName === 'AC') serviceName = 'Aria Condizionata'

             if (!bySpecialService[serviceName]) {
                 bySpecialService[serviceName] = { name: serviceName, revenue: 0, commission: 0, count: 0, pax: 0 }
             }
             bySpecialService[serviceName].revenue += revenue
             bySpecialService[serviceName].commission += commissionAmount
             bySpecialService[serviceName].count += 1
             bySpecialService[serviceName].pax += pax
        }
        
        // --- AGENCY COMMISSION CALCULATION ---
        let userAgencyId = (p.user as any)?.agencyId
        let agency = userAgencyId ? agencyMap[userAgencyId] : null

        if (!agency && (p.user as any)?.role === 'ADMIN') {
            agency = adminAgency
            if (agency) userAgencyId = agency.id
        }

        const isRental = !!p.rentalId
        let effectiveRentalType: string | null = null

        if (isRental) {
            effectiveRentalType = ((p as any).rentalType || p.rental?.type || null) as string | null

            if (!effectiveRentalType) {
                if ((p.insurancePrice || 0) > 0 || (p.supplementPrice || 0) > 0) {
                    effectiveRentalType = 'MOTO'
                } else if (p.supplier && (p as any).price === 0 && (p.totalPrice || 0) > 0) {
                    effectiveRentalType = 'BOAT'
                } else {
                    effectiveRentalType = 'CAR'
                }
            }

            if (types && types.length > 0) {
                const currentRentalType = effectiveRentalType ? `RENTAL_${effectiveRentalType}` : 'RENTAL_CAR'
                if (!types.includes(currentRentalType)) return
            }

            if (effectiveRentalType && ['MOTO', 'BOAT'].includes(effectiveRentalType)) {
                isBrokerageProcessed = true
                revenue = 0
                
                const price = p.totalPrice || 0
                const commPct = p.commissionPercentage || 0
                
                if (effectiveRentalType === 'MOTO') {
                    const taxable = Math.max(0, price - (p.insurancePrice || 0) - (p.supplementPrice || 0))
                    commissionAmount = taxable * (commPct / 100)
                } else {
                    commissionAmount = price * (commPct / 100)
                }
            }
        }

        const isBrokerageRental = isRental && effectiveRentalType && ['MOTO', 'BOAT'].includes(effectiveRentalType)
        
        if (agency && !isBrokerageRental && !p.specialServiceType) {
            let ruleType = (agency as any).commissionType || 'PERCENTAGE'
            let ruleValue = agency.defaultCommission || 0

            // Check for overrides
            if (p.excursion) {
                const excursionCommissions = commissionsMap[p.excursion.id] || []
                const commRule = excursionCommissions.find(c => c.agencyId === userAgencyId)
                if (commRule) {
                    ruleValue = commRule.commissionPercentage
                    ruleType = (commRule as any).commissionType || 'PERCENTAGE'
                }
            } else if (p.transfer) {
                const transferCommissions = transferCommissionsMap[p.transfer.id] || []
                const commRule = transferCommissions.find(c => c.agencyId === userAgencyId)
                if (commRule) {
                    ruleValue = commRule.commissionPercentage
                    ruleType = (commRule as any).commissionType || 'PERCENTAGE'
                }
            }
            // Note: Car Rentals use default agency logic if no override (Rentals don't have override table yet)

            if (ruleType === 'FIXED') {
                commissionAmount = pax * ruleValue
            } else {
                commissionAmount = (revenue * ruleValue) / 100
            }

            isExternalAgencyCommission = true
        }

        // --- ASSISTANT COMMISSION CALCULATION ---
        let assistantCommissionAmount = 0
        
        let asstCommType = p.assistantCommissionType
        let asstCommVal = p.assistantCommission

        let assistantAgency: any = null
        if ((p.user as any)?.agencyId && agencyMap[(p.user as any).agencyId]) {
            assistantAgency = agencyMap[(p.user as any).agencyId]
        } else if ((p.user as any)?.role === 'ADMIN') {
            assistantAgency = adminAgency
        }

        if (!asstCommType && assistantAgency) {
            asstCommType = (assistantAgency as any).commissionType || 'PERCENTAGE'
        }

        if (assistantAgency && (asstCommVal === null || asstCommVal === undefined || asstCommVal === 0)) {
            asstCommVal = assistantAgency.defaultCommission || 0
        }

        if (!asstCommType) asstCommType = 'PERCENTAGE'
        if (asstCommVal === null || asstCommVal === undefined) asstCommVal = 0

        if (asstCommVal > 0) {
            // Nessuna commissione assistente sui noleggi barca
            if (isRental && effectiveRentalType === 'BOAT') {
                assistantCommissionAmount = 0
            } else if (asstCommType === 'PERCENTAGE') {
                let baseForAssistant = revenue
                if (isBrokerageRental || p.specialServiceType) {
                    baseForAssistant = commissionAmount
                }
                assistantCommissionAmount = baseForAssistant * (asstCommVal / 100)
            } else {
                assistantCommissionAmount = asstCommVal * pax
            }
        }
        
        // Aggregates
        totalRevenue += revenue
        totalCommission += commissionAmount
        totalAssistantCommission += assistantCommissionAmount
        totalPax += pax
        totalTax += tax

        // Per-row Netto Agenzia (per agenzia)
        let netAgencyForRow = 0
        if (isRental) {
            if (effectiveRentalType === 'BOAT') {
                // Per le barche: la commissione calcolata è già il netto agenzia,
                // e non va toccata da commissioni assistente.
                netAgencyForRow = commissionAmount
            } else if (isBrokerageRental) {
                // Per le moto usiamo il totale commissione come netto aziendale,
                // senza sottrarre eventuali commissioni assistente.
                if (effectiveRentalType === 'MOTO') {
                    netAgencyForRow = commissionAmount
                } else {
                    netAgencyForRow = commissionAmount - assistantCommissionAmount
                }
            } else {
                netAgencyForRow = revenue * 0.2 - assistantCommissionAmount
            }
        } else if (p.specialServiceType) {
            netAgencyForRow = commissionAmount - assistantCommissionAmount
        } else {
            netAgencyForRow = revenue * 0.2 - assistantCommissionAmount
        }

        totalNetAgency += netAgencyForRow

        if (isExternalAgencyCommission) {
            totalExternalAgencyCommission += commissionAmount
        }
        
        // By Agency
        let agencyName = 'Nessuna Agenzia'
        if (userAgencyId && agencyMap[userAgencyId]) {
            agencyName = agencyMap[userAgencyId].name
        }
        
        if (!byAgency[agencyName]) {
            byAgency[agencyName] = { name: agencyName, revenue: 0, commission: 0, assistantCommission: 0, netAgency: 0, count: 0, pax: 0, tax: 0 }
        }
        byAgency[agencyName].revenue += revenue
        // For agency-level views, commission represents the sum of assistant quotas
        byAgency[agencyName].commission += assistantCommissionAmount
        byAgency[agencyName].assistantCommission += assistantCommissionAmount
        byAgency[agencyName].netAgency += netAgencyForRow
        byAgency[agencyName].count += 1
        byAgency[agencyName].pax += pax
        byAgency[agencyName].tax += tax

        // By Supplier
        const supplierName = p.supplier || 'Nessun Fornitore'
        if (!bySupplier[supplierName]) {
            bySupplier[supplierName] = { name: supplierName, revenue: 0, commission: 0, count: 0, pax: 0, tax: 0 }
        }
        
        // Calculate Supplier Share
        let supplierShare = revenue
        if (isRental) {
            if (effectiveRentalType === 'CAR') {
                supplierShare = revenue * 0.8
            } else if (effectiveRentalType === 'BOAT') {
                // Per le barche: la percentuale agenzia è già il netto,
                // quindi la quota fornitore è semplicemente il prezzo totale meno il netto agenzia.
                const price = p.totalPrice || 0
                supplierShare = price - commissionAmount
            } else {
                supplierShare = ((p.totalPrice as any) || 0) - commissionAmount
            }
        }

        bySupplier[supplierName].revenue += supplierShare
        bySupplier[supplierName].commission += 0 
        bySupplier[supplierName].count += 1
        bySupplier[supplierName].pax += pax
        bySupplier[supplierName].tax += tax

        // By Assistant
        const assistantName = `${p.user.firstName || ''} ${p.user.lastName || ''}`.trim() || p.user.email
        if (!byAssistant[assistantName]) {
            byAssistant[assistantName] = { name: assistantName, revenue: 0, commission: 0, count: 0, pax: 0, tax: 0 }
        }
        byAssistant[assistantName].revenue += revenue
        // Display Assistant's Commission in the Assistant Table
        byAssistant[assistantName].commission += assistantCommissionAmount 
        byAssistant[assistantName].count += 1
        byAssistant[assistantName].pax += pax
        byAssistant[assistantName].tax += tax

        // By Excursion / Rental / Transfer
        if (p.excursion) {
            let formattedDate = 'Data non valida'
            if (p.excursion.startDate) {
                const date = new Date(p.excursion.startDate)
                if (!isNaN(date.getTime())) {
                    formattedDate = date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
                }
            }
            const excursionKey = `${p.excursion.name}-${formattedDate}`
            
            if (!byExcursion[excursionKey]) {
                byExcursion[excursionKey] = { name: p.excursion.name, date: formattedDate, revenue: 0, commission: 0, count: 0, pax: 0, tax: 0 }
            }
            byExcursion[excursionKey].revenue += revenue
            byExcursion[excursionKey].commission += commissionAmount
            byExcursion[excursionKey].count += 1
            byExcursion[excursionKey].pax += pax
            byExcursion[excursionKey].tax += tax

        } else if (p.transfer) {
            const transferName = `Transfer: ${p.transfer.pickupLocation || '?'} -> ${p.transfer.dropoffLocation || '?'}`
            
            if (!byTransfer[transferName]) {
                byTransfer[transferName] = { name: transferName, revenue: 0, commission: 0, count: 0, pax: 0, tax: 0 }
            }
            byTransfer[transferName].revenue += revenue
            byTransfer[transferName].commission += commissionAmount
            byTransfer[transferName].count += 1
            byTransfer[transferName].pax += pax
            byTransfer[transferName].tax += tax

        } else if (isRental) {
            const rentalLabelType = effectiveRentalType || p.rental?.type || 'Generico'
            const rentalName = `Noleggio: ${rentalLabelType} - ${p.rental?.name || ''}`
            const netAgencyForRow = isBrokerageRental
                ? commissionAmount
                : revenue * 0.2 - assistantCommissionAmount
            
            if (!byRental[rentalName]) {
                byRental[rentalName] = { name: rentalName, revenue: 0, commission: 0, assistantCommission: 0, supplierShare: 0, netAgency: 0, count: 0, pax: 0, tax: 0 }
            }
            byRental[rentalName].revenue += revenue
            byRental[rentalName].commission += commissionAmount
            byRental[rentalName].assistantCommission += assistantCommissionAmount
            byRental[rentalName].supplierShare += supplierShare
            byRental[rentalName].netAgency += netAgencyForRow
            byRental[rentalName].count += 1
            byRental[rentalName].pax += pax
            byRental[rentalName].tax += tax
        }
    })

    // Fetch Tax Bookings (Gestione Separata)
    const taxWhereClause: any = {}
    
    // Apply Date Filter
    if (whereClause.createdAt) {
        taxWhereClause.createdAt = whereClause.createdAt
    }

    // Apply Assistant Filter
    if (assistantIds && assistantIds.length > 0) {
        taxWhereClause.assignedToId = { in: assistantIds }
    }

    // Apply Type Filter (Service Code)
    if (types && types.length > 0) {
        const showBracelet = types.includes('SPECIAL_BRACELET')
        const showTax = types.includes('SPECIAL_CITY_TAX')
        // Note: SPECIAL_AC is not currently mapped to TaxBooking (usually in Participants)

        if (!showBracelet && !showTax) {
            // If types are selected but NO tax types are included, return no tax bookings
            // But we must be careful: if the user selects ONLY 'EXCURSION', they expect NO taxes.
            // If they select NOTHING (types is null/empty), we usually show ALL.
            // Here types has length > 0.
            taxWhereClause.id = '__NO_MATCH__' // Force empty
        } else {
            const allowedCodes = []
            if (showBracelet) allowedCodes.push(1, 3) // 1=Bracelet, 3=Both
            if (showTax) allowedCodes.push(2, 3)      // 2=Tax, 3=Both
            
            if (allowedCodes.length > 0) {
                taxWhereClause.serviceCode = { in: [...new Set(allowedCodes)] }
            }
        }
    }

    const taxBookings = await prisma.taxBooking.findMany({
        where: taxWhereClause,
        include: {
            assignedTo: true
        }
    })

    // Process Tax Stats
    const taxStats = {
        totalPax: 0,
        totalRevenue: 0,
        byProvenienza: {
            AGENZIA: { pax: 0, revenue: 0, count: 0, paidCount: 0, unpaidCount: 0 },
            PRIVATO: { pax: 0, revenue: 0, count: 0, paidCount: 0, unpaidCount: 0 }
        },
        byAssistant: {} as Record<string, { pax: number, revenue: number, count: number, paidCount: number, unpaidCount: number }>,
        byService: {} as Record<string, { pax: number, revenue: number, count: number }>
    }

    taxBookings.forEach(b => {
        // Total
        taxStats.totalPax += b.pax
        taxStats.totalRevenue += b.totalAmount

        // MERGE INTO MAIN REPORT (byAssistant)
        // This ensures the main "Performance per Assistente" table includes these revenues
        const mainAssistantName = b.assignedTo 
            ? `${b.assignedTo.firstName || ''} ${b.assignedTo.lastName || ''}`.trim() || b.assignedTo.email
            : 'Non Assegnato'
        
        if (!byAssistant[mainAssistantName]) {
            byAssistant[mainAssistantName] = { name: mainAssistantName, revenue: 0, commission: 0, count: 0, pax: 0, tax: 0 }
        }
        // Initialize taxBookingRevenue if not present (we'll need to add this property to the object definition implicitly)
        if (!(byAssistant[mainAssistantName] as any).taxBookingRevenue) (byAssistant[mainAssistantName] as any).taxBookingRevenue = 0
        ;(byAssistant[mainAssistantName] as any).taxBookingRevenue += b.totalAmount

        // Provenienza
        const prov = (b.provenienza === 'AGENZIA' || b.provenienza === '2') ? 'AGENZIA' : 'PRIVATO'
        taxStats.byProvenienza[prov].pax += b.pax
        taxStats.byProvenienza[prov].revenue += b.totalAmount
        taxStats.byProvenienza[prov].count += 1
        if (b.customerPaid) taxStats.byProvenienza[prov].paidCount += 1
        else taxStats.byProvenienza[prov].unpaidCount += 1

        // Assistant
        const assistantName = b.assignedTo 
            ? `${b.assignedTo.firstName} ${b.assignedTo.lastName}` 
            : 'Non Assegnato'
        
        if (!taxStats.byAssistant[assistantName]) {
            taxStats.byAssistant[assistantName] = { pax: 0, revenue: 0, count: 0, paidCount: 0, unpaidCount: 0 }
        }
        taxStats.byAssistant[assistantName].pax += b.pax
        taxStats.byAssistant[assistantName].revenue += b.totalAmount
        taxStats.byAssistant[assistantName].count += 1
        if (b.customerPaid) taxStats.byAssistant[assistantName].paidCount += 1
        else taxStats.byAssistant[assistantName].unpaidCount += 1

        // Service
        let serviceName = 'Sconosciuto'
        if (b.serviceCode === 1) serviceName = 'Solo Braccialetto'
        else if (b.serviceCode === 2) serviceName = 'Solo Tassa'
        else if (b.serviceCode === 3) serviceName = 'Braccialetto + Tassa'
        
        if (!taxStats.byService[serviceName]) {
            taxStats.byService[serviceName] = { pax: 0, revenue: 0, count: 0 }
        }
        taxStats.byService[serviceName].pax += b.pax
        taxStats.byService[serviceName].revenue += b.totalAmount
        taxStats.byService[serviceName].count += 1
    })

    return NextResponse.json({
      summary: {
        totalRevenue,
        totalCommission, // Agency Commission
        totalAssistantCommission, // Assistant Commission
        totalPax,
        totalTax,
        totalTaxRevenue: taxStats.totalRevenue,
        count: participants.length,
        totalNetAgency,
        totalExternalAgencyCommission
      },
      taxStats, // New field
      byAgency: Object.values(byAgency).sort((a, b) => b.revenue - a.revenue),
      bySupplier: Object.values(bySupplier),
      byAssistant: Object.values(byAssistant),
      byExcursion: Object.values(byExcursion),
      byTransfer: Object.values(byTransfer),
      byRental: Object.values(byRental),
      bySpecialService: Object.values(bySpecialService)
    })

  } catch (error) {
    console.error('Error generating report:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
