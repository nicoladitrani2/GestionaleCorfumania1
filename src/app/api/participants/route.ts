import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import nodemailer from 'nodemailer'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const excursionId = searchParams.get('excursionId')
  const transferId = searchParams.get('transferId')
  const isRental = searchParams.get('isRental') === 'true'

  if (!excursionId && !transferId && !isRental) return NextResponse.json({ error: 'Excursion ID, Transfer ID, or isRental required' }, { status: 400 })

  const whereClause: any = {}
  if (excursionId) whereClause.excursionId = excursionId
  if (transferId) whereClause.transferId = transferId
  if (isRental) whereClause.rentalId = { not: null }

  // Auto-expire logic DISABLED due to schema changes
  /*
  const now = new Date()
  if (excursionId) { ... }
  */

  const participants = await prisma.participant.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    include: { 
      user: { 
        select: { 
          firstName: true, 
          lastName: true, 
          email: true, 
          code: true,
          role: true,
          agencyId: true,
          agency: {
            select: { 
              name: true,
              defaultCommission: true,
              commissionType: true
            }
          }
        } 
      } 
    }
  })

  return NextResponse.json(participants)
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()

    // Validation
    if (body.firstName !== undefined && !body.firstName?.trim()) {
      return NextResponse.json({ error: 'Il nome è obbligatorio.' }, { status: 400 })
    }
    
    const { 
      excursionId, transferId, rentalId,
      firstName, lastName, email, phoneNumber, 
      adults, children, infants,
      price, tax, 
      paymentType, paymentMethod,
      notes, supplier, pickupLocation, dropoffLocation,
      nationality
    } = body

    const name = `${firstName || ''} ${lastName || ''}`.trim()
    const totalPrice = parseFloat(String(price)) || 0
    const totalTax = parseFloat(String(tax)) || 0

    // Client Management Logic REMOVED due to missing Client model
    
    const participant = await prisma.participant.create({
      data: {
        excursionId: excursionId || null,
        transferId: transferId || null,
        rentalId: rentalId || null,
        name,
        email,
        phone: phoneNumber,
        nationality,
        adults: parseInt(adults) || 0,
        children: parseInt(children) || 0,
        infants: parseInt(infants) || 0,
        totalPrice,
        tax: totalTax,
        paidAmount: 0,
        paymentMethod: paymentMethod || 'CASH',
        paymentStatus: 'PENDING',
        status: 'ACTIVE',
        paymentType: paymentType || 'FULL_PAYMENT',
        notes,
        supplier,
        pickupLocation,
        dropoffLocation,
        userId: session.user.id
      }
    })

    await createAuditLog('CREATE', 'PARTICIPANT', participant.id, session.user.id, JSON.stringify({ name, totalPrice }))

    return NextResponse.json(participant)
  } catch (error) {
    console.error('Error creating participant:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
