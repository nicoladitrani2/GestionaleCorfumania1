-- AlterTable
ALTER TABLE "Participant"
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "docNumber" TEXT,
ADD COLUMN     "docType" TEXT;

