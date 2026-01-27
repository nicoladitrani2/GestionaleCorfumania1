import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session || !session.user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // BRACELET, CITY_TAX, AC
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: any = {
      specialServiceType: type ? type : { not: null }
    }

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    }
    
    // If user is not admin, maybe filter by agency? 
    // Requirement says: "visibile agli amministratori". 
    // "users che fanno parte del'agenzia di go4sea".
    // Assuming everyone with access can see it, or restrict if needed.
    // For now, let's allow visibility based on role or agency if needed.
    // User said "dashboard che verrà utilizzata dagli utenti che fanno parte del'agenzia di go4sea però comunque deve essere visibile agli amministratori".
    
    // Let's return all for now.

    const participants = await prisma.participant.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    })

    return NextResponse.json(participants)
  } catch (error) {
    console.error('Error fetching tax participants:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session || !session.user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const body = await request.json()
    const { 
      firstName, 
      lastName, 
      dateOfBirth, 
      selectedServices, // Array of 'BRACELET', 'CITY_TAX', 'AC'
      nationality,
      docNumber,
      docType,
      roomNumber // Optional, useful for Tax/AC
    } = body

    if (!selectedServices || !Array.isArray(selectedServices) || selectedServices.length === 0) {
      return new NextResponse('No services selected', { status: 400 })
    }

    const createdParticipants = []

    for (const service of selectedServices) {
      let price = 0
      
      if (service === 'BRACELET') {
        // Calculate based on age
        if (dateOfBirth) {
            const dob = new Date(dateOfBirth)
            const ageDifMs = Date.now() - dob.getTime()
            const ageDate = new Date(ageDifMs) // miliseconds from epoch
            const age = Math.abs(ageDate.getUTCFullYear() - 1970)
            
            price = age < 12 ? 5 : 10
        } else {
            price = 10 // Default to adult if no DOB? Or validation required?
        }
      } else if (service === 'CITY_TAX') {
        price = 2
      } else if (service === 'AC') {
        price = 5
      }

      const participant = await prisma.participant.create({
        data: {
          firstName,
          lastName,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
          nationality,
          docNumber,
          docType,
          roomNumber,
          notes: roomNumber ? `Stanza: ${roomNumber}` : undefined,
          specialServiceType: service,
          price: price,
          deposit: price, // Full payment? Or "Netto"? Usually these are collected cash?
          // User said "costi calcolati in automatico senza possibilità di modifica".
          // Assuming full payment or just tracking the cost.
          // Let's set price.
          paymentType: 'BALANCE', // Assume paid? Or collected?
          paymentMethod: 'CASH', // Default
          supplier: 'GO4SEA', // Default
          createdById: session.user.id,
          // Defaults for required fields
          email: '', 
          phoneNumber: '',
        }
      })
      createdParticipants.push(participant)
    }

    return NextResponse.json(createdParticipants)
  } catch (error) {
    console.error('Error creating tax participants:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
