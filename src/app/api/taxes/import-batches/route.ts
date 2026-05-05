import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import { addRateLimitHeaders, getClientIp, rateLimit } from '@/lib/rateLimit'
import { enforceSameOrigin } from '@/lib/csrf'

export async function GET() {
  const session = await getSession()
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 })
  if (session.user.role !== 'ADMIN') return new NextResponse('Forbidden', { status: 403 })

  const batches = await prisma.taxImportBatch.findMany({
    where: { rolledBackAt: null },
    orderBy: { createdAt: 'desc' },
    take: 2,
    select: { id: true, fileName: true, createdAt: true, createdById: true },
  })

  return NextResponse.json({ batches })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 })
  if (session.user.role !== 'ADMIN') {
    const u = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isSpecialAssistant: true },
    })
    if (!u?.isSpecialAssistant) return new NextResponse('Forbidden', { status: 403 })
  }

  const csrf = enforceSameOrigin(request)
  if (csrf) return csrf

  const ip = getClientIp(request)
  const rl = rateLimit(
    `tax-import-batch:create:ip:${ip}:${session.user.role === 'ADMIN' ? 'admin' : 'special'}:${session.user.id}`,
    30,
    60 * 60 * 1000
  )
  if (!rl.allowed) {
    return addRateLimitHeaders(new NextResponse('Too Many Requests', { status: 429 }), rl, 30)
  }

  let body: any = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const fileName = body?.fileName ? String(body.fileName) : null

  const batch = await prisma.taxImportBatch.create({
    data: {
      fileName,
      createdById: session.user.id,
    },
    select: { id: true, fileName: true, createdAt: true },
  })

  await createAuditLog(session.user.id, 'TAX_IMPORT_CREATED', 'TAX_IMPORT', batch.id, `Import Excel creato: ${fileName || '-'}`)
  return addRateLimitHeaders(NextResponse.json({ batch }), rl, 30)
}
