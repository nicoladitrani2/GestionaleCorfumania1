import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decrypt } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  const cookie = request.cookies.get('session')?.value
  let session = null
  if (cookie) {
    try {
      session = await decrypt(cookie)
    } catch (e) {}
  }

  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // Force password change if required
  if (session?.user?.mustChangePassword) {
    // Allow access to change-password page and API routes/static assets
    if (!request.nextUrl.pathname.startsWith('/change-password') && 
        !request.nextUrl.pathname.startsWith('/api') &&
        !request.nextUrl.pathname.startsWith('/_next') &&
        !request.nextUrl.pathname.startsWith('/static')) {
      return NextResponse.redirect(new URL('/change-password', request.url))
    }
  }

  if (request.nextUrl.pathname === '/login') {
    if (session) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
}
