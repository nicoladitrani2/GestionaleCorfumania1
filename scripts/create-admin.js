const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const crypto = require('node:crypto')

async function main() {
  const prisma = new PrismaClient()
  try {
    const email = process.env.ADMIN_EMAIL || `admin+${Date.now()}@corfumania.local`
    const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(12).toString('base64url')

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      throw new Error(`Email già esistente: ${email}`)
    }

    const hashed = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        firstName: 'Admin',
        lastName: 'Locale',
        role: 'ADMIN',
        mustChangePassword: false,
      },
      select: { id: true, email: true },
    })

    console.log(`ADMIN_EMAIL=${user.email}`)
    console.log(`ADMIN_PASSWORD=${password}`)
    console.log(`USER_ID=${user.id}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
