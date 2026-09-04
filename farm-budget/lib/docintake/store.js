'use strict';

// Document intake — evidence store.
//
// The uploaded original is the audit evidence behind every confirmed pass, so
// it is kept on disk beside a small ledger. Deliberately NOT in data.json:
// that file is the budget's hot path and has been clobbered by a bad deploy
// before — documents live in their own tree so a data restore never eats them.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DOC_DIR = path.join(__dirname, '..', '..', 'data', 'documents');
const LEDGER = path.join(DOC_DIR, 'ledger.json');

const EXT = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/heic': '.heic',
  'image/webp': '.webp'
};

function ensureDir() {
  if (!fs.existsSync(DOC_DIR)) fs.mkdirSync(DOC_DIR, { recursive: true });
}

function readLedger() {
  ensureDir();
  try {
    return JSON.parse(fs.readFileSync(LEDGER, 'utf8'));
  } catch (e) {
    return { documents: [] };
  }
}

function writeLedger(ledger) {
  ensureDir();
  fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 2));
}

// Content hash is the id: re-uploading the same scan lands on the same record
// instead of creating a second copy to reconcile.
function saveOriginal(buffer, mediaType, filename) {
  ensureDir();
  const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);
  const ext = EXT[mediaType] || '.bin';
  const stored = hash + ext;
  const full = path.join(DOC_DIR, stored);
  if (!fs.existsSync(full)) fs.writeFileSync(full, buffer);
  return { id: hash, storedAs: stored, filename: filename || stored, bytes: buffer.length, mediaType: mediaType };
}

function upsert(record) {
  const ledger = readLedger();
  const i = ledger.documents.findIndex(function (d) { return d.id === record.id; });
  if (i >= 0) ledger.documents[i] = Object.assign({}, ledger.documents[i], record);
  else ledger.documents.unshift(record);
  writeLedger(ledger);
  return record;
}

function get(id) {
  return readLedger().documents.find(function (d) { return d.id === id; }) || null;
}

function list(limit) {
  return readLedger().documents.slice(0, limit || 50).map(function (d) {
    return {
      id: d.id, filename: d.filename, mediaType: d.mediaType, bytes: d.bytes,
      uploadedAt: d.uploadedAt, uploadedBy: d.uploadedBy, docKind: d.docKind,
      summary: d.summary, appliedAt: d.appliedAt || null, appliedCount: d.appliedCount || 0
    };
  });
}

function originalPath(id) {
  const rec = get(id);
  if (!rec) return null;
  return path.join(DOC_DIR, rec.storedAs);
}

module.exports = { saveOriginal, upsert, get, list, originalPath, DOC_DIR };
