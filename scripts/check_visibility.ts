
import { prisma } from '../src/lib/prisma';

async function main() {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0,0,0,0);
  
  console.log('Current time:', now.toISOString());
  console.log('Start of day (server/local):', startOfDay.toISOString());

  const excursions = await prisma.excursion.findMany({
    orderBy: { startDate: 'asc' },
    take: 20
  });

  console.log(`Found ${excursions.length} excursions.`);
  
  excursions.forEach(ex => {
    const end = ex.endDate ? new Date(ex.endDate) : null;
    const isVisible = !end || end >= startOfDay;
    
    console.log(`ID: ${ex.id}`);
    console.log(`  Name: ${ex.name}`);
    console.log(`  Start: ${ex.startDate.toISOString()}`);
    console.log(`  End: ${end ? end.toISOString() : 'NULL'}`);
    console.log(`  Visible in Active (> ${startOfDay.toISOString()})?: ${isVisible}`);
    console.log('---');
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
