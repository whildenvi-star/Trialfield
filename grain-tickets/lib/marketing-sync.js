// lib/marketing-sync.js
// Phase 17 — shared marketing-sync status classifier + persistence helper.
// Requirable from both server.js (pushDeliveryToMarketing) and
// scripts/repush-deliveries.cjs. CommonJS, zero dependencies.
//
// This module owns the mapping from "what organic-cert's ingest-delivery
// route (or a local guard) told us" to "what we write onto the Ticket row."
// It does NOT import lib/db.js — persistMarketingSyncResult takes a prisma
// client as its first argument so callers (and tests, via a stub) each
// supply their own instance. See 17-RESEARCH.md Pattern 1 / Pitfall 3 and
// 17-01-PLAN.md <interfaces> for the contract this file publishes.

'use strict';

// Frozen status map. 'no-buyer' and 'pending' are derived-only states:
// 'pending' is only ever produced by buildMarketingSyncView (buyer set,
// never yet pushed); 'no-buyer' is produced there AND by the retract
// branch of classifyPushOutcome (buyer removed -> delivery deleted
// upstream). No other path writes either of those two values.
const MARKETING_SYNC_STATUS = Object.freeze({
  NO_BUYER: 'no-buyer',
  PENDING: 'pending',
  APPLIED: 'applied',
  UNAPPLIED: 'unapplied',
  SKIPPED: 'skipped',
  ERROR: 'error',
});

const MAX_DETAIL_LENGTH = 300;

// scrubDetail: redact shared-secret token values (T-17-04) and cap length.
// Detail strings must only ever be built from response.status, result.error,
// result.reason, result.cropName, result.cropYear, result.applyOutcome, and
// error.message — never headers, never request bodies, never the token
// variable itself. This function is the last line of defense in case a
// caller ever slips a token value into a detail string by accident.
function scrubDetail(detail) {
  if (detail == null) return null;
  let out = String(detail);

  const secrets = [process.env.ECOSYSTEM_TOKEN, process.env.EMBED_TOKEN];
  for (const secret of secrets) {
    if (secret) {
      out = out.split(secret).join('[redacted]');
    }
  }

  if (out.length > MAX_DETAIL_LENGTH) {
    out = out.slice(0, MAX_DETAIL_LENGTH);
  }

  return out;
}

// classifyPushOutcome: pure. Turns the result of a single
// pushDeliveryToMarketing HTTP attempt into a persistable outcome object.
//
// Branch precedence (first match wins):
//   1. `error` present            -> transport failure (fetch threw / timed out)
//   2. `!ok`                      -> non-2xx HTTP response
//   3. result.status === 'skipped'          -> organic-cert-side skip (unknown variant)
//   4. result.status deleted/not-found      -> retract (buyer removed / delivery gone)
//   5. result.applyOutcome mapping          -> applied | partially-applied -> APPLIED
//                                               unapplied | ambiguous | other -> UNAPPLIED
function classifyPushOutcome(input) {
  const { ok, httpStatus, result: rawResult, error } = input || {};
  const result = rawResult || {};

  if (error) {
    return {
      status: MARKETING_SYNC_STATUS.ERROR,
      detail: scrubDetail(`unreachable: ${error.message || String(error)}`),
      contractId: null,
      contractLabel: null,
      appliedBushels: null,
    };
  }

  if (!ok) {
    const suffix = result.error ? `: ${result.error}` : '';
    return {
      status: MARKETING_SYNC_STATUS.ERROR,
      detail: scrubDetail(`http-${httpStatus}${suffix}`),
      contractId: null,
      contractLabel: null,
      appliedBushels: null,
    };
  }

  if (result.status === 'skipped') {
    const parts = [result.reason || 'unknown'];
    if (result.cropName) parts.push(`"${result.cropName}"`);
    if (result.cropYear != null) parts.push(String(result.cropYear));
    return {
      status: MARKETING_SYNC_STATUS.SKIPPED,
      detail: scrubDetail(parts.join(' ')),
      contractId: null,
      contractLabel: null,
      appliedBushels: null,
    };
  }

  if (result.status === 'deleted' || result.status === 'not-found') {
    return {
      status: MARKETING_SYNC_STATUS.NO_BUYER,
      detail: scrubDetail(`retracted (${result.status})`),
      contractId: null,
      contractLabel: null,
      appliedBushels: null,
    };
  }

  const applyOutcome = result.applyOutcome;
  const isApplied = applyOutcome === 'applied' || applyOutcome === 'partially-applied';
  const status = isApplied ? MARKETING_SYNC_STATUS.APPLIED : MARKETING_SYNC_STATUS.UNAPPLIED;

  let detail;
  if (applyOutcome === 'unapplied') {
    detail = 'no open contract';
  } else if (applyOutcome === 'ambiguous') {
    detail = 'ambiguous match — multiple open contracts';
  } else if (applyOutcome) {
    detail = applyOutcome; // 'applied' | 'partially-applied'
  } else {
    detail = 'unknown outcome';
  }

  return {
    status,
    detail: scrubDetail(detail),
    // Contract identity is only meaningful (and only ever returned by
    // organic-cert) when something was actually applied.
    contractId: isApplied ? (result.contractId != null ? result.contractId : null) : null,
    contractLabel: isApplied ? (result.contractLabel != null ? result.contractLabel : null) : null,
    appliedBushels: result.appliedBushels != null ? result.appliedBushels : null,
  };
}

