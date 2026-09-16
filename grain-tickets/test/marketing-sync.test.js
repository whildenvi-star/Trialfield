// test/marketing-sync.test.js
// Phase 17 — coverage for lib/marketing-sync.js. First automated test in
// this app. Uses Node's built-in test runner (`node --test`), zero new
// dependencies (VALIDATION.md Wave 0 decision).

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  MARKETING_SYNC_STATUS,
  classifyPushOutcome,
  classifyLocalOutcome,
  buildMarketingSyncView,
  persistMarketingSyncResult,
  scrubDetail,
} = require('../lib/marketing-sync.js');

describe('classifyPushOutcome', () => {
  test('http-403 with a JSON error body -> error, detail starts with http-403', () => {
    const outcome = classifyPushOutcome({ ok: false, httpStatus: 403, result: { error: 'Forbidden' } });
    assert.equal(outcome.status, MARKETING_SYNC_STATUS.ERROR);
    assert.ok(outcome.detail.startsWith('http-403'), `expected detail to start with http-403, got "${outcome.detail}"`);
    assert.equal(outcome.contractId, null);
  });

  test('http-500 with empty result body -> error, detail http-500', () => {
    const outcome = classifyPushOutcome({ ok: false, httpStatus: 500, result: {} });
    assert.equal(outcome.status, MARKETING_SYNC_STATUS.ERROR);
    assert.equal(outcome.detail, 'http-500');
  });

  test('transport failure (no response at all) -> error, detail starts with unreachable:', () => {
    const outcome = classifyPushOutcome({ error: new Error('fetch failed') });
    assert.equal(outcome.status, MARKETING_SYNC_STATUS.ERROR);
    assert.ok(outcome.detail.startsWith('unreachable:'), `expected detail to start with unreachable:, got "${outcome.detail}"`);
  });

  test('organic-cert skip (unknown variant) -> skipped, detail carries reason/cropName/cropYear', () => {
    const outcome = classifyPushOutcome({
      ok: true,
      result: { status: 'skipped', reason: 'unknown-variant', cropName: 'Seed Wheat', cropYear: 2026 },
    });
    assert.equal(outcome.status, MARKETING_SYNC_STATUS.SKIPPED);
    assert.match(outcome.detail, /unknown-variant/);
    assert.match(outcome.detail, /Seed Wheat/);
    assert.match(outcome.detail, /2026/);
  });

  test('applied -> status applied, appliedBushels/contractId/contractLabel pass through unchanged', () => {
    const outcome = classifyPushOutcome({
      ok: true,
      result: {
        status: 'created',
        applyOutcome: 'applied',
        appliedBushels: 860.74,
        contractId: 'con-1',
        contractLabel: 'ADM Beloit — Organic Yellow Corn 2026',
      },
    });
    assert.equal(outcome.status, MARKETING_SYNC_STATUS.APPLIED);
    assert.equal(outcome.appliedBushels, 860.74);
    assert.equal(outcome.contractId, 'con-1');
    assert.equal(outcome.contractLabel, 'ADM Beloit — Organic Yellow Corn 2026');
  });

  test('partially-applied -> status applied, detail mentions partially-applied', () => {
    const outcome = classifyPushOutcome({
      ok: true,
      result: { status: 'updated', applyOutcome: 'partially-applied', appliedBushels: 100, netBushels: 860, contractId: 'con-1' },
    });
    assert.equal(outcome.status, MARKETING_SYNC_STATUS.APPLIED);
    assert.match(outcome.detail, /partially-applied/);
  });

  test('unapplied (no open contract) -> status unapplied, detail exact, contractId null', () => {
    const outcome = classifyPushOutcome({
      ok: true,
      result: { status: 'created', applyOutcome: 'unapplied', appliedBushels: 0 },
    });
    assert.equal(outcome.status, MARKETING_SYNC_STATUS.UNAPPLIED);
    assert.equal(outcome.detail, 'no open contract');
    assert.equal(outcome.contractId, null);
  });

  test('ambiguous (multiple open contracts) -> status unapplied, detail contains ambiguous', () => {
    const outcome = classifyPushOutcome({
      ok: true,
      result: { status: 'created', applyOutcome: 'ambiguous', appliedBushels: 0 },
    });
    assert.equal(outcome.status, MARKETING_SYNC_STATUS.UNAPPLIED);
    assert.match(outcome.detail, /ambiguous/);
  });

  test('retract: deleted -> status no-buyer, detail mentions retracted', () => {
    const outcome = classifyPushOutcome({ ok: true, result: { status: 'deleted' } });
    assert.equal(outcome.status, MARKETING_SYNC_STATUS.NO_BUYER);
    assert.match(outcome.detail, /retracted/);
  });

  test('retract: not-found -> status no-buyer, detail mentions retracted', () => {
    const outcome = classifyPushOutcome({ ok: true, result: { status: 'not-found' } });
    assert.equal(outcome.status, MARKETING_SYNC_STATUS.NO_BUYER);
    assert.match(outcome.detail, /retracted/);
  });
});

