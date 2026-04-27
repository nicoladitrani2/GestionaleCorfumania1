-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "countsByTier" JSONB;

-- CreateTable
CREATE TABLE "ExcursionPriceTier" (
    "id" TEXT NOT NULL,
    "excursionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExcursionPriceTier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExcursionPriceTier_excursionId_label_key" ON "ExcursionPriceTier"("excursionId", "label");

-- AddForeignKey
ALTER TABLE "ExcursionPriceTier" ADD CONSTRAINT "ExcursionPriceTier_excursionId_fkey" FOREIGN KEY ("excursionId") REFERENCES "Excursion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "TransferPriceTier" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransferPriceTier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TransferPriceTier_transferId_label_key" ON "TransferPriceTier"("transferId", "label");

-- AddForeignKey
ALTER TABLE "TransferPriceTier" ADD CONSTRAINT "TransferPriceTier_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
