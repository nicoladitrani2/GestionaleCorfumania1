-- AlterTable
ALTER TABLE "TaxBooking"
ADD COLUMN     "depositStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "depositProcessedAt" TIMESTAMP(3);

-- DropIndex
DROP INDEX IF EXISTS "TaxBooking_nFile_week_key";

-- CreateIndex
CREATE UNIQUE INDEX "TaxBooking_nFile_week_serviceCode_key" ON "TaxBooking"("nFile", "week", "serviceCode");

