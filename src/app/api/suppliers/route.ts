import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  try {
    let suppliers = await prisma.supplier.findMany({
      orderBy: { name: 'asc' }
    })

    // Auto-seed Corfumania if missing (Critical for default logic)
    const hasCorfumania = suppliers.some(s => s.name.toLowerCase() === 'corfumania')
    if (!hasCorfumania) {
      try {
        const newSupplier = await prisma.supplier.create({ 
          data: { name: 'Corfumania' } 
        })
        suppliers.push(newSupplier)
        // Re-sort
        suppliers.sort((a, b) => a.name.localeCompare(b.name))
      } catch (seedError) {
        console.error("Failed to auto-seed Corfumania:", seedError)
        // Continue without it, don't block the API
      }
    }

    return NextResponse.json(suppliers)
  } catch (error) {
    console.error("Failed to fetch suppliers:", error)
    return NextResponse.json({ error: 'Errore nel recupero fornitori' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Il nome è obbligatorio' }, { status: 400 })
    }

    const supplier = await prisma.supplier.create({
      data: {
        name: name.trim()
      }
    })

    return NextResponse.json(supplier)
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Esiste già un fornitore con questo nome' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Errore durante la creazione' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const session = await getSession()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { id, name } = body

    if (!id || !name || !name.trim()) {
      return NextResponse.json({ error: 'ID e nome sono obbligatori' }, { status: 400 })
    }

    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        name: name.trim()
      }
    })

    return NextResponse.json(supplier)
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Esiste già un fornitore con questo nome' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Errore durante l\'aggiornamento' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await getSession()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID obbligatorio' }, { status: 400 })
    }

    await prisma.supplier.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Errore durante l\'eliminazione' }, { status: 500 })
  }
}
