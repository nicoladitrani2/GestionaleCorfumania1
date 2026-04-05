import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const types = searchParams.get('types')?.split(',')
    const agencyIds = searchParams.get('agencyIds')?.split(',')
    const providerIds = searchParams.get('providerIds')?.split(',')
    const assistantIds = searchParams.get('assistantIds')?.split(',')
    const excursionIds = searchParams.get('excursionIds')?.split(',')
    const includeFutureRentals = searchParams.get('includeFutureRentals') === 'true'

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
        const assistantCondition = {
            OR: [
                { userId: { in: assistantIds } },
                { assignedToId: { in: assistantIds } }
            ]
        }
        if (whereClause.AND && Array.isArray(whereClause.AND)) {
            whereClause.AND.push(assistantCondition)
        } else if (whereClause.AND) {
            whereClause.AND = [whereClause.AND, assistantCondition]
        } else {
            whereClause.AND = [assistantCondition]
        }
    }

    // Excursion Specific Filter
    if (excursionIds && excursionIds.length > 0) {
        whereClause.excursionId = { in: excursionIds }
    }

    const rawParticipants = await prisma.participant.findMany({
      where: whereClause,
      include: {
        user: true,
        assignedTo: true,
        excursion: true,
        transfer: true,
        rental: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Filter out participants belonging to unapproved transfers (PENDING or REJECTED)
    const participants = rawParticipants.filter(p => {
        if (p.transfer) {
            // Only include transfer participants if the transfer is APPROVED
            return p.transfer.approvalStatus === 'APPROVED'
        }
        return true
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

    let rentalsGross = 0
    let rentalsSupplierOut = 0
    let rentalsCommissionTotal = 0
    let rentalsCommissionBaseTotal = 0
    let rentalsCarExcludedCostsTotal = 0
    let rentalsCarGrossBaseCount = 0
    let rentalsCompanyNow = 0
    let rentalsCompanyFuture = 0
    let rentalsCompanyTotal = 0
    let rentalsAgentTotal = 0
    let rentalsAgentNow = 0
    let rentalsAgentFuture = 0
    let rentalsGo4SeaTotal = 0
    let rentalsGo4SeaNow = 0
    let rentalsGo4SeaFuture = 0
    
    const byAgency: Record<string, { name: string, revenue: number, commission: number, assistantCommission: number, netAgency: number, count: number, pax: number, tax: number }> = {}
    const bySupplier: Record<string, { name: string, revenue: number, commission: number, count: number, pax: number, tax: number }> = {}
    const byAssistant: Record<string, { name: string, revenue: number, commission: number, count: number, pax: number, tax: number }> = {}
    const byExcursion: Record<string, { name: string, date: string, revenue: number, commission: number, count: number, pax: number, tax: number }> = {}
    const byTransfer: Record<string, { name: string, revenue: number, commission: number, count: number, pax: number, tax: number }> = {}
    const byRental: Record<string, { name: string, revenue: number, gross: number, commissionBase: number, commission: number, agentShare: number, companyShare: number, go4seaShare: number, supplierOut: number, assistantCommission: number, supplierShare: number, netAgency: number, count: number, pax: number, tax: number }> = {}
    const byRentalAgent: Record<string, { id: string, code: string, name: string, count: number, gross: number, commissionBase: number, agentShare: number, companyShare: number, go4seaShare: number }> = {}
    const rentalsPaymentByMethod: Record<string, { name: string, revenue: number, count: number }> = {}
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
        let rentalGross = 0
        let rentalCommissionBase = 0
        let rentalSupplierShare = 0
        let rentalCompanyShare = 0
        let rentalAgentShare = 0
        let rentalGo4SeaShare = 0
        let rentalCompanyNowForRow = 0
        let rentalCompanyFutureForRow = 0

        if (isRental) {
            const rawRentalType = (((p as any).rentalType || p.rental?.type || null) as string | null)
            effectiveRentalType = rawRentalType

            if (effectiveRentalType) {
              const normalized = String(effectiveRentalType).toUpperCase()
              if (normalized === 'SCOOTER' || normalized === 'QUAD') effectiveRentalType = 'MOTO'
              else if (normalized === 'AUTO') effectiveRentalType = 'CAR'
              else if (normalized === 'CAR_GROSS') effectiveRentalType = 'MOTO'
              else if (normalized === 'BARCA' || normalized === 'BOAT') effectiveRentalType = 'BOAT'
              else if (normalized !== 'CAR' && normalized !== 'MOTO' && normalized !== 'BOAT') effectiveRentalType = normalized
            }

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

            rentalGross = p.totalPrice || 0
            const insurance = p.insurancePrice || 0
            const supplement = p.supplementPrice || 0
            const rentalTax = p.tax || 0
            const supplierName = (p.supplier || '').trim().toLowerCase()
            const operatorAgencyId = ((p.assignedTo as any)?.agencyId || (p.user as any)?.agencyId) as string | undefined
            const referenceAgencyId = ((p as any).agencyId || operatorAgencyId) as string | undefined
            const referenceAgencyName = referenceAgencyId ? String(agencyMap[referenceAgencyId]?.name || '').toLowerCase() : ''
            const isGo4Sea = referenceAgencyName.includes('go4sea')
            const excludedCosts =
              effectiveRentalType === 'CAR'
                ? (Math.max(0, insurance) + Math.max(0, rentalTax) + Math.max(0, supplement))
                : 0
            rentalCommissionBase =
              effectiveRentalType === 'CAR'
                ? Math.max(0, rentalGross - excludedCosts)
                : Math.max(0, rentalGross)

            const includeRentalNow = effectiveRentalType === 'BOAT'
            const includeRentalFuture = includeFutureRentals
            const includeRental = includeRentalNow || includeRentalFuture

            const totalCommission = includeRental ? (rentalCommissionBase * 0.2) : 0
            if (includeRental) rentalsCommissionBaseTotal += rentalCommissionBase

            rentalAgentShare = rentalCommissionBase * 0.05
            rentalCompanyShare = rentalCommissionBase * (isGo4Sea ? 0.05 : 0.15)
            rentalGo4SeaShare = isGo4Sea ? rentalCommissionBase * 0.1 : 0

            commissionAmount = totalCommission
            rentalSupplierShare = includeRental ? Math.max(0, rentalGross - totalCommission) : 0

            rentalCompanyNowForRow = includeRentalNow ? rentalCompanyShare : 0
            rentalCompanyFutureForRow = includeRentalFuture && !includeRentalNow ? rentalCompanyShare : 0

            const agentNow = includeRentalNow ? rentalAgentShare : 0
            const agentFuture = includeRentalFuture && !includeRentalNow ? rentalAgentShare : 0
            const go4SeaNow = includeRentalNow ? rentalGo4SeaShare : 0
            const go4SeaFuture = includeRentalFuture && !includeRentalNow ? rentalGo4SeaShare : 0

            rentalsGross += includeRental ? rentalGross : 0
            rentalsSupplierOut += rentalSupplierShare
            rentalsCommissionTotal += totalCommission
            rentalsCompanyNow += rentalCompanyNowForRow
            rentalsCompanyFuture += rentalCompanyFutureForRow
            rentalsCompanyTotal += includeRental ? rentalCompanyShare : 0
            rentalsAgentTotal += includeRental ? rentalAgentShare : 0
            rentalsAgentNow += agentNow
            rentalsAgentFuture += agentFuture
            rentalsGo4SeaTotal += includeRental ? rentalGo4SeaShare : 0
            rentalsGo4SeaNow += go4SeaNow
            rentalsGo4SeaFuture += go4SeaFuture

            revenue = includeRental ? rentalGross : 0

            if (includeRental) {
              const agentId = (p.assignedToId || p.user?.id) as string | undefined
              if (agentId) {
                const owner = p.assignedTo || p.user
                const agentName = `${owner?.firstName || ''} ${owner?.lastName || ''}`.trim() || owner?.email
                if (!byRentalAgent[agentId]) {
                  byRentalAgent[agentId] = { id: agentId, code: owner?.code || '', name: agentName, count: 0, gross: 0, commissionBase: 0, agentShare: 0, companyShare: 0, go4seaShare: 0 }
                }
                byRentalAgent[agentId].count += 1
                byRentalAgent[agentId].gross += rentalGross
                byRentalAgent[agentId].commissionBase += rentalCommissionBase
                byRentalAgent[agentId].agentShare += rentalAgentShare
                byRentalAgent[agentId].companyShare += rentalCompanyShare
                byRentalAgent[agentId].go4seaShare += rentalGo4SeaShare
              }
            }

            if (includeRental) {
              const method = String(p.paymentMethod || '').trim() || 'N/D'
              if (!rentalsPaymentByMethod[method]) {
                rentalsPaymentByMethod[method] = { name: method, revenue: 0, count: 0 }
              }
              rentalsPaymentByMethod[method].revenue += totalCommission
              rentalsPaymentByMethod[method].count += 1
            }
        }

        if (agency && !isRental && !p.specialServiceType) {
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
            
            // Check for overrides (Excursion/Transfer specific commissions)
            if (p.excursion) {
                const excursionCommissions = commissionsMap[p.excursion.id] || []
                const commRule = excursionCommissions.find(c => c.agencyId === assistantAgency.id)
                if (commRule) {
                    asstCommVal = commRule.commissionPercentage
                    asstCommType = (commRule as any).commissionType || 'PERCENTAGE'
                }
            } else if (p.transfer) {
                const transferCommissions = transferCommissionsMap[p.transfer.id] || []
                const commRule = transferCommissions.find(c => c.agencyId === assistantAgency.id)
                if (commRule) {
                    asstCommVal = commRule.commissionPercentage
                    asstCommType = (commRule as any).commissionType || 'PERCENTAGE'
                }
            }
        }

        if (!asstCommType) asstCommType = 'PERCENTAGE'
        if (asstCommVal === null || asstCommVal === undefined) asstCommVal = 0

        if (isRental) {
            assistantCommissionAmount = 0
        } else if (asstCommVal > 0) {
            if (asstCommType === 'PERCENTAGE') {
                let baseForAssistant = revenue
                if (p.specialServiceType) {
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
            netAgencyForRow = includeFutureRentals ? rentalCompanyShare : rentalCompanyNowForRow
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
        if (isRental) {
            const corfumaniaName = adminAgency?.name || 'Corfumania'
            const corfumaniaNet = includeFutureRentals ? rentalCompanyShare : rentalCompanyNowForRow

            if (!byAgency[corfumaniaName]) {
                byAgency[corfumaniaName] = { name: corfumaniaName, revenue: 0, commission: 0, assistantCommission: 0, netAgency: 0, count: 0, pax: 0, tax: 0 }
            }
            byAgency[corfumaniaName].revenue += 0
            byAgency[corfumaniaName].commission += 0
            byAgency[corfumaniaName].assistantCommission += 0
            byAgency[corfumaniaName].netAgency += corfumaniaNet
            byAgency[corfumaniaName].count += 1
            byAgency[corfumaniaName].pax += pax
            byAgency[corfumaniaName].tax += includeFutureRentals || effectiveRentalType === 'BOAT' ? tax : 0

            const go4SeaNet =
              effectiveRentalType === 'BOAT'
                ? rentalGo4SeaShare
                : (includeFutureRentals ? rentalGo4SeaShare : 0)

            if (go4SeaNet > 0) {
                const go4SeaAgency = agencies.find(a => String(a.name || '').toLowerCase().includes('go4sea'))
                const go4SeaName = go4SeaAgency?.name || 'Go4sea'
                if (!byAgency[go4SeaName]) {
                    byAgency[go4SeaName] = { name: go4SeaName, revenue: 0, commission: 0, assistantCommission: 0, netAgency: 0, count: 0, pax: 0, tax: 0 }
                }
                byAgency[go4SeaName].revenue += 0
                byAgency[go4SeaName].commission += 0
                byAgency[go4SeaName].assistantCommission += 0
                byAgency[go4SeaName].netAgency += go4SeaNet
                byAgency[go4SeaName].count += 1
                byAgency[go4SeaName].pax += pax
                byAgency[go4SeaName].tax += 0
            }
        } else {
            let agencyName = 'Nessuna Agenzia'
            if (userAgencyId && agencyMap[userAgencyId]) {
                agencyName = agencyMap[userAgencyId].name
            }
            
            if (!byAgency[agencyName]) {
                byAgency[agencyName] = { name: agencyName, revenue: 0, commission: 0, assistantCommission: 0, netAgency: 0, count: 0, pax: 0, tax: 0 }
            }
            const agencyStat = byAgency[agencyName]
            if (agencyStat) {
                agencyStat.revenue += revenue
                // For agency-level views, commission represents the sum of assistant quotas
                agencyStat.commission += assistantCommissionAmount
                agencyStat.assistantCommission += assistantCommissionAmount
                agencyStat.netAgency += netAgencyForRow
                agencyStat.count += 1
                agencyStat.pax += pax
                agencyStat.tax += tax
            }
        }

        // By Supplier / Payout Target
        const includeRentalNow = effectiveRentalType === 'BOAT'
        const includeRentalFuture = includeFutureRentals
        const includeRental = includeRentalNow || includeRentalFuture

        const supplierBucketName = p.supplier || 'Nessun Fornitore'

        if (!bySupplier[supplierBucketName]) {
            bySupplier[supplierBucketName] = { name: supplierBucketName, revenue: 0, commission: 0, count: 0, pax: 0, tax: 0 }
        }
        
        // Calculate Supplier Share (for Rentals this is the 80% payout)
        let supplierShare = revenue
        if (isRental) {
            supplierShare = rentalSupplierShare
        }

        bySupplier[supplierBucketName].revenue += supplierShare
        bySupplier[supplierBucketName].commission += 0 
        bySupplier[supplierBucketName].count += 1
        bySupplier[supplierBucketName].pax += pax
        bySupplier[supplierBucketName].tax += isRental ? (includeRental ? tax : 0) : tax

        // By Assistant (exclude RENTALS to avoid mixing "soldi subito" logic with commissions)
        if (!isRental) {
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
        }

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
                byExcursion[excursionKey] = { name: p.excursion.name || 'Senza nome', date: formattedDate, revenue: 0, commission: 0, count: 0, pax: 0, tax: 0 }
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

            const includeRentalNow = effectiveRentalType === 'BOAT'
            const includeRentalFuture = includeFutureRentals
            const includeRental = includeRentalNow || includeRentalFuture
            
            if (!byRental[rentalName]) {
                byRental[rentalName] = { name: rentalName, revenue: 0, gross: 0, commissionBase: 0, commission: 0, agentShare: 0, companyShare: 0, go4seaShare: 0, supplierOut: 0, assistantCommission: 0, supplierShare: 0, netAgency: 0, count: 0, pax: 0, tax: 0 }
            }
            byRental[rentalName].revenue += revenue
            byRental[rentalName].gross += includeRental ? rentalGross : 0
            byRental[rentalName].commissionBase += includeRental ? rentalCommissionBase : 0
            byRental[rentalName].commission += commissionAmount
            byRental[rentalName].agentShare += includeRental ? rentalAgentShare : 0
            byRental[rentalName].companyShare += includeRental ? rentalCompanyShare : 0
            byRental[rentalName].go4seaShare += includeRental ? rentalGo4SeaShare : 0
            byRental[rentalName].supplierOut += rentalSupplierShare
            byRental[rentalName].assistantCommission += 0
            byRental[rentalName].supplierShare += rentalSupplierShare
            byRental[rentalName].netAgency += includeFutureRentals ? rentalCompanyShare : rentalCompanyNowForRow
            byRental[rentalName].count += 1
            byRental[rentalName].pax += pax
            byRental[rentalName].tax += includeRental ? tax : 0
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
        totalExternalAgencyCommission,
        rentals: {
          gross: rentalsGross,
          supplierOut: rentalsSupplierOut,
          commissionTotal: rentalsCommissionTotal,
          commissionBaseTotal: rentalsCommissionBaseTotal,
          carExcludedCostsTotal: rentalsCarExcludedCostsTotal,
          carGrossBaseCount: rentalsCarGrossBaseCount,
          companyNow: rentalsCompanyNow,
          companyFuture: rentalsCompanyFuture,
          companyTotal: rentalsCompanyTotal,
          agentTotal: rentalsAgentTotal,
          agentNow: rentalsAgentNow,
          agentFuture: rentalsAgentFuture,
          go4seaTotal: rentalsGo4SeaTotal,
          go4seaNow: rentalsGo4SeaNow,
          go4seaFuture: rentalsGo4SeaFuture
        }
      },
      taxStats, // New field
      byAgency: Object.values(byAgency).sort((a, b) => b.revenue - a.revenue),
      bySupplier: Object.values(bySupplier),
      byAssistant: Object.values(byAssistant),
      byExcursion: Object.values(byExcursion),
      byTransfer: Object.values(byTransfer),
      byRental: Object.values(byRental),
      byRentalAgent: Object.values(byRentalAgent).sort((a, b) => b.agentShare - a.agentShare),
      byRentalPaymentMethod: Object.values(rentalsPaymentByMethod).sort((a, b) => b.revenue - a.revenue),
      bySpecialService: Object.values(bySpecialService)
    })

  } catch (error) {
    console.error('Error generating report:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
