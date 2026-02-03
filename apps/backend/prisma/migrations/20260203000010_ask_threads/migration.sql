-- CreateTable
CREATE TABLE "AskThread" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AskThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AskMessage" (
    "id" UUID NOT NULL,
    "threadId" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AskMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AskThread_userId_lastMessageAt_idx" ON "AskThread"("userId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "AskMessage_threadId_createdAt_idx" ON "AskMessage"("threadId", "createdAt");

-- AddForeignKey
ALTER TABLE "AskThread" ADD CONSTRAINT "AskThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AskMessage" ADD CONSTRAINT "AskMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "AskThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
