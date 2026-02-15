const { PrismaClient } = require('@prisma/client')

async function main() {
  const prisma = new PrismaClient()
  try {
    const logs = await prisma.auditLog.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' }
    })
    console.log(JSON.stringify(logs, null, 2))
  } catch (e) {
    console.error('Error reading audit logs:', e)
  } finally {
    await prisma.$disconnect()
  }
}

main()
