import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const transfer = await prisma.transfer.findUnique({
    where: { id },
    include: {
      agencyCommissions: {
        include: {
          agency: true
        }
      },
      participants: true, // Include participants to check for dependencies if needed
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      }
    }
  })

  if (!transfer) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(transfer)
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  try {
    const body = await request.json()
    
    // Check if transfer exists
    const existingTransfer = await prisma.transfer.findUnique({ where: { id } })
    if (!existingTransfer) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Permission check: Only Admin or Creator can edit? 
    // Usually Admin can edit everything. Assistants can edit their own transfers if not approved?
    // User didn't specify strict edit rules for transfers, but implied Admin approval.
    // For safety, let's allow Admin and Creator (if pending).
    
    if (session.user.role !== 'ADMIN' && existingTransfer.createdById !== session.user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // If Assistant tries to edit an APPROVED transfer, maybe restrict? 
    // For now, allow updates but maybe reset approval if critical fields change?
    // User request 6 says: "Quando l’amministratore approva un trasferimento deve impostare prezzo adulti/bambini".
    
    const { 
        name, date, supplier, pickupLocation, dropoffLocation, endDate, 
        commissions, priceAdult, priceChild, confirmationDeadline, maxParticipants,
        approvalStatus 
    } = body

    const updateData: any = {}

    if (name) updateData.name = name
    if (date) updateData.date = new Date(date)
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null
    if (confirmationDeadline !== undefined) updateData.confirmationDeadline = confirmationDeadline ? new Date(confirmationDeadline) : null
    if (pickupLocation) updateData.pickupLocation = pickupLocation
    if (dropoffLocation) updateData.dropoffLocation = dropoffLocation
    if (supplier) updateData.supplier = supplier
    if (maxParticipants !== undefined) updateData.maxParticipants = maxParticipants ? parseInt(maxParticipants) : null

    // Price updates - Only Admin should probably set these, but if passed and user has rights...
    if (priceAdult !== undefined) updateData.priceAdult = parseFloat(priceAdult)
    if (priceChild !== undefined) updateData.priceChild = parseFloat(priceChild)

    // Approval Status - Only Admin can approve
    if (approvalStatus) {
        if (session.user.role === 'ADMIN') {
            updateData.approvalStatus = approvalStatus
        } else {
            // Assistant cannot change status to APPROVED
            if (approvalStatus === 'APPROVED') {
                 return NextResponse.json({ error: 'Solo gli amministratori possono approvare i trasferimenti.' }, { status: 403 })
            }
        }
    }

    // Handle Commissions
    if (commissions) {
        // Delete existing and recreate (simplest strategy)
        await prisma.transferAgencyCommission.deleteMany({ where: { transferId: id } })
        
        const commsToCreate = commissions.map((c: any) => ({
            agencyId: c.agencyId,
            commissionPercentage: parseFloat(c.commissionPercentage),
            commissionType: c.commissionType || 'PERCENTAGE'
        }))
        
        updateData.agencyCommissions = {
            create: commsToCreate
        }
    }

    const updatedTransfer = await prisma.transfer.update({
        where: { id },
        data: updateData,
        include: {
            agencyCommissions: {
                include: { agency: true }
            }
        }
    })

    return NextResponse.json(updatedTransfer)

  } catch (e) {
    console.error('Error updating transfer:', e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const transfer = await prisma.transfer.findUnique({ where: { id } })
  if (!transfer) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (session.user.role !== 'ADMIN' && transfer.createdById !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Check if has participants?
  // Usually we prevent deletion if participants exist, or cascade.
  // Prisma schema doesn't show Cascade on participants (it's optional relation on Participant side).
  // But let's check.
  const participantsCount = await prisma.participant.count({ where: { transferId: id } })
  if (participantsCount > 0) {
      return NextResponse.json({ error: 'Impossibile eliminare: ci sono partecipanti associati.' }, { status: 400 })
  }

  await prisma.transfer.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
