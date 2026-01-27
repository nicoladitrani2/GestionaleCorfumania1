import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = 'ariannaamministrazione@gmail.com'
  const password = 'admin123'
  const hashedPassword = await bcrypt.hash(password, 10)

  try {
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        password: hashedPassword, // Reset password if exists
        role: 'ADMIN',
        code: 'ADMIN01'
      },
      create: {
        email,
        password: hashedPassword,
        firstName: 'Arianna',
        lastName: 'Amministrazione',
        role: 'ADMIN',
        code: 'ADMIN01'
      },
    })
    console.log(`User created/updated: ${user.email}`)
  } catch (e) {
    console.error(e)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()