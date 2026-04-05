import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export async function createAuditLog(
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  details: string,
  excursionId?: string | null,
  transferId?: string | null,
  rentalId?: string | null
) {
  try {
    const data: Prisma.AuditLogUncheckedCreateInput = {
      userId,
      action,
      entityType,
      entityId,
      details,
      ...(excursionId ? { excursionId } : {}),
      ...(transferId ? { transferId } : {}),
      ...(rentalId ? { rentalId } : {})
    }

    await prisma.auditLog.create({
      data
    })
  } catch (error) {
    console.error('Failed to create audit log:', error)
  }
}
