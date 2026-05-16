import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encrypt, getSession } from '@/lib/auth'
import { cookies } from 'next/headers'
import { enforceSameOrigin } from '@/lib/csrf'

function getSessionTtlSeconds() {
  const raw = process.env.SESSION_TTL_SECONDS
  const parsed = raw ? Number(raw) : NaN
  if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed)
  return 8 * 60 * 60
}

function isSecureCookie(request: Request) {
  const forwardedProto = request.headers.get('x-forwarded-proto')
  if (forwardedProto) return forwardedProto === 'https'
  try {
    return new URL(request.url).protocol === 'https:'
  } catch {
    return process.env.NODE_ENV === 'production'
  }
}

export async function POST(request: Request) {
  const csrf = enforceSameOrigin(request)
  if (csrf) return csrf

  const session = await getSession()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const targetUserId = typeof body?.userId === 'string' ? body.userId.trim() : ''
  if (!targetUserId) return NextResponse.json({ error: 'userId richiesto' }, { status: 400 })

  const current = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true },
  })
  if (!current?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      code: true,
      mustChangePassword: true,
      agencyId: true,
      agency: { select: { name: true } },
      isSpecialAssistant: true,
    },
  })

  if (!target?.email) return NextResponse.json({ error: 'Account non trovato' }, { status: 404 })

  if (String(target.email).toLowerCase() !== String(current.email).toLowerCase()) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  const newSession = await encrypt({
    user: {
      id: target.id,
      email: target.email,
      role: target.role,
      firstName: target.firstName,
      lastName: target.lastName,
      code: target.code,
      mustChangePassword: target.mustChangePassword,
      agencyId: target.agencyId,
      agencyName: target.agency?.name,
      isSpecialAssistant: target.isSpecialAssistant,
    },
  })

  const cookieStore = await cookies()
  cookieStore.set('session', newSession, {
    httpOnly: true,
    secure: isSecureCookie(request),
    sameSite: 'lax',
    maxAge: getSessionTtlSeconds(),
    path: '/',
  })

  return NextResponse.json({ success: true })
}
