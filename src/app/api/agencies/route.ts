import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const agencies = await prisma.agency.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { users: true }
        }
      }
    })
    return NextResponse.json(agencies)
  } catch (error) {
    console.error('Error fetching agencies:', error)
    return NextResponse.json({ error: 'Errore nel recupero delle agenzie' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, defaultCommission, commissionType } = body

    if (!name) {
      return NextResponse.json({ error: 'Nome richiesto' }, { status: 400 })
    }

    const existing = await prisma.agency.findUnique({
      where: { name }
    })

    if (existing) {
      return NextResponse.json({ error: 'Agenzia già esistente' }, { status: 400 })
    }

    const agency = await prisma.agency.create({
      data: { 
        name,
        defaultCommission: defaultCommission ? parseFloat(defaultCommission) : 0,
        commissionType: commissionType || 'PERCENTAGE'
      }
    })

    return NextResponse.json(agency)
  } catch (error) {
    console.error('Error creating agency:', error)
    return NextResponse.json({ error: 'Errore nella creazione dell\'agenzia' }, { status: 500 })
  }
}
