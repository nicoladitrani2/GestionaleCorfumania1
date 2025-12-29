/*
  Warnings:

  - Made the column `startDate` on table `Excursion` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Excursion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "confirmationDeadline" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Excursion" ("confirmationDeadline", "createdAt", "endDate", "id", "name", "startDate", "updatedAt") SELECT "confirmationDeadline", "createdAt", "endDate", "id", "name", "startDate", "updatedAt" FROM "Excursion";
DROP TABLE "Excursion";
ALTER TABLE "new_Excursion" RENAME TO "Excursion";
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
    "price" REAL NOT NULL DEFAULT 0,
    "deposit" REAL NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "excursionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Participant_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Participant_excursionId_fkey" FOREIGN KEY ("excursionId") REFERENCES "Excursion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Participant" ("createdAt", "createdById", "dateOfBirth", "docNumber", "docType", "excursionId", "firstName", "groupSize", "id", "isOption", "lastName", "nationality", "notes", "paymentMethod", "paymentType", "phoneNumber", "supplier", "updatedAt") SELECT "createdAt", "createdById", "dateOfBirth", "docNumber", "docType", "excursionId", "firstName", "groupSize", "id", "isOption", "lastName", "nationality", "notes", "paymentMethod", "paymentType", "phoneNumber", "supplier", "updatedAt" FROM "Participant";
DROP TABLE "Participant";
ALTER TABLE "new_Participant" RENAME TO "Participant";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("code", "createdAt", "email", "firstName", "id", "lastName", "mustChangePassword", "password", "role", "updatedAt") SELECT "code", "createdAt", "email", "firstName", "id", "lastName", "mustChangePassword", "password", "role", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_code_key" ON "User"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
