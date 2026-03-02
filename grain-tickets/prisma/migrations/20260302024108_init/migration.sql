-- CreateTable
CREATE TABLE "Ticket" (
    "id" SERIAL NOT NULL,
    "legacyId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "cropYear" INTEGER NOT NULL,
    "farm" TEXT NOT NULL,
    "netWeight" DOUBLE PRECISION NOT NULL,
    "moisture" DOUBLE PRECISION NOT NULL,
    "fm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "crop" TEXT NOT NULL,
    "ticketNo" TEXT,
    "hbtBinNo" TEXT,
    "truckId" TEXT,
    "destination" TEXT,
    "notes" TEXT,
    "buyerId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Farm" (
    "id" SERIAL NOT NULL,
    "legacyId" TEXT,
    "registryId" TEXT,
    "name" TEXT NOT NULL,
    "crop" TEXT,
    "acres" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reportingAcres" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "organicAcres" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'BU',
    "type" TEXT NOT NULL DEFAULT 'Conventional',
    "guarantee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "coverage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "claimThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "testWeight" DOUBLE PRECISION NOT NULL DEFAULT 56,
    "driver" TEXT,
    "truck" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Farm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CropConfig" (
    "id" SERIAL NOT NULL,
    "cropYear" INTEGER NOT NULL,
    "cropName" TEXT NOT NULL,
    "testWeight" DOUBLE PRECISION NOT NULL DEFAULT 56,
    "moistureShrink" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CropConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Buyer" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "shortCode" TEXT,
    "type" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Buyer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyerColumnMap" (
    "id" SERIAL NOT NULL,
    "buyerId" INTEGER NOT NULL,
    "fieldName" TEXT NOT NULL,
    "csvColumn" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuyerColumnMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" SERIAL NOT NULL,
    "buyerId" INTEGER NOT NULL,
    "cropYear" INTEGER NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceFile" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementLine" (
    "id" SERIAL NOT NULL,
    "settlementId" INTEGER NOT NULL,
    "ticketNo" TEXT,
    "date" TIMESTAMP(3),
    "netWeight" DOUBLE PRECISION,
    "moisture" DOUBLE PRECISION,
    "netBushels" DOUBLE PRECISION,
    "price" DECIMAL(10,4),
    "deductions" DECIMAL(10,2),
    "netPayment" DECIMAL(10,2),
    "ticketId" INTEGER,
    "matchStatus" TEXT NOT NULL DEFAULT 'unmatched',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SettlementLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ticket_ticketNo_idx" ON "Ticket"("ticketNo");

-- CreateIndex
CREATE INDEX "Ticket_farm_cropYear_idx" ON "Ticket"("farm", "cropYear");

-- CreateIndex
CREATE INDEX "Ticket_crop_cropYear_idx" ON "Ticket"("crop", "cropYear");

-- CreateIndex
CREATE INDEX "Ticket_buyerId_idx" ON "Ticket"("buyerId");

-- CreateIndex
CREATE UNIQUE INDEX "Farm_name_key" ON "Farm"("name");

-- CreateIndex
CREATE INDEX "CropConfig_cropYear_idx" ON "CropConfig"("cropYear");

-- CreateIndex
CREATE UNIQUE INDEX "CropConfig_cropYear_cropName_key" ON "CropConfig"("cropYear", "cropName");

-- CreateIndex
CREATE UNIQUE INDEX "Buyer_name_key" ON "Buyer"("name");

-- CreateIndex
CREATE UNIQUE INDEX "BuyerColumnMap_buyerId_fieldName_key" ON "BuyerColumnMap"("buyerId", "fieldName");

-- CreateIndex
CREATE INDEX "Settlement_buyerId_cropYear_idx" ON "Settlement"("buyerId", "cropYear");

-- CreateIndex
CREATE INDEX "SettlementLine_settlementId_idx" ON "SettlementLine"("settlementId");

-- CreateIndex
CREATE INDEX "SettlementLine_ticketNo_idx" ON "SettlementLine"("ticketNo");

-- CreateIndex
CREATE INDEX "SettlementLine_ticketId_idx" ON "SettlementLine"("ticketId");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerColumnMap" ADD CONSTRAINT "BuyerColumnMap_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementLine" ADD CONSTRAINT "SettlementLine_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementLine" ADD CONSTRAINT "SettlementLine_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
