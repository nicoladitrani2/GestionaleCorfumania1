/*
  Warnings:

  - You are about to drop the column `accommodation` on the `Participant` table. All the data in the column will be lost.
  - You are about to drop the column `agencyId` on the `Participant` table. All the data in the column will be lost.
  - You are about to drop the column `balancePaymentMethod` on the `Participant` table. All the data in the column will be lost.
  - You are about to drop the column `clientId` on the `Participant` table. All the data in the column will be lost.
  - You are about to drop the column `commissionPercentage` on the `Participant` table. All the data in the column will be lost.
  - You are about to drop the column `createdById` on the `Participant` table. All the data in the column will be lost.
  - You are about to drop the column `dateOfBirth` on the `Participant` table. All the data in the column will be lost.
  - You are about to drop the column `deposit` on the `Participant` table. All the data in the column will be lost.
  - You are about to drop the column `depositPaymentMethod` on the `Participant` table. All the data in the column will be lost.
  - You are about to drop the column `docNumber` on the `Participant` table. All the data in the column will be lost.
  - You are about to drop the column `docType` on the `Participant` table. All the data in the column will be lost.
  - You are about to drop the column `firstName` on the `Participant` table. All the data in the column will be lost.
  - You are about to drop the column `groupSize` on the `Participant` table. All the data in the column will be lost.
  - You are about to drop the column `isExpired` on the `Participant` table. All the data in the column will be lost.
  - You are about to drop the column `isOption` on the `Participant` table. All the data in the column will be lost.
  - You are about to drop the column `isRental` on the `Participant` table. All the data in the column will be lost.
  - You are about to drop the column `lastName` on the `Participant` table. All the data in the column will be lost.
  - You are about to drop the column `needsTransfer` on the `Participant` table. All the data in the column will be lost.
  - You are about to drop the column `phoneNumber` on the `Participant` table. All the data in the column will be lost.
  - You are about to drop the column `pickupTime` on the `Participant` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `Participant` table. All the data in the column will be lost.
  - You are about to drop the column `rentalEndDate` on the `Participant` table. All the data in the column will be lost.
  - You are about to drop the column `rentalStartDate` on the `Participant` table. All the data in the column will be lost.
  - You are about to drop the column `rentalType` on the `Participant` table. All the data in the column will be lost.
  - You are about to drop the column `returnDate` on the `Participant` table. All the data in the column will be lost.
  - You are about to drop the column `returnPickupLocation` on the `Participant` table. All the data in the column will be lost.
  - You are about to drop the column `returnTime` on the `Participant` table. All the data in the column will be lost.
  - You are about to drop the `Client` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Supplier` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `entityId` to the `AuditLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `entityType` to the `AuditLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `infants` to the `Participant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Participant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `paidAmount` to the `Participant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `paymentStatus` to the `Participant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status` to the `Participant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalPrice` to the `Participant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Participant` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_excursionId_fkey";

-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_transferId_fkey";

-- DropForeignKey
ALTER TABLE "Participant" DROP CONSTRAINT "Participant_clientId_fkey";

-- DropForeignKey
ALTER TABLE "Participant" DROP CONSTRAINT "Participant_createdById_fkey";

-- DropForeignKey
ALTER TABLE "Participant" DROP CONSTRAINT "Participant_excursionId_fkey";

-- DropForeignKey
ALTER TABLE "Participant" DROP CONSTRAINT "Participant_transferId_fkey";

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "entityId" TEXT NOT NULL,
ADD COLUMN     "entityType" TEXT NOT NULL,
ADD COLUMN     "rentalId" TEXT;

-- AlterTable
ALTER TABLE "Participant" DROP COLUMN "accommodation",
DROP COLUMN "agencyId",
DROP COLUMN "balancePaymentMethod",
DROP COLUMN "clientId",
DROP COLUMN "commissionPercentage",
DROP COLUMN "createdById",
DROP COLUMN "dateOfBirth",
DROP COLUMN "deposit",
DROP COLUMN "depositPaymentMethod",
DROP COLUMN "docNumber",
DROP COLUMN "docType",
DROP COLUMN "firstName",
DROP COLUMN "groupSize",
DROP COLUMN "isExpired",
DROP COLUMN "isOption",
DROP COLUMN "isRental",
DROP COLUMN "lastName",
DROP COLUMN "needsTransfer",
DROP COLUMN "phoneNumber",
DROP COLUMN "pickupTime",
DROP COLUMN "price",
DROP COLUMN "rentalEndDate",
DROP COLUMN "rentalStartDate",
DROP COLUMN "rentalType",
DROP COLUMN "returnDate",
DROP COLUMN "returnPickupLocation",
DROP COLUMN "returnTime",
ADD COLUMN     "bookingDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "infants" INTEGER NOT NULL,
ADD COLUMN     "isRoundTrip" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "paidAmount" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "paymentStatus" TEXT NOT NULL,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "rentalId" TEXT,
ADD COLUMN     "roomNumber" TEXT,
ADD COLUMN     "specialServiceType" TEXT,
ADD COLUMN     "status" TEXT NOT NULL,
ADD COLUMN     "ticketNumber" TEXT,
ADD COLUMN     "totalPrice" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "userId" TEXT NOT NULL,
ALTER COLUMN "supplier" DROP NOT NULL,
ALTER COLUMN "paymentType" DROP NOT NULL,
ALTER COLUMN "adults" DROP DEFAULT,
ALTER COLUMN "children" DROP DEFAULT;

-- DropTable
DROP TABLE "Client";

-- DropTable
DROP TABLE "Supplier";

-- CreateTable
CREATE TABLE "Rental" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rental_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxBooking" (
    "id" TEXT NOT NULL,
    "nFile" TEXT NOT NULL,
    "week" TEXT NOT NULL,
    "provenienza" TEXT NOT NULL,
    "serviceCode" INTEGER NOT NULL,
    "pax" INTEGER NOT NULL,
    "leadName" TEXT NOT NULL,
    "room" TEXT,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "assignedToId" TEXT,
    "customerPaid" BOOLEAN NOT NULL DEFAULT false,
    "adminPaid" BOOLEAN NOT NULL DEFAULT false,
    "rawData" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaxBooking_nFile_week_key" ON "TaxBooking"("nFile", "week");

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_excursionId_fkey" FOREIGN KEY ("excursionId") REFERENCES "Excursion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_excursionId_fkey" FOREIGN KEY ("excursionId") REFERENCES "Excursion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxBooking" ADD CONSTRAINT "TaxBooking_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
