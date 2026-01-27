import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, defaultCommission, commissionType } = body

    if (!name) {
      return NextResponse.json({ error: 'Nome richiesto' }, { status: 400 })
    }

    const agency = await prisma.agency.update({
      where: { id },
      data: { 
        name,
        defaultCommission: defaultCommission !== undefined ? parseFloat(defaultCommission) : undefined,
        commissionType: commissionType || undefined
      }
    })

    return NextResponse.json(agency)
  } catch (error) {
    console.error('Error updating agency:', error)
    return NextResponse.json({ error: 'Errore durante l\'aggiornamento' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.agency.delete({
      where: { id }
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting agency:', error)
    return NextResponse.json({ error: 'Errore durante l\'eliminazione' }, { status: 500 })
  }
}
