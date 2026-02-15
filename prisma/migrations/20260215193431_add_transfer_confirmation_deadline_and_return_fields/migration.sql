-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "returnDate" TIMESTAMP(3),
ADD COLUMN     "returnDropoffLocation" TEXT,
ADD COLUMN     "returnPickupLocation" TEXT,
ADD COLUMN     "returnTime" TEXT;

-- AlterTable
ALTER TABLE "Transfer" ADD COLUMN     "confirmationDeadline" TIMESTAMP(3);
