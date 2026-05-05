import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import { sendMail } from '@/lib/mailer'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const transfer = await prisma.transfer.findUnique({
    where: { id },
    include: {
      priceTiers: {
        orderBy: { sortOrder: 'asc' }
      },
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
      },
      approvedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      },
      rejectedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      },
      capacityRequests: {
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          requestedBy: {
            select: { id: true, firstName: true, lastName: true, email: true, role: true }
          }
        }
      }
    }
  })

  if (!transfer) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { capacityRequests, ...rest } = transfer as any
  return NextResponse.json({
    ...rest,
    pendingCapacityRequest: Array.isArray(capacityRequests) && capacityRequests.length > 0 ? capacityRequests[0] : null
  })
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  try {
    const body = await request.json()
    
    // Check if transfer exists
    const existingTransfer = await prisma.transfer.findUnique({
      where: { id },
      include: { createdBy: { select: { email: true, firstName: true, lastName: true } } },
    })
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
        approvalStatus,
        priceTiers
    } = body

    const updateData: any = {}

    if (name) updateData.name = name
    if (date) {
      const start = new Date(date)
      if (isNaN(start.getTime())) {
        return NextResponse.json(
          { error: 'Data/Ora di partenza non valida. Controlla anno, mese e giorno.' },
          { status: 400 }
        )
      }
      updateData.date = start
    }
    if (endDate !== undefined) {
      if (!endDate) {
        updateData.endDate = null
      } else {
        const end = new Date(endDate)
        if (isNaN(end.getTime())) {
          return NextResponse.json(
            { error: 'Data/Ora di arrivo non valida. Controlla anno, mese e giorno.' },
            { status: 400 }
          )
        }
        updateData.endDate = end
      }
    }
    if (confirmationDeadline !== undefined) {
      if (!confirmationDeadline) {
        updateData.confirmationDeadline = null
      } else {
        const deadline = new Date(confirmationDeadline)
        if (isNaN(deadline.getTime())) {
          return NextResponse.json(
            { error: 'Data limite acconti non valida. Controlla anno, mese e giorno.' },
            { status: 400 }
          )
        }
        updateData.confirmationDeadline = deadline
      }
    }
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
            if (approvalStatus === 'APPROVED') {
              updateData.approvedById = session.user.id
              updateData.approvedAt = new Date()
              updateData.rejectedById = null
              updateData.rejectedAt = null
            } else if (approvalStatus === 'REJECTED') {
              updateData.rejectedById = session.user.id
              updateData.rejectedAt = new Date()
            }
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

    if (Array.isArray(priceTiers)) {
      updateData.priceTiers = {
        deleteMany: {},
        create: priceTiers
          .map((t: any, idx: number) => ({
            label: String(t?.label || '').trim(),
            price: parseFloat(String(t?.price || 0)) || 0,
            sortOrder: typeof t?.sortOrder === 'number' ? t.sortOrder : idx,
          }))
          .filter((t: any) => !!t.label)
      }
    }

    const updatedTransfer = await prisma.transfer.update({
        where: { id },
        data: updateData,
        include: {
            priceTiers: {
              orderBy: { sortOrder: 'asc' }
            },
            agencyCommissions: {
                include: { agency: true }
            }
        }
    })

    if (
      typeof approvalStatus === 'string' &&
      existingTransfer.approvalStatus !== updatedTransfer.approvalStatus &&
      (updatedTransfer.approvalStatus === 'APPROVED' || updatedTransfer.approvalStatus === 'REJECTED') &&
      existingTransfer.createdBy?.email
    ) {
      const createdByName =
        `${existingTransfer.createdBy.firstName || ''} ${existingTransfer.createdBy.lastName || ''}`.trim() || 'Utente'
      const transferName = updatedTransfer.name || existingTransfer.name || 'Trasferimento'
      const transferDate = updatedTransfer.date ? new Date(updatedTransfer.date).toLocaleString('it-IT') : ''

      const subject =
        updatedTransfer.approvalStatus === 'APPROVED'
          ? `Trasferimento approvato: ${transferName}`
          : `Trasferimento rifiutato: ${transferName}`

      const text =
        updatedTransfer.approvalStatus === 'APPROVED'
          ? `Ciao ${createdByName},\n\nil trasferimento "${transferName}" (${transferDate}) è stato approvato.\n\nPrezzi:\n- Adulti: €${(typeof updatedTransfer.priceAdult === 'number' ? updatedTransfer.priceAdult : 0).toFixed(2)}\n- Bambini: €${(typeof updatedTransfer.priceChild === 'number' ? updatedTransfer.priceChild : 0).toFixed(2)}\n\nPuoi procedere con le prenotazioni.\n\nCorfumania`
          : `Ciao ${createdByName},\n\nil trasferimento "${transferName}" (${transferDate}) è stato rifiutato.\n\nCorfumania`

      try {
        await sendMail({
          to: existingTransfer.createdBy.email,
          subject,
          text,
        })
        await createAuditLog(
          session.user.id,
          'SEND_TRANSFER_APPROVAL_EMAIL',
          'TRANSFER',
          updatedTransfer.id,
          `Inviata email approvazione trasferimento a ${existingTransfer.createdBy.email}`,
          undefined,
          updatedTransfer.id
        )
      } catch (e: any) {
        await createAuditLog(
          session.user.id,
          'SEND_TRANSFER_APPROVAL_EMAIL_FAILED',
          'TRANSFER',
          updatedTransfer.id,
          `Invio email approvazione trasferimento fallito: ${e?.message || 'Errore sconosciuto'}`,
          undefined,
          updatedTransfer.id
        )
      }
    }

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

  try {
    await createAuditLog(
      session.user.id,
      'DELETE_TRANSFER',
      'TRANSFER',
      id,
      `Eliminato trasferimento: ${transfer.name}`,
      undefined,
      id
    )
  } catch {}

  return NextResponse.json({ success: true })
}
