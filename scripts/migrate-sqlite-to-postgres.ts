import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import { PrismaClient } from '@prisma/client'
import path from 'path'
import { fileURLToPath } from 'url'

const prisma = new PrismaClient()

// For CJS/TS interop issues with __dirname if module type changes, but here we can just use process.cwd() or relative path
// Since we run with tsx, we can use __dirname if we were in CJS, or import.meta.url if ESM.
// Let's assume process.cwd() is project root.

async function main() {
  const dbPath = path.resolve(process.cwd(), 'prisma/dev.db')
  console.log(`Reading from SQLite DB at: ${dbPath}`)

  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  })

  try {
    // Read Suppliers
    const suppliers = await db.all('SELECT * FROM Supplier')
    console.log(`Found ${suppliers.length} suppliers`)

    for (const s of suppliers) {
      console.log(`Migrating supplier: ${s.name}`)
      await prisma.supplier.upsert({
        where: { name: s.name }, // Use name as unique key for upsert if id differs or to avoid duplicates
        update: {
          createdAt: new Date(s.createdAt),
          updatedAt: new Date(s.updatedAt)
        },
        create: {
          // If we want to keep ID, we should specify it.
          // Let's try to keep ID.
          id: s.id,
          name: s.name,
          createdAt: new Date(s.createdAt),
          updatedAt: new Date(s.updatedAt)
        }
      })
    }

    // Read Excursions
    const excursions = await db.all('SELECT * FROM Excursion')
    console.log(`Found ${excursions.length} excursions`)

    for (const e of excursions) {
      console.log(`Migrating excursion: ${e.name}`)
      await prisma.excursion.upsert({
        where: { id: e.id },
        update: {
          name: e.name,
          startDate: new Date(e.startDate),
          endDate: e.endDate ? new Date(e.endDate) : null,
          confirmationDeadline: e.confirmationDeadline ? new Date(e.confirmationDeadline) : null,
          createdAt: new Date(e.createdAt),
          updatedAt: new Date(e.updatedAt)
        },
        create: {
          id: e.id,
          name: e.name,
          startDate: new Date(e.startDate),
          endDate: e.endDate ? new Date(e.endDate) : null,
          confirmationDeadline: e.confirmationDeadline ? new Date(e.confirmationDeadline) : null,
          createdAt: new Date(e.createdAt),
          updatedAt: new Date(e.updatedAt)
        }
      })
    }
  } catch (error) {
    console.error('Error migrating data:', error)
  } finally {
    await db.close()
  }
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
