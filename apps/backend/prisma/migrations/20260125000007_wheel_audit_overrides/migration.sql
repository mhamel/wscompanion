-- AlterTable
ALTER TABLE "WheelCycle" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "WheelAuditEvent" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "wheelCycleId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WheelAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WheelAuditEvent_userId_createdAt_idx" ON "WheelAuditEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "WheelAuditEvent_wheelCycleId_createdAt_idx" ON "WheelAuditEvent"("wheelCycleId", "createdAt");

-- AddForeignKey
ALTER TABLE "WheelAuditEvent" ADD CONSTRAINT "WheelAuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WheelAuditEvent" ADD CONSTRAINT "WheelAuditEvent_wheelCycleId_fkey" FOREIGN KEY ("wheelCycleId") REFERENCES "WheelCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

