-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshTokenHash_key" ON "Session"("refreshTokenHash");

-- AddCheckConstraint
ALTER TABLE "Transaction"
ADD CONSTRAINT "Transaction_instrumentId_optionContractId_check"
CHECK (NOT ("instrumentId" IS NOT NULL AND "optionContractId" IS NOT NULL));

