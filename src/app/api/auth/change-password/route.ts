import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, encrypt } from '@/lib/auth'
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

    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const ip = getClientIp(request)
    const rl = rateLimit(`change-password:ip:${ip}:user:${session.user.id}`, 10, 60 * 60 * 1000)
    if (!rl.allowed) {
      return addRateLimitHeaders(
        NextResponse.json({ error: 'Troppe richieste. Riprova più tardi.' }, { status: 429 }),
        rl,
        10
      )
    }

    let body: any = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''

    const minLen = process.env.PASSWORD_MIN_LENGTH ? Number(process.env.PASSWORD_MIN_LENGTH) : 10
    const minLenSafe = Number.isFinite(minLen) && minLen >= 8 ? Math.floor(minLen) : 10
    if (!newPassword || newPassword.length < minLenSafe) {
      return addRateLimitHeaders(
        NextResponse.json({ error: `La password deve essere di almeno ${minLenSafe} caratteri` }, { status: 400 }),
        rl,
        10
      )
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        password: hashedPassword,
        mustChangePassword: false
      }
    })

    // Update session with new flag
    const newSession = await encrypt({
      user: {
        ...session.user,
        mustChangePassword: false
      }
    })

    const cookieStore = await cookies()
    cookieStore.set('session', newSession, {
      httpOnly: true,
      secure: isSecureCookie(request),
      sameSite: 'lax',
      maxAge: getSessionTtlSeconds(),
      path: '/'
    })

    return addRateLimitHeaders(NextResponse.json({ success: true }), rl, 10)
  } catch (error) {
    console.error('Change password error:', error)
    return NextResponse.json({ error: 'Errore durante il cambio password' }, { status: 500 })
  }
}
