-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "adults" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "children" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isRental" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rentalEndDate" TIMESTAMP(3),
ADD COLUMN     "rentalStartDate" TIMESTAMP(3),
ADD COLUMN     "rentalType" TEXT;

-- AlterTable
ALTER TABLE "Transfer" ADD COLUMN     "returnPickupLocation" TEXT;
