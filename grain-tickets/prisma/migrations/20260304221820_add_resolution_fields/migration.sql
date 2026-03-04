-- AlterTable
ALTER TABLE "SettlementLine" ADD COLUMN     "resolutionDate" TIMESTAMP(3),
ADD COLUMN     "resolutionNotes" TEXT,
ADD COLUMN     "resolutionStatus" TEXT;
