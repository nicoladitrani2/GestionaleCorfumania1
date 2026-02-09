
import { prisma } from './src/lib/prisma'

async function cleanupBadData() {
  try {
    console.log('Starting cleanup...')

    // 1. Delete ESEMPIO bookings
    const deletedEsempio = await prisma.taxBooking.deleteMany({
      where: {
        week: { contains: 'ESEMPIO' }
      }
    })
    console.log(`Deleted ${deletedEsempio.count} ESEMPIO bookings.`)

    // 2. Delete bookings with unreasonable Pax (> 20)
    // Assuming no single room has > 20 people.
    const deletedHugePax = await prisma.taxBooking.deleteMany({
      where: {
        pax: { gt: 20 }
      }
    })
    console.log(`Deleted ${deletedHugePax.count} bookings with Pax > 20.`)

    // 3. Delete bookings with 0 Pax
    const deletedZeroPax = await prisma.taxBooking.deleteMany({
      where: {
        pax: 0
      }
    })
    console.log(`Deleted ${deletedZeroPax.count} bookings with 0 Pax.`)
    
    // 4. Delete bookings from sheets that shouldn't be there if they are empty or invalid
    // '01-08 GIUGNO', '16-22 GIUGNO', '9-15 GIUGNO' had 0 pax in previous check, so they should be gone by step 3.

  } catch (error) {
    console.error('Error during cleanup:', error)
  } finally {
    await prisma.$disconnect()
  }
}

cleanupBadData()
