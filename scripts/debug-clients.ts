import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const totalParticipants = await prisma.participant.count()
  const participantsWithoutClient = await prisma.participant.count({
    where: { clientId: null }
  })
  const totalClients = await prisma.client.count()

  console.log('Totale partecipanti:', totalParticipants)
  console.log('Partecipanti senza clientId:', participantsWithoutClient)
  console.log('Totale clients:', totalClients)
}

main()
  .catch((e) => {
    console.error(e)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

