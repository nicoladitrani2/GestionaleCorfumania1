-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "assistantCommission" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "assistantCommissionType" TEXT,
ADD COLUMN     "commissionPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "insurancePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "licenseType" TEXT,
ADD COLUMN     "needsTransfer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rentalEndDate" TIMESTAMP(3),
ADD COLUMN     "rentalStartDate" TIMESTAMP(3),
ADD COLUMN     "rentalType" TEXT,
ADD COLUMN     "supplementPrice" DOUBLE PRECISION NOT NULL DEFAULT 0;
