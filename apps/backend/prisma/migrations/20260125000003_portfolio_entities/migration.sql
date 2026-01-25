-- CreateTable
CREATE TABLE "Account" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "brokerConnectionId" UUID,
    "externalAccountId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Instrument" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "symbol" TEXT,
    "exchange" TEXT,
    "currency" TEXT NOT NULL,
    "name" TEXT,
    "isin" TEXT,
    "raw" JSONB,

    CONSTRAINT "Instrument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptionContract" (
    "id" UUID NOT NULL,
    "underlyingInstrumentId" UUID NOT NULL,
    "occSymbol" TEXT NOT NULL,
    "expiry" DATE NOT NULL,
    "strike" NUMERIC(20,10) NOT NULL,
    "right" TEXT NOT NULL,
    "multiplier" INTEGER NOT NULL DEFAULT 100,
    "currency" TEXT NOT NULL,
    "raw" JSONB,

    CONSTRAINT "OptionContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositionSnapshot" (
    "accountId" UUID NOT NULL,
    "instrumentId" UUID NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "quantity" NUMERIC(20,10) NOT NULL,
    "avgCostAmountMinor" BIGINT NOT NULL,
    "avgCostCurrency" TEXT NOT NULL,
    "marketPriceAmountMinor" BIGINT,
    "marketPriceCurrency" TEXT,
    "marketValueAmountMinor" BIGINT,
    "marketValueCurrency" TEXT,
    "unrealizedPnlAmountMinor" BIGINT,
    "unrealizedPnlCurrency" TEXT,
    "raw" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PositionSnapshot_pkey" PRIMARY KEY ("accountId","instrumentId")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "instrumentId" UUID,
    "optionContractId" UUID,
    "quantity" NUMERIC(20,10),
    "priceAmountMinor" BIGINT,
    "priceCurrency" TEXT,
    "grossAmountMinor" BIGINT,
    "feesAmountMinor" BIGINT,
    "feesCurrency" TEXT,
    "notes" TEXT,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_brokerConnectionId_externalAccountId_key" ON "Account"("brokerConnectionId", "externalAccountId");

-- CreateIndex
CREATE INDEX "Instrument_symbol_idx" ON "Instrument"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "OptionContract_occSymbol_key" ON "OptionContract"("occSymbol");

-- CreateIndex
CREATE INDEX "OptionContract_underlyingInstrumentId_idx" ON "OptionContract"("underlyingInstrumentId");

-- CreateIndex
CREATE INDEX "PositionSnapshot_instrumentId_idx" ON "PositionSnapshot"("instrumentId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_provider_accountId_externalId_key" ON "Transaction"("provider", "accountId", "externalId");

-- CreateIndex
CREATE INDEX "Transaction_userId_executedAt_idx" ON "Transaction"("userId", "executedAt");

-- CreateIndex
CREATE INDEX "Transaction_accountId_executedAt_idx" ON "Transaction"("accountId", "executedAt");

-- CreateIndex
CREATE INDEX "Transaction_instrumentId_idx" ON "Transaction"("instrumentId");

-- CreateIndex
CREATE INDEX "Transaction_optionContractId_idx" ON "Transaction"("optionContractId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionContract" ADD CONSTRAINT "OptionContract_underlyingInstrumentId_fkey" FOREIGN KEY ("underlyingInstrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionSnapshot" ADD CONSTRAINT "PositionSnapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionSnapshot" ADD CONSTRAINT "PositionSnapshot_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_optionContractId_fkey" FOREIGN KEY ("optionContractId") REFERENCES "OptionContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

