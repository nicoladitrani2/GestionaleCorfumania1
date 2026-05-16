-- AlterTable
ALTER TABLE "Participant" ADD COLUMN "isGroupLeader" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Participant" ADD COLUMN "groupLeaderId" TEXT;

-- AddForeignKey
ALTER TABLE "Participant"
ADD CONSTRAINT "Participant_groupLeaderId_fkey"
FOREIGN KEY ("groupLeaderId") REFERENCES "Participant"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Participant_groupLeaderId_idx" ON "Participant"("groupLeaderId");