describe('classifyLocalOutcome', () => {
  test('no-token -> error, detail names ECOSYSTEM_TOKEN and contains no token value', () => {
    const prevEco = process.env.ECOSYSTEM_TOKEN;
    process.env.ECOSYSTEM_TOKEN = 's3cr3t-value';
    try {
      const outcome = classifyLocalOutcome('no-token');
      assert.equal(outcome.status, MARKETING_SYNC_STATUS.ERROR);
      assert.match(outcome.detail, /ECOSYSTEM_TOKEN/);
      assert.ok(!outcome.detail.includes('s3cr3t-value'));
    } finally {
      if (prevEco === undefined) delete process.env.ECOSYSTEM_TOKEN;
      else process.env.ECOSYSTEM_TOKEN = prevEco;
    }
  });

  test('buyer-missing -> error', () => {
    const outcome = classifyLocalOutcome('buyer-missing');
    assert.equal(outcome.status, MARKETING_SYNC_STATUS.ERROR);
  });

  test('zero-bushels -> unapplied, detail contains local-skip', () => {
    const outcome = classifyLocalOutcome('zero-bushels');
    assert.equal(outcome.status, MARKETING_SYNC_STATUS.UNAPPLIED);
    assert.match(outcome.detail, /local-skip/);
  });
});

describe('scrubDetail', () => {
  test('redacts the current ECOSYSTEM_TOKEN value and leaves no raw occurrence', () => {
    const prev = process.env.ECOSYSTEM_TOKEN;
    process.env.ECOSYSTEM_TOKEN = 's3cr3t-value';
    try {
      const out = scrubDetail('push failed, token s3cr3t-value was rejected');
      assert.match(out, /\[redacted\]/);
      assert.ok(!out.includes('s3cr3t-value'));
    } finally {
      if (prev === undefined) delete process.env.ECOSYSTEM_TOKEN;
      else process.env.ECOSYSTEM_TOKEN = prev;
    }
  });

  test('truncates to at most 300 characters', () => {
    const long = 'x'.repeat(900);
    const out = scrubDetail(long);
    assert.ok(out.length <= 300, `expected length <= 300, got ${out.length}`);
  });
});

describe('buildMarketingSyncView', () => {
  test('no buyer -> status no-buyer, everything else null', () => {
    const view = buildMarketingSyncView({ buyerId: null });
    assert.equal(view.status, MARKETING_SYNC_STATUS.NO_BUYER);
    assert.equal(view.contractId, null);
    assert.equal(view.appliedBushels, null);
    assert.equal(view.syncedAt, null);
  });

  test('buyer set, never pushed -> status pending', () => {
    const view = buildMarketingSyncView({ buyerId: 3, marketingSyncStatus: null });
    assert.equal(view.status, MARKETING_SYNC_STATUS.PENDING);
  });

  test('buyer set, applied -> status applied, syncedAt ISO string, appliedBushels passthrough', () => {
    const view = buildMarketingSyncView({
      buyerId: 3,
      marketingSyncStatus: 'applied',
      marketingAppliedBushels: 860.74,
      marketingContractLabel: 'X',
      marketingSyncedAt: new Date('2026-08-06T12:00:00Z'),
    });
    assert.equal(view.status, 'applied');
    assert.equal(view.syncedAt, '2026-08-06T12:00:00.000Z');
    assert.equal(view.appliedBushels, 860.74);
  });

  test('appliedBushels: 0 survives as 0, not coerced to null', () => {
    const view = buildMarketingSyncView({
      buyerId: 3,
      marketingSyncStatus: 'unapplied',
      marketingAppliedBushels: 0,
    });
    assert.equal(view.appliedBushels, 0);
    assert.notEqual(view.appliedBushels, null);
  });
});

describe('persistMarketingSyncResult', () => {
  test('calls prisma.ticket.update once with where:{id} and exactly the six marketingSync* keys; resolves true', async () => {
    let callCount = 0;
    let capturedArgs = null;
    const stubPrisma = {
      ticket: {
        update: async (args) => {
          callCount += 1;
          capturedArgs = args;
          return {};
        },
      },
    };

    const result = await persistMarketingSyncResult(stubPrisma, 42, {
      status: 'applied',
      detail: 'applied',
      contractId: 'con-1',
      contractLabel: 'ADM Beloit — Organic Yellow Corn 2026',
      appliedBushels: 860.74,
    });

    assert.equal(result, true);
    assert.equal(callCount, 1);
    assert.deepEqual(capturedArgs.where, { id: 42 });
    assert.deepEqual(
      Object.keys(capturedArgs.data).sort(),
      [
        'marketingAppliedBushels',
        'marketingContractId',
        'marketingContractLabel',
        'marketingSyncDetail',
        'marketingSyncStatus',
        'marketingSyncedAt',
      ]
    );
  });

  test('P2025 (row already deleted) resolves false, does not rethrow', async () => {
    const stubPrisma = {
      ticket: {
        update: async () => {
          const err = new Error('Record to update not found.');
          err.code = 'P2025';
          throw err;
        },
      },
    };

    const result = await persistMarketingSyncResult(stubPrisma, 99, { status: 'error', detail: 'x', contractId: null, contractLabel: null, appliedBushels: null });
    assert.equal(result, false);
  });

  test('any other error resolves false, does not rethrow', async () => {
    const stubPrisma = {
      ticket: {
        update: async () => {
          throw new Error('connection reset');
        },
      },
    };

    const result = await persistMarketingSyncResult(stubPrisma, 7, { status: 'error', detail: 'x', contractId: null, contractLabel: null, appliedBushels: null });
    assert.equal(result, false);
  });
});
