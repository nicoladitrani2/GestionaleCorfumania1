import { NextResponse } from 'next/server'

export function enforceSameOrigin(request: Request) {
  if (process.env.NODE_ENV !== 'production') return null

  const origin = request.headers.get('origin')
  if (!origin) return null
  if (origin === 'null') return new NextResponse('Forbidden', { status: 403 })

  const url = new URL(request.url)
  const proto = request.headers.get('x-forwarded-proto') || url.protocol.replace(':', '')
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || url.host
  const expected = `${proto}://${host}`

  const allowedOrigins = (process.env.APP_ORIGIN || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  if (allowedOrigins.length > 0) {
    if (!allowedOrigins.includes(origin)) return new NextResponse('Forbidden', { status: 403 })
    return null
  }

  if (origin !== expected) return new NextResponse('Forbidden', { status: 403 })

  return null
}
