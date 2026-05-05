import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const clients = await prisma.client.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { participants: true }
        },
        participants: {
          select: {
            id: true,
            name: true,
            createdAt: true,
            totalPrice: true,
            paidAmount: true,
            paymentType: true,
            adults: true,
            children: true,
            infants: true,
            notes: true,
            rentalStartDate: true,
            excursion: {
              select: {
                id: true,
                name: true,
                startDate: true
              }
            },
            transfer: {
              select: {
                id: true,
                name: true,
                date: true
              }
            },
            rental: {
              select: {
                id: true,
                name: true,
                type: true
              }
            },
            pickupLocation: true,
            dropoffLocation: true
          }
        }
      }
    })

    // Transform data to include distinct names list and derived service types
    const enhancedClients = clients.map(client => {
      const distinctNames = client.participants
        .map(p => p.name as string)
        .filter(name => name.toLowerCase() !== `${client.firstName} ${client.lastName}`.toLowerCase())
      
      // Deduplicate strings just in case
      const uniqueNames = Array.from(new Set(distinctNames))

      // Derive service types from actual participants
      const serviceTypes = new Set<string>()
      const servicePaxByType: Record<string, number> = { EXCURSION: 0, TRANSFER: 0, RENTAL: 0 }
      const eventDates: Date[] = []
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
      client.participants.forEach(p => {
        const pax = Math.max(1, (p.adults || 0) + (p.children || 0) + (p.infants || 0))
        if (p.excursion) {
          serviceTypes.add('EXCURSION')
          servicePaxByType.EXCURSION += pax
          if (p.excursion.startDate) {
            const d = new Date(p.excursion.startDate as any)
            if (!Number.isNaN(d.getTime())) eventDates.push(d)
          }
        }
        if (p.transfer) {
          serviceTypes.add('TRANSFER')
          servicePaxByType.TRANSFER += pax
          if ((p.transfer as any).date) {
            const d = new Date((p.transfer as any).date)
            if (!Number.isNaN(d.getTime())) eventDates.push(d)
          }
        }
        if (p.rental) {
          serviceTypes.add('RENTAL')
          servicePaxByType.RENTAL += pax
          if ((p as any).rentalStartDate) {
            const d = new Date((p as any).rentalStartDate)
            if (!Number.isNaN(d.getTime())) eventDates.push(d)
          }
        }
      })

      const upcomingEventDates = eventDates
        .map(d => new Date(d))
        .filter(d => !Number.isNaN(d.getTime()) && d.getTime() >= todayStart.getTime())
        .sort((a, b) => a.getTime() - b.getTime())

      const nextEventStartDate = upcomingEventDates.length > 0 ? upcomingEventDates[0] : null

      // If no participants, fallback to client.serviceType
      if (serviceTypes.size === 0 && client.serviceType) {
        serviceTypes.add(client.serviceType)
      }

      return {
        ...client,
        associatedNames: uniqueNames,
        derivedServiceTypes: Array.from(serviceTypes),
        servicePaxByType,
        nextEventStartDate: nextEventStartDate ? nextEventStartDate.toISOString() : null
      }
    })

    return NextResponse.json(enhancedClients)
  } catch (error) {
    console.error('Error fetching clients:', error)
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 })
  }
}
