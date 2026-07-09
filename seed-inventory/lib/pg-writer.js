'use strict';

const { Pool } = require('pg');

let pool = null;

function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL not set — cannot write to shared database');
    }
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

async function findSeedLotId(client, product) {
  if (!product) return null;
  const searchTerm = product.variety || product.productName || '';
  if (!searchTerm) return null;

  // Exact match first — substring LIKE can match the wrong lot ("Corn" → "Popcorn")
  const exact = await client.query(
    `SELECT id FROM "SeedLot" WHERE LOWER(variety) = LOWER($1) LIMIT 1`,
    [searchTerm]
  );
  if (exact.rows[0]) return exact.rows[0].id;

  const result = await client.query(
    `SELECT id FROM "SeedLot"
     WHERE LOWER(variety) LIKE LOWER($1)
        OR LOWER($1) LIKE LOWER(variety)
     LIMIT 1`,
    [`%${searchTerm}%`]
  );
  if (result.rows[0]) {
    console.warn(`[pg-writer] fuzzy SeedLot match for "${searchTerm}" — verify lot ${result.rows[0].id} is correct`);
    return result.rows[0].id;
  }
  return null;
}

async function findMaterialId(client, product) {
  if (!product) return null;
  const name = product.productName || product.name || '';
  if (!name) return null;

  const exact = await client.query(
    `SELECT id FROM "Material" WHERE LOWER(name) = LOWER($1) LIMIT 1`,
    [name]
  );
  if (exact.rows[0]) return exact.rows[0].id;

  const result = await client.query(
    `SELECT id FROM "Material" WHERE LOWER(name) LIKE LOWER($1) LIMIT 1`,
    [`%${name}%`]
  );
  if (result.rows[0]) {
    console.warn(`[pg-writer] fuzzy Material match for "${name}" — verify material ${result.rows[0].id} is correct`);
    return result.rows[0].id;
  }
  return null;
}

/**
 * Write a seed-inventory receipt into the shared PostgreSQL SeedReceipt table.
 * Called after the JSON write succeeds — errors are logged but never thrown.
 */
async function writeSeedReceipt(receipt, product) {
  const db = getPool();
  const client = await db.connect();
  try {
    const seedLotId = await findSeedLotId(client, product);

    await client.query(
      `INSERT INTO "SeedReceipt"
         (id, "seedLotId", "siProductId", "dateReceived", "quantityReceived",
          unit, "lotNumber", "ticketNumber", "receivedBy", notes, "photoPath",
          "discrepancyFlag", "discrepancyNotes", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       ON CONFLICT (id) DO UPDATE SET
         "seedLotId"        = EXCLUDED."seedLotId",
         "quantityReceived" = EXCLUDED."quantityReceived",
         "lotNumber"        = EXCLUDED."lotNumber",
         "ticketNumber"     = EXCLUDED."ticketNumber",
         "discrepancyFlag"  = EXCLUDED."discrepancyFlag",
         "discrepancyNotes" = EXCLUDED."discrepancyNotes",
         "updatedAt"        = EXCLUDED."updatedAt"`,
      [
        receipt.id,
        seedLotId,
        receipt.productId ?? null,
        receipt.dateReceived ? new Date(receipt.dateReceived) : new Date(),
        receipt.quantityReceived ?? 0,
        receipt.unit ?? '',
        receipt.lotNumber ?? null,
        receipt.ticketNumber ?? null,
        receipt.receivedBy ?? null,
        receipt.notes ?? null,
        receipt.photoPath ?? null,
        receipt.discrepancyFlag ?? false,
        receipt.discrepancyNotes ?? null,
        receipt.createdAt ? new Date(receipt.createdAt) : new Date(),
        receipt.updatedAt ? new Date(receipt.updatedAt) : new Date(),
      ]
    );
  } finally {
    client.release();
  }
}

/**
 * Write an INPUT-type receipt into the shared PostgreSQL InputReceipt table.
 * Called after the JSON write succeeds — errors are logged but never thrown.
 */
