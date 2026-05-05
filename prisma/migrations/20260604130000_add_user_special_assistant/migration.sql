-- Add special assistant flag
ALTER TABLE "User" ADD COLUMN "isSpecialAssistant" BOOLEAN NOT NULL DEFAULT false;

