import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const supplierIds = searchParams.get('supplierIds')?.split(',')
    const assistantIds = searchParams.get('assistantIds')?.split(',')
    const excursionIds = searchParams.get('excursionIds')?.split(',')
    const types = searchParams.get('types')?.split(',')

    const whereClause: any = {
      isExpired: false,
    }

    // Date Filter (Applied to Event Date: Excursion Date or Transfer Date)
    if (startDate || endDate) {
      const dateFilter: any = {}
      if (startDate) dateFilter.gte = new Date(startDate)
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        dateFilter.lte = end
      }

      whereClause.AND = [
        {
          OR: [
            { excursion: { startDate: dateFilter } },
            { transfer: { date: dateFilter } }
          ]
        }
      ]
    }

    // Assistant Filter
    if (assistantIds && assistantIds.length > 0) {
      whereClause.createdById = { in: assistantIds }
    }

    // Supplier Filter (The Agency the assistant belongs to)
    if (supplierIds && supplierIds.length > 0) {
      whereClause.createdBy = {
        supplierId: { in: supplierIds }
      }
    }

    // Excursion Filter
    if (excursionIds && excursionIds.length > 0) {
      whereClause.excursionId = { in: excursionIds }
    }

    // Type Filter (Excursion vs Transfer)
    if (types && types.length > 0) {
      const typeConditions = []
      if (types.includes('EXCURSION')) {
        typeConditions.push({ excursionId: { not: null } })
      }
      if (types.includes('TRANSFER')) {
        typeConditions.push({ transferId: { not: null } })
      }
      
      if (typeConditions.length > 0) {
        whereClause.OR = typeConditions
      }
    }

    // Fetch Data
    const participants = await prisma.participant.findMany({
      where: whereClause,
      include: {
        createdBy: {
          include: {
            supplier: true
          }
        },
        excursion: {
            include: {
                commissions: true
            }
        },
        transfer: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Process Data
    let totalRevenue = 0
    let totalCommission = 0
    let totalPax = 0
    
    const bySupplier: Record<string, { name: string, revenue: number, commission: number, count: number, pax: number }> = {}
    const byAssistant: Record<string, { name: string, revenue: number, commission: number, count: number, pax: number }> = {}
    const byExcursion: Record<string, { name: string, revenue: number, commission: number, count: number, pax: number }> = {}

    participants.forEach(p => {
        if (p.paymentType === 'REFUNDED') return

        const revenue = p.deposit || 0
        const pax = p.groupSize || 1
        
        // Calculate Commission
        let commissionRate = 0
        let commissionAmount = 0

        // Logic for Excursion Commission
        if (p.excursion && p.createdBy.supplierId) {
            const commRule = p.excursion.commissions.find(c => c.supplierId === p.createdBy.supplierId)
            if (commRule) {
                commissionRate = commRule.commissionPercentage
            }
        }

        commissionAmount = (revenue * commissionRate) / 100

        // Aggregates
        totalRevenue += revenue
        totalCommission += commissionAmount
        totalPax += pax

        // By Supplier (Agency)
        const supplierName = p.createdBy.supplier?.name || 'Nessun Fornitore'
        if (!bySupplier[supplierName]) {
            bySupplier[supplierName] = { name: supplierName, revenue: 0, commission: 0, count: 0, pax: 0 }
        }
        bySupplier[supplierName].revenue += revenue
        bySupplier[supplierName].commission += commissionAmount
        bySupplier[supplierName].count += 1
        bySupplier[supplierName].pax += pax

        // By Assistant
        const assistantName = `${p.createdBy.firstName || ''} ${p.createdBy.lastName || ''}`.trim() || p.createdBy.email
        if (!byAssistant[assistantName]) {
            byAssistant[assistantName] = { name: assistantName, revenue: 0, commission: 0, count: 0, pax: 0 }
        }
        byAssistant[assistantName].revenue += revenue
        byAssistant[assistantName].commission += commissionAmount
        byAssistant[assistantName].count += 1
        byAssistant[assistantName].pax += pax

        // By Excursion
        if (p.excursion) {
            const excursionName = p.excursion.name
            if (!byExcursion[excursionName]) {
                byExcursion[excursionName] = { name: excursionName, revenue: 0, commission: 0, count: 0, pax: 0 }
            }
            byExcursion[excursionName].revenue += revenue
            byExcursion[excursionName].commission += commissionAmount
            byExcursion[excursionName].count += 1
            byExcursion[excursionName].pax += pax
        }
    })

    return NextResponse.json({
        summary: {
            totalRevenue,
            totalCommission,
            netRevenue: totalRevenue - totalCommission,
            count: participants.filter(p => p.paymentType !== 'REFUNDED').length,
            totalPax
        },
        bySupplier: Object.values(bySupplier),
        byAssistant: Object.values(byAssistant),
        byExcursion: Object.values(byExcursion)
    })

  } catch (error) {
    console.error('Error generating report:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
