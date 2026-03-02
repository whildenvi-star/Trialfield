-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "grainBinId" INTEGER;

-- CreateTable
CREATE TABLE "GrainBin" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrainBin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GrainBin_name_key" ON "GrainBin"("name");

-- CreateIndex
CREATE INDEX "Ticket_grainBinId_idx" ON "Ticket"("grainBinId");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_grainBinId_fkey" FOREIGN KEY ("grainBinId") REFERENCES "GrainBin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
