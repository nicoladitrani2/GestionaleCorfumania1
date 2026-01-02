const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const suppliers = [
  'GO4SEA',
  'Corfu Travel',
  'Lord Travel',
  'Spiros Boat',
  'Corfu Golf',
  'Aqualand',
  'Dimitra'
]

const excursionNames = [
  'Corfu Jeep Adventure',
  'Blue Lagoon',
  'Paxos & Antipaxos',
  'Grand Island Tour',
  'Aqualand',
  'Greek Night',
  'Scuba Diving',
  'Albania Day Trip',
  'Parga & Sivota',
  'Vidos Island',
  'Achilleion Palace',
  'City Tour',
  'Sunset Cruise',
  'Boat BBQ'
]

async function main() {
  console.log('Start seeding...')

  // 1. Seed Suppliers
  console.log('Seeding Suppliers...')
  const supplierRecords = []
  for (const name of suppliers) {
    const supplier = await prisma.supplier.upsert({
      where: { name },
      update: {},
      create: { name },
    })
    supplierRecords.push(supplier)
    console.log(`Upserted supplier: ${supplier.name}`)
  }

  // 2. Seed Excursion Templates & Active Excursions
  console.log('Seeding Excursions...')
  for (const name of excursionNames) {
    // Create Template
    const template = await prisma.excursionTemplate.upsert({
      where: { name },
      update: {},
      create: { name },
    })
    console.log(`Upserted template: ${template.name}`)

    // Check if an active excursion with this name already exists for 2025
    // We'll just create one if none exists to ensure the list isn't empty
    const existing = await prisma.excursion.findFirst({
      where: {
        name: name,
        startDate: {
          gte: new Date('2025-01-01')
        }
      }
    })

    if (!existing) {
      // Create an active excursion for Summer 2025
      const startDate = new Date('2025-06-01T09:00:00Z')
      // Randomize date a bit so they aren't all same day
      startDate.setDate(startDate.getDate() + Math.floor(Math.random() * 30))
      
      const excursion = await prisma.excursion.create({
        data: {
          name: name,
          startDate: startDate,
          endDate: startDate, // Single day
          confirmationDeadline: new Date(startDate.getTime() - 24 * 60 * 60 * 1000), // 1 day before
          commissions: {
            create: supplierRecords.map(s => ({
              supplierId: s.id,
              commissionPercentage: 10 // Default 10% commission
            }))
          }
        }
      })
      console.log(`Created active excursion: ${excursion.name} on ${excursion.startDate.toISOString()}`)
    } else {
      console.log(`Active excursion already exists for: ${name}`)
    }
  }

  console.log('Seeding finished.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