async function writeInputReceipt(receipt, product) {
  const db = getPool();
  const client = await db.connect();
  try {
    const materialId = await findMaterialId(client, product);

    await client.query(
      `INSERT INTO "InputReceipt"
         (id, "siProductId", "materialId", "dateReceived", "quantityReceived",
          unit, "lotNumber", "ticketNumber", "receivedBy",
          "discrepancyFlag", "discrepancyNotes", notes, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (id) DO UPDATE SET
         "materialId"       = EXCLUDED."materialId",
         "quantityReceived" = EXCLUDED."quantityReceived",
         "lotNumber"        = EXCLUDED."lotNumber",
         "ticketNumber"     = EXCLUDED."ticketNumber",
         "discrepancyFlag"  = EXCLUDED."discrepancyFlag",
         "discrepancyNotes" = EXCLUDED."discrepancyNotes",
         "updatedAt"        = EXCLUDED."updatedAt"`,
      [
        receipt.id,
        receipt.productId ?? null,
        materialId,
        receipt.dateReceived ? new Date(receipt.dateReceived) : new Date(),
        receipt.quantityReceived ?? 0,
        receipt.unit ?? '',
        receipt.lotNumber ?? null,
        receipt.ticketNumber ?? null,
        receipt.receivedBy ?? null,
        receipt.discrepancyFlag ?? false,
        receipt.discrepancyNotes ?? null,
        receipt.notes ?? null,
        receipt.createdAt ? new Date(receipt.createdAt) : new Date(),
        receipt.updatedAt ? new Date(receipt.updatedAt) : new Date(),
      ]
    );
  } finally {
    client.release();
  }
}

/**
 * Write a purchase order and its line items into the shared PostgreSQL tables.
 * products is the full seed-inventory product store for resolving seedLotId/materialId.
 * Called after the JSON write succeeds — errors are logged but never thrown.
 */
async function writePurchaseOrder(order, lineItems, products) {
  if (!order || !order.id) return;
  const db = getPool();
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const supplierName = order.supplierName || order.supplier || null;
    const orderDate = order.orderDate || order.createdAt || new Date().toISOString();
    const cropYear = order.cropYear || new Date().getFullYear();
    const status = order.status || 'pending';

    await client.query(
      `INSERT INTO "PurchaseOrder"
         (id, "cropYear", "supplierId", "supplierName", status, "orderDate", notes, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         "cropYear"    = EXCLUDED."cropYear",
         "supplierName"= EXCLUDED."supplierName",
         status        = EXCLUDED.status,
         "orderDate"   = EXCLUDED."orderDate",
         notes         = EXCLUDED.notes,
         "updatedAt"   = EXCLUDED."updatedAt"`,
      [
        order.id,
        cropYear,
        order.supplierId ?? null,
        supplierName,
        status,
        new Date(orderDate),
        order.notes ?? null,
        order.createdAt ? new Date(order.createdAt) : new Date(),
        order.updatedAt ? new Date(order.updatedAt) : new Date(),
      ]
    );

    const items = lineItems || order.items || order.products || [];
    for (const item of items) {
      const itemId = item.id || (order.id + '_' + (item.productId || item.siProductId || Math.random().toString(36).slice(2)));
      const product = products ? products.find(function (p) { return p.id === (item.productId || item.siProductId); }) : null;
      const isSeed = product && product.type === 'SEED';

      let seedLotId = null;
      let materialId = null;
      if (isSeed) {
        seedLotId = await findSeedLotId(client, product);
      } else if (product) {
        materialId = await findMaterialId(client, product);
      }

      const itemCropYear = item.cropYear || cropYear;

      await client.query(
        `INSERT INTO "PurchaseOrderLineItem"
           (id, "orderId", "siProductId", "seedLotId", "materialId",
            "quantityOrdered", unit, "unitPrice", "cropYear")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           "quantityOrdered" = EXCLUDED."quantityOrdered",
           "unitPrice"       = EXCLUDED."unitPrice",
           "seedLotId"       = EXCLUDED."seedLotId",
           "materialId"      = EXCLUDED."materialId",
           "cropYear"        = EXCLUDED."cropYear"`,
        [
          itemId,
          order.id,
          item.productId || item.siProductId || null,
          seedLotId,
          materialId,
          item.quantityOrdered || item.quantity || 0,
          item.unit || '',
          item.unitPrice || item.pricePerUnit || null,
          itemCropYear,
        ]
      );
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { writeSeedReceipt, writeInputReceipt, writePurchaseOrder };
