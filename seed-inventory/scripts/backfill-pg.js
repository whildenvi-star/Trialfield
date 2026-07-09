#!/usr/bin/env node
'use strict';

/**
 * One-time backfill: reads data.json and mirrors existing orders and INPUT-type
 * receipts into the shared PostgreSQL database.
 *
 * Safe to re-run — all writes use ON CONFLICT DO UPDATE (upsert).
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/backfill-pg.js
 *   (DATABASE_URL is loaded from .env automatically)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const { writeSeedReceipt, writeInputReceipt, writePurchaseOrder } = require('../lib/pg-writer');

const DATA_FILE = path.join(__dirname, '..', 'data', 'data.json');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL is not set.');
    process.exit(1);
  }

  console.log('Loading data.json...');
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const store = JSON.parse(raw);

  const products = store.products || [];
  const orders = store.orders || [];
  const receipts = store.receipts || [];

  console.log(`Found: ${orders.length} orders, ${receipts.length} receipts, ${products.length} products`);

  // ── Backfill orders ──────────────────────────────────────────────────
  let orderOk = 0, orderFail = 0;
  for (const order of orders) {
    try {
      // Each seed-inventory order is a single product (no separate lineItems array)
      const lineItem = {
        id: order.id + '_li',
        productId: order.productId,
        quantityOrdered: order.quantityOrdered,
        unit: order.unit,
        unitPrice: order.pricePerUnit,
        cropYear: order.cropYear,
      };
      await writePurchaseOrder(order, [lineItem], products);
      orderOk++;
    } catch (e) {
      console.warn(`  Order ${order.id} failed: ${e.message}`);
      orderFail++;
    }
    if ((orderOk + orderFail) % 50 === 0) {
      process.stdout.write(`  Orders: ${orderOk} ok, ${orderFail} failed...\r`);
    }
  }
  console.log(`\nOrders: ${orderOk} ok, ${orderFail} failed`);

  // ── Backfill receipts ────────────────────────────────────────────────
  let seedOk = 0, seedFail = 0, inputOk = 0, inputFail = 0, skipped = 0;
  for (const receipt of receipts) {
    const product = products.find(function (p) { return p.id === receipt.productId; });
    try {
      if (product && product.type === 'INPUT') {
        await writeInputReceipt(receipt, product);
        inputOk++;
      } else {
        await writeSeedReceipt(receipt, product);
        seedOk++;
      }
    } catch (e) {
      if (product && product.type === 'INPUT') {
        console.warn(`  Input receipt ${receipt.id} failed: ${e.message}`);
        inputFail++;
      } else {
        console.warn(`  Seed receipt ${receipt.id} failed: ${e.message}`);
        seedFail++;
      }
    }
    if ((seedOk + seedFail + inputOk + inputFail) % 100 === 0) {
      process.stdout.write(`  Seed: ${seedOk} ok, ${seedFail} fail | Input: ${inputOk} ok, ${inputFail} fail...\r`);
    }
  }

  console.log(`\nSeed receipts:  ${seedOk} ok, ${seedFail} failed`);
  console.log(`Input receipts: ${inputOk} ok, ${inputFail} failed`);
  if (skipped > 0) console.log(`Skipped (no product): ${skipped}`);
  console.log('\nBackfill complete.');
}

main().catch(function (e) {
  console.error('Fatal:', e);
  process.exit(1);
});
