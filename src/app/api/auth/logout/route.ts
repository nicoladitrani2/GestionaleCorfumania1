import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

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
  const cookieStore = await cookies()
  cookieStore.set('session', '', {
    httpOnly: true,
    secure: isSecureCookie(request),
    sameSite: 'lax',
    maxAge: 0,
    path: '/'
  })
  cookieStore.delete('session')
  return NextResponse.json({ success: true })
}
