/*
  Warnings:

  - The required column `code` was added to the `User` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- DropIndex
DROP INDEX "Excursion_name_key";

-- AlterTable
ALTER TABLE "Excursion" ADD COLUMN "confirmationDeadline" DATETIME;
ALTER TABLE "Excursion" ADD COLUMN "endDate" DATETIME;
ALTER TABLE "Excursion" ADD COLUMN "startDate" DATETIME;

-- CreateTable
CREATE TABLE "ExcursionTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Participant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "nationality" TEXT,
    "dateOfBirth" DATETIME,
    "docNumber" TEXT,
    "docType" TEXT,
    "phoneNumber" TEXT,
    "notes" TEXT,
    "groupSize" INTEGER NOT NULL DEFAULT 1,
    "isOption" BOOLEAN NOT NULL DEFAULT false,
    "supplier" TEXT NOT NULL,
    "paymentType" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "excursionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Participant_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Participant_excursionId_fkey" FOREIGN KEY ("excursionId") REFERENCES "Excursion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Participant" ("createdAt", "createdById", "dateOfBirth", "docNumber", "docType", "excursionId", "firstName", "id", "isOption", "lastName", "nationality", "notes", "paymentMethod", "paymentType", "phoneNumber", "supplier", "updatedAt") SELECT "createdAt", "createdById", "dateOfBirth", "docNumber", "docType", "excursionId", "firstName", "id", "isOption", "lastName", "nationality", "notes", "paymentMethod", "paymentType", "phoneNumber", "supplier", "updatedAt" FROM "Participant";
DROP TABLE "Participant";
ALTER TABLE "new_Participant" RENAME TO "Participant";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "role" TEXT NOT NULL,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "email", "id", "mustChangePassword", "password", "role", "updatedAt") SELECT "createdAt", "email", "id", "mustChangePassword", "password", "role", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_code_key" ON "User"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ExcursionTemplate_name_key" ON "ExcursionTemplate"("name");
