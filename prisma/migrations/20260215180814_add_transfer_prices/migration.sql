-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "assignedToId" TEXT;

-- AlterTable
ALTER TABLE "Transfer" ADD COLUMN     "approvalStatus" TEXT NOT NULL DEFAULT 'APPROVED',
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "priceAdult" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "priceChild" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
