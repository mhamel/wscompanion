-- CreateTable
CREATE TABLE "TickerPnlTotal" (
    "userId" UUID NOT NULL,
    "symbol" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL,
    "realizedPnlMinor" BIGINT NOT NULL,
    "unrealizedPnlMinor" BIGINT NOT NULL,
    "optionPremiumsMinor" BIGINT NOT NULL,
    "dividendsMinor" BIGINT NOT NULL,
    "feesMinor" BIGINT NOT NULL,
    "netPnlMinor" BIGINT NOT NULL,
    "lastRecomputedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TickerPnlTotal_pkey" PRIMARY KEY ("userId","symbol","baseCurrency")
);

-- CreateTable
CREATE TABLE "TickerPnlDaily" (
    "userId" UUID NOT NULL,
    "symbol" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "netPnlMinor" BIGINT NOT NULL,
    "marketValueMinor" BIGINT NOT NULL,
    "realizedPnlMinor" BIGINT NOT NULL,
    "unrealizedPnlMinor" BIGINT NOT NULL,

    CONSTRAINT "TickerPnlDaily_pkey" PRIMARY KEY ("userId","symbol","baseCurrency","date")
);

-- CreateTable
CREATE TABLE "WheelCycle" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "symbol" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "netPnlMinor" BIGINT,
    "baseCurrency" TEXT NOT NULL,
    "autoDetected" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,

    CONSTRAINT "WheelCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WheelLeg" (
    "id" UUID NOT NULL,
    "wheelCycleId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "transactionId" UUID,
    "linkedTransactionIds" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "pnlMinor" BIGINT,
    "raw" JSONB,

    CONSTRAINT "WheelLeg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsSource" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "baseUrl" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "weight" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "NewsSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsItem" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT,
    "url" TEXT NOT NULL,
    "urlHash" BYTEA NOT NULL,
    "title" TEXT NOT NULL,
    "publisher" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "summary" TEXT,
    "raw" JSONB,

    CONSTRAINT "NewsItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsItemSymbol" (
    "newsItemId" UUID NOT NULL,
    "symbol" TEXT NOT NULL,

    CONSTRAINT "NewsItemSymbol_pkey" PRIMARY KEY ("newsItemId","symbol")
);

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "symbol" TEXT,
    "config" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertEvent" (
    "id" UUID NOT NULL,
    "alertRuleId" UUID NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "AlertEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportJob" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ExportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportFile" (
    "exportJobId" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "sha256" BYTEA NOT NULL,

    CONSTRAINT "ExportFile_pkey" PRIMARY KEY ("exportJobId")
);

-- CreateIndex
CREATE INDEX "TickerPnlTotal_userId_symbol_idx" ON "TickerPnlTotal"("userId", "symbol");

-- CreateIndex
CREATE INDEX "TickerPnlDaily_userId_symbol_idx" ON "TickerPnlDaily"("userId", "symbol");

-- CreateIndex
CREATE INDEX "WheelCycle_userId_symbol_idx" ON "WheelCycle"("userId", "symbol");

-- CreateIndex
CREATE INDEX "WheelLeg_wheelCycleId_idx" ON "WheelLeg"("wheelCycleId");

-- CreateIndex
CREATE INDEX "WheelLeg_transactionId_idx" ON "WheelLeg"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsItem_urlHash_key" ON "NewsItem"("urlHash");

-- CreateIndex
CREATE INDEX "NewsItem_publishedAt_idx" ON "NewsItem"("publishedAt");

-- CreateIndex
CREATE INDEX "NewsItemSymbol_symbol_idx" ON "NewsItemSymbol"("symbol");

-- CreateIndex
CREATE INDEX "AlertRule_userId_type_idx" ON "AlertRule"("userId", "type");

-- CreateIndex
CREATE INDEX "AlertRule_userId_symbol_idx" ON "AlertRule"("userId", "symbol");

-- CreateIndex
CREATE INDEX "AlertEvent_alertRuleId_triggeredAt_idx" ON "AlertEvent"("alertRuleId", "triggeredAt");

-- CreateIndex
CREATE INDEX "ExportJob_userId_createdAt_idx" ON "ExportJob"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "TickerPnlTotal" ADD CONSTRAINT "TickerPnlTotal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TickerPnlDaily" ADD CONSTRAINT "TickerPnlDaily_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WheelCycle" ADD CONSTRAINT "WheelCycle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WheelLeg" ADD CONSTRAINT "WheelLeg_wheelCycleId_fkey" FOREIGN KEY ("wheelCycleId") REFERENCES "WheelCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WheelLeg" ADD CONSTRAINT "WheelLeg_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsItemSymbol" ADD CONSTRAINT "NewsItemSymbol_newsItemId_fkey" FOREIGN KEY ("newsItemId") REFERENCES "NewsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_alertRuleId_fkey" FOREIGN KEY ("alertRuleId") REFERENCES "AlertRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportJob" ADD CONSTRAINT "ExportJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportFile" ADD CONSTRAINT "ExportFile_exportJobId_fkey" FOREIGN KEY ("exportJobId") REFERENCES "ExportJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

