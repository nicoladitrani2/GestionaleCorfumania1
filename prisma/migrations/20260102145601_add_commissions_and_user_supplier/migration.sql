-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "transferId" TEXT,
ALTER COLUMN "excursionId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "balancePaymentMethod" TEXT,
ADD COLUMN     "depositPaymentMethod" TEXT,
ADD COLUMN     "dropoffLocation" TEXT,
ADD COLUMN     "pickupLocation" TEXT,
ADD COLUMN     "pickupTime" TEXT,
ADD COLUMN     "returnDate" TIMESTAMP(3),
ADD COLUMN     "returnPickupLocation" TEXT,
ADD COLUMN     "returnTime" TEXT,
ADD COLUMN     "transferId" TEXT,
ALTER COLUMN "excursionId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "supplierId" TEXT;

-- CreateTable
CREATE TABLE "ExcursionCommission" (
    "id" TEXT NOT NULL,
    "excursionId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "commissionPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "ExcursionCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "pickupLocation" TEXT,
    "dropoffLocation" TEXT,
    "supplier" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExcursionCommission_excursionId_supplierId_key" ON "ExcursionCommission"("excursionId", "supplierId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExcursionCommission" ADD CONSTRAINT "ExcursionCommission_excursionId_fkey" FOREIGN KEY ("excursionId") REFERENCES "Excursion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExcursionCommission" ADD CONSTRAINT "ExcursionCommission_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
