import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const email = process.env.ADMIN_EMAIL
const password = process.env.ADMIN_PASSWORD
const firstName = process.env.ADMIN_FIRST_NAME || 'Admin'
const lastName = process.env.ADMIN_LAST_NAME || 'Server'
const code = process.env.ADMIN_CODE || 'ADMIN01'

if (!email || !password) {
  console.error('Missing ADMIN_EMAIL or ADMIN_PASSWORD')
  process.exit(1)
}

if (password.length < 8) {
  console.error('ADMIN_PASSWORD must be at least 8 characters')
  process.exit(1)
}

try {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log('Admin already exists')
    process.exit(0)
  }

  const hashed = await bcrypt.hash(password, 10)
  await prisma.user.create({
    data: {
      email,
      password: hashed,
      code,
      role: 'ADMIN',
      firstName,
      lastName,
      mustChangePassword: true,
    },
  })

  console.log('Admin created')
} finally {
  await prisma.$disconnect()
}

