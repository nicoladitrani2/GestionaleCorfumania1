import { prisma } from '@/lib/prisma'

export async function createAuditLog(
  userId: string,
  action: string,
  details: string,
  excursionId?: string | null,
  transferId?: string | null
) {
  try {
    const data: any = {
      userId,
      action,
      details,
    }

    if (excursionId) {
        data.excursionId = excursionId
    }
    
    if (transferId) {
        data.transferId = transferId
    }

    await prisma.auditLog.create({
      data,
    })
  } catch (error) {
    console.error('Failed to create audit log:', error)
    // Don't throw error to avoid breaking the main operation
  }
}
