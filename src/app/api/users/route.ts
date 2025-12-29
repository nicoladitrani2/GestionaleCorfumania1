import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        code: true,
        createdAt: true
      }
    })
    return NextResponse.json(users)
  } catch (error) {
    return NextResponse.json({ error: 'Errore nel recupero degli utenti' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, firstName, lastName, role, code } = body

    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json({ error: 'Email già registrata' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: role || 'USER',
        code: code || undefined, // Let Prisma generate if undefined, or use provided
        mustChangePassword: true
      }
    })

    const { password: _, ...userWithoutPassword } = user
    return NextResponse.json(userWithoutPassword)
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json({ error: 'Errore nella creazione dell\'utente' }, { status: 500 })
  }
}
