import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, encrypt } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const body = await request.json()
    const { newPassword } = body

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: 'La password deve essere di almeno 6 caratteri' }, { status: 400 })
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
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24, // 1 day
      path: '/'
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Change password error:', error)
    return NextResponse.json({ error: 'Errore durante il cambio password' }, { status: 500 })
  }
}
