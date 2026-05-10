-- Add split payment method tracking for deposits vs balances
ALTER TABLE "Participant"
ADD COLUMN "depositPaidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "Participant"
ADD COLUMN "depositPaymentMethod" TEXT NOT NULL DEFAULT 'CASH';

ALTER TABLE "Participant"
ADD COLUMN "balancePaymentMethod" TEXT;

