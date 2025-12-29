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
    "price" REAL NOT NULL DEFAULT 0,
    "deposit" REAL NOT NULL DEFAULT 0,
    "isExpired" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "excursionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Participant_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Participant_excursionId_fkey" FOREIGN KEY ("excursionId") REFERENCES "Excursion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Participant" ("createdAt", "createdById", "dateOfBirth", "deposit", "docNumber", "docType", "excursionId", "firstName", "groupSize", "id", "isOption", "lastName", "nationality", "notes", "paymentMethod", "paymentType", "phoneNumber", "price", "supplier", "updatedAt") SELECT "createdAt", "createdById", "dateOfBirth", "deposit", "docNumber", "docType", "excursionId", "firstName", "groupSize", "id", "isOption", "lastName", "nationality", "notes", "paymentMethod", "paymentType", "phoneNumber", "price", "supplier", "updatedAt" FROM "Participant";
DROP TABLE "Participant";
ALTER TABLE "new_Participant" RENAME TO "Participant";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
