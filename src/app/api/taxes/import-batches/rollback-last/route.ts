import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import { addRateLimitHeaders, getClientIp, rateLimit } from '@/lib/rateLimit'
import { enforceSameOrigin } from '@/lib/csrf'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 })
  if (session.user.role !== 'ADMIN') return new NextResponse('Forbidden', { status: 403 })

  const csrf = enforceSameOrigin(request)
  if (csrf) return csrf

  const ip = getClientIp(request)
  const rl = rateLimit(`tax-import:rollback:last:ip:${ip}:admin:${session.user.id}`, 10, 60 * 60 * 1000)
  if (!rl.allowed) {
    return addRateLimitHeaders(new NextResponse('Too Many Requests', { status: 429 }), rl, 10)
  }

  const lastBatch = await prisma.taxImportBatch.findFirst({
    where: { rolledBackAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })

  if (!lastBatch) return addRateLimitHeaders(NextResponse.json({ success: true, restored: 0, deleted: 0, batchId: null }), rl, 10)

  const result = await prisma.$transaction(async (tx) => {
    const affected = await tx.taxBooking.findMany({
      where: { importBatchId: lastBatch.id },
      select: {
        id: true,
        nFile: true,
        week: true,
        serviceCode: true,
      },
    })

    let restored = 0
    let deleted = 0

    for (const b of affected) {
      const backup = await tx.taxBookingBackup.findUnique({
        where: { taxBookingId_batchId: { taxBookingId: b.id, batchId: lastBatch.id } },
        select: { snapshot: true, prevImportBatchId: true },
      })

      if (!backup) {
        await tx.taxBooking.delete({ where: { id: b.id } })
        deleted += 1
        continue
      }

      let snap: any = {}
      try {
        snap = JSON.parse(backup.snapshot || '{}')
      } catch {
        snap = {}
      }

      await tx.taxBooking.update({
        where: { id: b.id },
        data: {
          provenienza: String(snap.provenienza || ''),
          serviceCode: Number(snap.serviceCode || b.serviceCode),
          pax: Number(snap.pax || 0),
          leadName: String(snap.leadName || ''),
          room: snap.room ? String(snap.room) : null,
          totalAmount: Number(snap.totalAmount || 0),
          assignedToId: snap.assignedToId ? String(snap.assignedToId) : null,
          customerPaid: Boolean(snap.customerPaid),
          adminPaid: Boolean(snap.adminPaid),
          rawData: String(snap.rawData || '{}'),
          depositStatus: String(snap.depositStatus || 'PENDING'),
          depositProcessedAt: snap.depositProcessedAt ? new Date(String(snap.depositProcessedAt)) : null,
          importBatchId: backup.prevImportBatchId ? String(backup.prevImportBatchId) : null,
        },
      })

      restored += 1
    }

    await tx.taxImportBatch.update({
      where: { id: lastBatch.id },
      data: { rolledBackAt: new Date() },
    })

    const keep = await tx.taxImportBatch.findMany({
      where: { rolledBackAt: null },
      orderBy: { createdAt: 'desc' },
      take: 2,
      select: { id: true },
    })

    await tx.taxBookingBackup.deleteMany({
      where: { batchId: { notIn: keep.map(k => k.id) } },
    })

    return { restored, deleted }
  })

  await createAuditLog(session.user.id, 'TAX_IMPORT_ROLLBACK_LAST', 'TAX_IMPORT', lastBatch.id, `Rollback ultimo import: restored=${result.restored}, deleted=${result.deleted}`)
  return addRateLimitHeaders(NextResponse.json({ success: true, ...result, batchId: lastBatch.id }), rl, 10)
}
