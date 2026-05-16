import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { addRateLimitHeaders, getClientIp, rateLimit } from '@/lib/rateLimit'
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
  try {
    const csrf = enforceSameOrigin(request)
    if (csrf) return csrf

    const ip = getClientIp(request)
    const rl = rateLimit(`login:ip:${ip}`, 30, 10 * 60 * 1000)
    if (!rl.allowed) {
      return addRateLimitHeaders(
        NextResponse.json({ error: 'Troppe richieste. Riprova più tardi.' }, { status: 429 }),
        rl,
        30
      )
    }

    let body: any = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }

    const email = typeof body?.email === 'string' ? body.email.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    if (!email || !password) {
      return addRateLimitHeaders(
        NextResponse.json({ error: 'Credenziali non valide' }, { status: 401 }),
        rl,
        30
      )
    }

    const rlAccount = rateLimit(`login:ip-email:${ip}:${email.toLowerCase()}`, 10, 10 * 60 * 1000)
    if (!rlAccount.allowed) {
      return addRateLimitHeaders(
        NextResponse.json({ error: 'Troppe richieste. Riprova più tardi.' }, { status: 429 }),
        rlAccount,
        10
      )
    }

    const requestedUserId = typeof body?.userId === 'string' ? body.userId.trim() : ''

    const users = await prisma.user.findMany({
      where: {
        email: { equals: email, mode: 'insensitive' },
        ...(requestedUserId ? { id: requestedUserId } : {}),
      },
    })

    if (!users.length) {
      return addRateLimitHeaders(
        NextResponse.json({ error: 'Credenziali non valide' }, { status: 401 }),
        rlAccount,
        10
      )
    }

    const matches: any[] = []
    for (const u of users) {
      const ok = await bcrypt.compare(password, u.password)
      if (ok) matches.push(u)
    }

    if (!matches.length) {
      return addRateLimitHeaders(
        NextResponse.json({ error: 'Credenziali non valide' }, { status: 401 }),
        rlAccount,
        10
      )
    }

    if (!requestedUserId && matches.length > 1) {
      const accounts = await prisma.user.findMany({
        where: {
          email: { equals: email, mode: 'insensitive' },
          id: { in: matches.map(m => m.id) },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          code: true,
          role: true,
          isSpecialAssistant: true,
          agency: { select: { name: true } },
        },
        orderBy: [{ role: 'asc' }, { firstName: 'asc' }, { lastName: 'asc' }],
      })
      return addRateLimitHeaders(
        NextResponse.json({
          error: 'Sono disponibili più account per questa email.',
          code: 'MULTIPLE_ACCOUNTS',
          accounts: accounts.map(a => ({
            id: a.id,
            firstName: a.firstName,
            lastName: a.lastName,
            code: a.code,
            role: a.role,
            isSpecialAssistant: a.isSpecialAssistant,
            agencyName: a.agency?.name ?? null,
          })),
        }, { status: 409 }),
        rlAccount,
        10
      )
    }

    const user = matches[0]

    // Fetch agency separately to avoid Prisma Client mismatch issues
    let agencyName = undefined
    if (user.agencyId) {
      const agency = await prisma.agency.findUnique({
        where: { id: user.agencyId }
      })
      agencyName = agency?.name
    }

    const session = await encrypt({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        code: user.code,
        mustChangePassword: user.mustChangePassword,
        agencyId: user.agencyId,
        agencyName: agencyName
      }
    })

    const cookieStore = await cookies()
    cookieStore.set('session', session, {
      httpOnly: true,
      secure: isSecureCookie(request),
      sameSite: 'lax',
      maxAge: getSessionTtlSeconds(),
      path: '/'
    })

    return addRateLimitHeaders(NextResponse.json({ success: true }), rl, 30)
  } catch (error: any) {
    console.error('Login error:', error)
    const isDbUnreachable = String(error?.code) === 'P1001' || String(error?.message || '').includes("Can't reach database server")
    const safeMessage = isDbUnreachable
      ? 'Impossibile contattare il database. Verifica la connessione e riprova.'
      : 'Errore interno del server'
    return NextResponse.json({ error: safeMessage }, { status: 500 })
  }
}
