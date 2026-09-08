import { createHmac } from 'crypto'

// embedKey → backend app name (the grant's scope). ORG_CERT is absent on
// purpose — organic-cert has its own NextAuth login and takes no grant.
const EMBED_APP_BY_KEY: Record<string, string> = {
  FARM_BUDGET: 'farm-budget',
  // The planning-year instance runs the same codebase and verifies the same
  // app scope — one grant opens whichever year you walk into.
  FARM_BUDGET_2027: 'farm-budget',
  GRAIN_TICKETS: 'grain-tickets',
  MERISTEM_MALT: 'meristem-malt',
  FARM_REGISTRY: 'farm-registry',
  SEED_INVENTORY: 'seed-inventory',
}

const GRANT_TTL_SECONDS = 24 * 60 * 60

/**
 * Mint a per-user, per-app embed grant.
 *
 *   v1.<app>.<userId>.<exp>.<hmac>          — legacy, no role claim
 *   v2.<app>.<userId>.<role>.<exp>.<hmac>   — role rides inside the signed payload
 *
 * Signed with the server-held EMBED_TOKEN, which never reaches the browser —
 * the Express apps verify app-match + expiry + HMAC. Module restriction is
 * enforced by which grants the portal chooses to mint (the module page only
 * renders after middleware checks module_access).
 *
 * Pass `role` to mint v2 so the backend can authorize server-side instead of
 * trusting the ?role= URL param. Only apps whose verifier accepts v2 may get
 * one (farm-budget today) — v1-only verifiers reject 6-part grants outright.
 */
export function mintEmbedGrant(embedKey: string, userId: string, role?: string): string | null {
  const app = EMBED_APP_BY_KEY[embedKey]
  const secret = process.env.EMBED_TOKEN
  if (!app || !secret) return null
  const exp = Math.floor(Date.now() / 1000) + GRANT_TTL_SECONDS
  const payload = role
    ? `v2.${app}.${userId}.${role}.${exp}`
    : `v1.${app}.${userId}.${exp}`
  const sig = createHmac('sha256', secret).update(payload).digest('hex')
  return `${payload}.${sig}`
}
