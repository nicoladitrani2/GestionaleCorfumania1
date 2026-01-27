import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password } = body

    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      return NextResponse.json({ error: 'Credenziali non valide' }, { status: 401 })
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
      return NextResponse.json({ error: 'Credenziali non valide' }, { status: 401 })
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
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 60, // 30 minutes
      path: '/'
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Login error:', error)
    return NextResponse.json({ error: error.message || 'Errore interno del server' }, { status: 500 })
  }
}
