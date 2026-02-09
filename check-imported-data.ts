
import { prisma } from './src/lib/prisma'

async function checkImportedData() {
  try {
    const bookings = await prisma.taxBooking.findMany({
      orderBy: { week: 'asc' }
    })

    console.log(`Total Bookings: ${bookings.length}`)

    let totalPax = 0
    let totalAmount = 0
    const weekStats: Record<string, { bookings: number, pax: number }> = {}

    bookings.forEach(b => {
      totalPax += b.pax
      totalAmount += b.totalAmount
      
      if (!weekStats[b.week]) {
        weekStats[b.week] = { bookings: 0, pax: 0 }
      }
      weekStats[b.week].bookings++
      weekStats[b.week].pax += b.pax
    })

    console.log(`Total Pax: ${totalPax}`)
    console.log(`Total Amount: ${totalAmount}`)
    console.log('--- Stats per Week ---')
    console.table(weekStats)

    // Check for potential anomalies (e.g. very high pax in a single booking)
    const anomalousBookings = bookings.filter(b => b.pax > 10)
    if (anomalousBookings.length > 0) {
        console.log('--- Anomalous Bookings (Pax > 10) ---')
        anomalousBookings.forEach(b => {
            console.log(`Week: ${b.week}, File: ${b.nFile}, Pax: ${b.pax}, Lead: ${b.leadName}`)
        })
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkImportedData()
