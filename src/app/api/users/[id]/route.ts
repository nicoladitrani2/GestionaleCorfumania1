import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { email, password, firstName, lastName, role, code, agencyId, isSpecialAssistant } = body

    const dataToUpdate: any = {
      email,
      firstName,
      lastName,
      role,
      code,
      agencyId: agencyId || null,
    }
    if (typeof isSpecialAssistant !== 'undefined') {
      dataToUpdate.isSpecialAssistant = !!isSpecialAssistant
    }

    if (password) {
      dataToUpdate.password = await bcrypt.hash(password, 10)
      dataToUpdate.mustChangePassword = true
    }

    const user = await prisma.user.update({
      where: { id },
      data: dataToUpdate
    })

    const { password: _, ...userWithoutPassword } = user
    return NextResponse.json(userWithoutPassword)
  } catch (error) {
    return NextResponse.json({ error: 'Errore nell\'aggiornamento dell\'utente' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  try {
    const { id } = await params
    await prisma.user.delete({
      where: { id }
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Errore nell\'eliminazione dell\'utente' }, { status: 500 })
  }
}
