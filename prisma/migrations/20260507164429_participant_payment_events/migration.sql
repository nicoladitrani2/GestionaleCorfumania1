-- CreateTable
CREATE TABLE "ParticipantPaymentEvent" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParticipantPaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParticipantPaymentEvent_participantId_createdAt_idx" ON "ParticipantPaymentEvent"("participantId", "createdAt");

-- CreateIndex
CREATE INDEX "ParticipantPaymentEvent_direction_method_idx" ON "ParticipantPaymentEvent"("direction", "method");

-- AddForeignKey
ALTER TABLE "ParticipantPaymentEvent" ADD CONSTRAINT "ParticipantPaymentEvent_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
