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

    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      return addRateLimitHeaders(
        NextResponse.json({ error: 'Credenziali non valide' }, { status: 401 }),
        rlAccount,
        10
      )
    }

    // Fetch agency separately to avoid Prisma Client mismatch issues
    let agencyName = undefined
    if (user.agencyId) {
      const agency = await prisma.agency.findUnique({
        where: { id: user.agencyId }
      })
      agencyName = agency?.name
    }

    const isValid = await bcrypt.compare(password, user.password)

    if (!isValid) {
      return addRateLimitHeaders(
        NextResponse.json({ error: 'Credenziali non valide' }, { status: 401 }),
        rlAccount,
        10
      )
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