// classifyLocalOutcome: pure. Covers the guards inside pushDeliveryToMarketing
// that never attempt the network call at all (Pitfall 3): missing token,
// missing local buyer row, and the netBU<=0 local skip.
function classifyLocalOutcome(kind) {
  switch (kind) {
    case 'no-token':
      return {
        status: MARKETING_SYNC_STATUS.ERROR,
        detail: scrubDetail('ECOSYSTEM_TOKEN/EMBED_TOKEN not set — push skipped'),
        contractId: null,
        contractLabel: null,
        appliedBushels: null,
      };
    case 'buyer-missing':
      return {
        status: MARKETING_SYNC_STATUS.ERROR,
        detail: scrubDetail('local buyer not found — push skipped'),
        contractId: null,
        contractLabel: null,
        appliedBushels: null,
      };
    case 'zero-bushels':
      return {
        status: MARKETING_SYNC_STATUS.UNAPPLIED,
        detail: scrubDetail('local-skip: netBU<=0'),
        contractId: null,
        contractLabel: null,
        appliedBushels: null,
      };
    default:
      throw new Error(`classifyLocalOutcome: unknown kind "${kind}"`);
  }
}

// buildMarketingSyncView: pure. Derives the `_marketingSync` object rendered
// by tickets.js from a raw Prisma Ticket row (or any object shaped like one).
// Uses `== null` checks throughout so falsy-but-meaningful values (0 bushels,
// empty string) survive rather than collapsing to null.
function buildMarketingSyncView(dbTicket) {
  const t = dbTicket || {};

  if (t.buyerId == null) {
    return {
      status: MARKETING_SYNC_STATUS.NO_BUYER,
      detail: null,
      contractId: null,
      contractLabel: null,
      appliedBushels: null,
      syncedAt: null,
    };
  }

  const status = t.marketingSyncStatus == null ? MARKETING_SYNC_STATUS.PENDING : t.marketingSyncStatus;

  let syncedAt = null;
  if (t.marketingSyncedAt != null) {
    syncedAt = t.marketingSyncedAt instanceof Date
      ? t.marketingSyncedAt.toISOString()
      : t.marketingSyncedAt;
  }

  return {
    status,
    detail: t.marketingSyncDetail == null ? null : t.marketingSyncDetail,
    contractId: t.marketingContractId == null ? null : t.marketingContractId,
    contractLabel: t.marketingContractLabel == null ? null : t.marketingContractLabel,
    appliedBushels: t.marketingAppliedBushels == null ? null : t.marketingAppliedBushels,
    syncedAt,
  };
}

// persistMarketingSyncResult: async. Writes exactly the six marketingSync*
// columns and nothing else (T-17-05 — never crop/buyerId/netWeight/etc).
// Called from the fire-and-forget push path, so it must never throw: a
// P2025 (ticket deleted before the async push resolved, T-17-06) resolves
// false; any other error is logged and also resolves false.
async function persistMarketingSyncResult(prisma, ticketId, outcome) {
  const data = {
    marketingSyncStatus: outcome.status,
    marketingSyncedAt: new Date(),
    marketingSyncDetail: outcome.detail != null ? outcome.detail : null,
    marketingContractId: outcome.contractId != null ? outcome.contractId : null,
    marketingContractLabel: outcome.contractLabel != null ? outcome.contractLabel : null,
    marketingAppliedBushels: outcome.appliedBushels != null ? outcome.appliedBushels : null,
  };

  try {
    await prisma.ticket.update({ where: { id: ticketId }, data });
    return true;
  } catch (err) {
    if (err && err.code === 'P2025') {
      console.warn(`persistMarketingSyncResult: ticket ${ticketId} not found (already deleted) — skipping`);
      return false;
    }
    console.error(`persistMarketingSyncResult: failed to persist for ticket ${ticketId}:`, err && err.message);
    return false;
  }
}

module.exports = {
  MARKETING_SYNC_STATUS,
  classifyPushOutcome,
  classifyLocalOutcome,
  buildMarketingSyncView,
  persistMarketingSyncResult,
  scrubDetail,
};
