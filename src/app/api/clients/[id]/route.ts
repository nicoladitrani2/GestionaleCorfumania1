import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { isManuallyContacted, lastEmailSentAt } = body

    const updateData: any = {}
    if (isManuallyContacted !== undefined) updateData.isManuallyContacted = isManuallyContacted
    if (lastEmailSentAt !== undefined) updateData.lastEmailSentAt = lastEmailSentAt

    const updatedClient = await prisma.client.update({
      where: { id: params.id },
      data: updateData
    })

    return NextResponse.json(updatedClient)
  } catch (error) {
    console.error('Error updating client:', error)
    return NextResponse.json({ error: 'Failed to update client' }, { status: 500 })
  }
}
