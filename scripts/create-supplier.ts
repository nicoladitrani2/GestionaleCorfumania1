import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    const supplier = await prisma.supplier.create({
      data: { name: 'Go4Sea Test' }
    })
    console.log('Supplier created:', supplier)
  } catch (e: any) {
    console.error('Create supplier error:', e.code || e.message || e)
  } finally {
    await prisma.$disconnect()
  }
}

main()
