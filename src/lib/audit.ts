import { prisma } from '@/lib/prisma'

export async function createAuditLog(
  userId: string,
  excursionId: string,
  action: string,
  details: string
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        excursionId,
        action,
        details,
      },
    })
  } catch (error) {
    console.error('Failed to create audit log:', error)
    // Don't throw error to avoid breaking the main operation
  }
}
