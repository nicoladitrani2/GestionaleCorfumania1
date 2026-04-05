-- CreateTable
CREATE TABLE "TaxImportBatch" (
    "id" TEXT NOT NULL,
    "fileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "rolledBackAt" TIMESTAMP(3),
    CONSTRAINT "TaxImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxBookingBackup" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "taxBookingId" TEXT NOT NULL,
    "prevImportBatchId" TEXT,
    "snapshot" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaxBookingBackup_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "TaxBooking" ADD COLUMN "importBatchId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "TaxBookingBackup_taxBookingId_batchId_key" ON "TaxBookingBackup"("taxBookingId", "batchId");

-- AddForeignKey
ALTER TABLE "TaxBooking" ADD CONSTRAINT "TaxBooking_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "TaxImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxImportBatch" ADD CONSTRAINT "TaxImportBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxBookingBackup" ADD CONSTRAINT "TaxBookingBackup_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "TaxImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxBookingBackup" ADD CONSTRAINT "TaxBookingBackup_taxBookingId_fkey" FOREIGN KEY ("taxBookingId") REFERENCES "TaxBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

