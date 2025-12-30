import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

const DEFAULT_TEMPLATES = [
  'Paxos & Antipaxos',
  'Blue Lagoon',
  'Grand Island Tour',
  'Jeep Safari',
  'Aqualand',
  'Albania Day Trip',
  'Greek Night',
  'Parga & Sivota',
  'Corfu Town Shopping',
  'Boat BBQ'
]

export async function GET() {
  // Check if we have any templates, if not seed defaults
  const count = await prisma.excursionTemplate.count()
  
  if (count === 0) {
    for (const name of DEFAULT_TEMPLATES) {
      await prisma.excursionTemplate.create({
        data: { name }
      }).catch(e => console.error(`Error seeding template ${name}:`, e))
    }
  }

  const templates = await prisma.excursionTemplate.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json(templates)
}

export async function DELETE(request: Request) {
  const session = await getSession()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'ID mancante' }, { status: 400 })
  }

  try {
    await prisma.excursionTemplate.delete({
      where: { id }
    })
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'Errore durante l\'eliminazione' }, { status: 500 })
  }
}
