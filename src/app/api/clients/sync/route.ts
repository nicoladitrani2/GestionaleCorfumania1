import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // 1. Find participants without a client linked
    const participantsWithoutClient = await prisma.participant.findMany({
      where: {
        clientId: null
      },
      take: 100, // Process in batches of 100 to avoid timeouts
      orderBy: { createdAt: 'desc' }
    })

    let processedCount = 0
    let errorsCount = 0

    for (const p of participantsWithoutClient) {
      try {
        let clientId: string | undefined
        let serviceType = 'EXCURSION'
        if (p.transferId) serviceType = 'TRANSFER'
        if (p.isRental) serviceType = 'RENTAL'

        if (p.email) {
          // Check if client exists with this email
          const existingClient = await prisma.client.findUnique({
            where: { email: p.email }
          })

          if (existingClient) {
            clientId = existingClient.id
            // Optional: Update serviceType to the most recent one
            // await prisma.client.update({ where: { id: clientId }, data: { serviceType } })
          } else {
            // Create new client
            const newClient = await prisma.client.create({
              data: {
                firstName: p.firstName,
                lastName: p.lastName,
                email: p.email,
                phoneNumber: p.phoneNumber,
                nationality: p.nationality,
                serviceType
              }
            })
            clientId = newClient.id
          }
        } else {
          // No email, create a new client entry
          // Since we can't dedup by email, we just create a new one.
          // This might create duplicates if the same person books multiple times without email,
          // but that's the trade-off.
          const newClient = await prisma.client.create({
            data: {
              firstName: p.firstName,
              lastName: p.lastName,
              email: null,
              phoneNumber: p.phoneNumber,
              nationality: p.nationality,
              serviceType
            }
          })
          clientId = newClient.id
        }

        // Update the participant
        if (clientId) {
          await prisma.participant.update({
            where: { id: p.id },
            data: { clientId }
          })
          processedCount++
        }
      } catch (err) {
        console.error(`Error processing participant ${p.id}:`, err)
        errorsCount++
      }
    }

    const remaining = await prisma.participant.count({
      where: { clientId: null }
    })

    return NextResponse.json({
      success: true,
      processed: processedCount,
      errors: errorsCount,
      remaining
    })

  } catch (error) {
    console.error('Error syncing clients:', error)
    return NextResponse.json({ error: 'Failed to sync clients' }, { status: 500 })
  }
}
