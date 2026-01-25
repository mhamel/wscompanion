-- CreateTable
CREATE TABLE "AuthOtp" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "codeSalt" TEXT NOT NULL,
    "codeHashHex" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "ipAddress" TEXT,

    CONSTRAINT "AuthOtp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuthOtp_email_createdAt_idx" ON "AuthOtp"("email", "createdAt");

