-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "marketingAppliedBushels" DOUBLE PRECISION,
ADD COLUMN     "marketingContractId" TEXT,
ADD COLUMN     "marketingContractLabel" TEXT,
ADD COLUMN     "marketingSyncDetail" TEXT,
ADD COLUMN     "marketingSyncStatus" TEXT,
ADD COLUMN     "marketingSyncedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Ticket_marketingSyncStatus_idx" ON "Ticket"("marketingSyncStatus");

