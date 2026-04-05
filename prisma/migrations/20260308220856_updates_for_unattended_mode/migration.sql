-- AlterTable
ALTER TABLE "Excursion" ADD COLUMN     "maxParticipants" INTEGER,
ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "startDate" DROP NOT NULL,
ALTER COLUMN "priceAdult" DROP NOT NULL,
ALTER COLUMN "priceChild" DROP NOT NULL,
ALTER COLUMN "tax" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "agencyId" TEXT,
ADD COLUMN     "approvalStatus" TEXT NOT NULL DEFAULT 'APPROVED';

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
