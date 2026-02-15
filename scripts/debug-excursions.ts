
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const now = new Date()
  console.log('Current Server Time (ISO):', now.toISOString())
  console.log('Current Server Time (Local):', now.toString())
  
  // Simulate client cutoff (start of today local)
  const clientCutoff = new Date(now)
  clientCutoff.setHours(0, 0, 0, 0)
  console.log('Simulated Client Cutoff (Local 00:00):', clientCutoff.toString())
  console.log('Simulated Client Cutoff (ISO):', clientCutoff.toISOString())

  const cutoffDate = clientCutoff

  const excursions = await prisma.excursion.findMany({
    orderBy: { startDate: 'asc' },
    // take: 20 // Inspect all recent ones
  })

  console.log('\n--- Excursions Analysis ---')
  let visibleCount = 0
  let hiddenCount = 0

  for (const ex of excursions) {
    const start = new Date(ex.startDate)
    const end = ex.endDate ? new Date(ex.endDate) : null
    
    let isVisibleInActive = false
    if (!end) {
      isVisibleInActive = true
    } else {
      isVisibleInActive = end >= cutoffDate
    }

    // Only log relevant ones (around today)
    const diffDays = (start.getTime() - now.getTime()) / (1000 * 3600 * 24)
    if (Math.abs(diffDays) < 5) {
      console.log(`\nID: ${ex.id}`)
      console.log(`Name: ${ex.name}`)
      console.log(`Start: ${start.toISOString()} (${start.toLocaleString()})`)
      console.log(`End:   ${end ? end.toISOString() : 'null'} (${end ? end.toLocaleString() : '-'})`)
      console.log(`Visible in ACTIVE? ${isVisibleInActive ? 'YES' : 'NO'}`)
      if (!isVisibleInActive) console.log(`Reason: End Date (${end?.toISOString()}) < Cutoff (${cutoffDate.toISOString()})`)
    }
    
    if (isVisibleInActive) visibleCount++
    else hiddenCount++
  }

  console.log(`\nTotal Visible in Active: ${visibleCount}`)
  console.log(`Total Hidden (Archived): ${hiddenCount}`)
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
