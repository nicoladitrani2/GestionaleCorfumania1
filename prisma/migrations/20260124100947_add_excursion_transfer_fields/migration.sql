/*
  Warnings:

  - You are about to drop the column `supplierId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `ExcursionCommission` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ExcursionCommission" DROP CONSTRAINT "ExcursionCommission_excursionId_fkey";

-- DropForeignKey
ALTER TABLE "ExcursionCommission" DROP CONSTRAINT "ExcursionCommission_supplierId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_supplierId_fkey";

-- AlterTable
ALTER TABLE "Excursion" ADD COLUMN     "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "transferDepartureLocation" TEXT,
ADD COLUMN     "transferDestinationLocation" TEXT,
ADD COLUMN     "transferTime" TEXT;

-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "accommodation" TEXT,
ADD COLUMN     "agencyId" TEXT,
ADD COLUMN     "commissionPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "needsTransfer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tax" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "supplierId",
ADD COLUMN     "agencyId" TEXT;

-- DropTable
DROP TABLE "ExcursionCommission";

-- CreateTable
CREATE TABLE "Agency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "defaultCommission" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commissionType" TEXT NOT NULL DEFAULT 'PERCENTAGE',

    CONSTRAINT "Agency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExcursionAgencyCommission" (
    "id" TEXT NOT NULL,
    "excursionId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "commissionPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commissionType" TEXT NOT NULL DEFAULT 'PERCENTAGE',

    CONSTRAINT "ExcursionAgencyCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferAgencyCommission" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "commissionPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commissionType" TEXT NOT NULL DEFAULT 'PERCENTAGE',

    CONSTRAINT "TransferAgencyCommission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Agency_name_key" ON "Agency"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ExcursionAgencyCommission_excursionId_agencyId_key" ON "ExcursionAgencyCommission"("excursionId", "agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "TransferAgencyCommission_transferId_agencyId_key" ON "TransferAgencyCommission"("transferId", "agencyId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExcursionAgencyCommission" ADD CONSTRAINT "ExcursionAgencyCommission_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExcursionAgencyCommission" ADD CONSTRAINT "ExcursionAgencyCommission_excursionId_fkey" FOREIGN KEY ("excursionId") REFERENCES "Excursion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferAgencyCommission" ADD CONSTRAINT "TransferAgencyCommission_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferAgencyCommission" ADD CONSTRAINT "TransferAgencyCommission_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
