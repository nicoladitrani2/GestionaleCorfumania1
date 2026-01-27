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
            firstName: true,
            lastName: true,
            createdAt: true,
            price: true,
            deposit: true,
            paymentType: true,
            notes: true,
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
            isRental: true,
            rentalType: true,
            rentalStartDate: true,
            rentalEndDate: true,
            pickupLocation: true,
            dropoffLocation: true
          }
        }
      }
    })

    // Transform data to include distinct names list and derived service types
    const enhancedClients = clients.map(client => {
      const distinctNames = client.participants
        .map(p => `${p.firstName} ${p.lastName}`)
        .filter(name => name.toLowerCase() !== `${client.firstName} ${client.lastName}`.toLowerCase())
      
      // Deduplicate strings just in case
      const uniqueNames = Array.from(new Set(distinctNames))

      // Derive service types from actual participants
      const serviceTypes = new Set<string>()
      client.participants.forEach(p => {
        if (p.excursion) serviceTypes.add('EXCURSION')
        if (p.transfer) serviceTypes.add('TRANSFER')
        if (p.isRental) serviceTypes.add('RENTAL')
      })

      // If no participants, fallback to client.serviceType
      if (serviceTypes.size === 0 && client.serviceType) {
        serviceTypes.add(client.serviceType)
      }

      return {
        ...client,
        associatedNames: uniqueNames,
        derivedServiceTypes: Array.from(serviceTypes)
      }
    })

    return NextResponse.json(enhancedClients)
  } catch (error) {
    console.error('Error fetching clients:', error)
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 })
  }
}
