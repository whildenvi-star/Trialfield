export interface Module {
  id: string
  label: string
  sublabel: string
  route: string
  status: 'live' | 'coming-soon'
  type: 'native' | 'embed'
  embedKey?: string
}

// Same-origin embed paths — Caddy proxies /embed/<app>/* to Express ports.
// This keeps iframes on the portal's origin so they share localStorage
// (theme, text-scale) without cross-origin isolation issues.
// Falls back to NEXT_PUBLIC_EMBED_URL_* env vars for local dev.
const EMBED_PATHS: Record<string, string> = {
  GRAIN_TICKETS: '/embed/grain-tickets/',
  FARM_BUDGET: '/embed/farm-budget/',
  MERISTEM_MALT: '/embed/meristem-malt/',
  ORG_CERT: 'https://cert.whughesfarms.com/',
  FARM_REGISTRY: '/embed/farm-registry/',
  SEED_INVENTORY: '/embed/seed-inventory/',
}

const EMBED_URL_OVERRIDES: Record<string, string | undefined> = {
  GRAIN_TICKETS: process.env.NEXT_PUBLIC_EMBED_URL_GRAIN_TICKETS,
  FARM_BUDGET: process.env.NEXT_PUBLIC_EMBED_URL_FARM_BUDGET,
  MERISTEM_MALT: process.env.NEXT_PUBLIC_EMBED_URL_MERISTEM_MALT,
  ORG_CERT: process.env.NEXT_PUBLIC_EMBED_URL_ORG_CERT,
  FARM_REGISTRY: process.env.NEXT_PUBLIC_EMBED_URL_FARM_REGISTRY,
  SEED_INVENTORY: process.env.NEXT_PUBLIC_EMBED_URL_SEED_INVENTORY,
}

export function getEmbedUrl(mod: Module): string | null {
  if (mod.type !== 'embed' || !mod.embedKey) return null
  // Use env override (for local dev) or same-origin proxy path (production)
  const base = EMBED_URL_OVERRIDES[mod.embedKey] || EMBED_PATHS[mod.embedKey] || null
  if (!base) return null
  const token = process.env.EMBED_TOKEN
  if (!token) return base
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}token=${token}`
}

export const MODULES: Module[] = [
  {
    id: 'fsa-578',
    label: 'FSA 578',
    sublabel: 'Acreage Reporting',
    route: '/app/fsa-578',
    status: 'live',
    type: 'native',
  },
  {
    id: 'insurance',
    label: 'Insurance',
    sublabel: 'Crop Insurance Tools',
    route: '/app/insurance',
    status: 'live',
    type: 'native',
  },
  {
    id: 'claims',
    label: 'Claims',
    sublabel: 'Crop Insurance Claims',
    route: '/app/claims',
    status: 'live',
    type: 'native',
  },
  {
    id: 'marketing',
    label: 'Grain Marketing',
    sublabel: 'Position & Contracts',
    route: '/app/marketing',
    status: 'live',
    type: 'native',
  },
  {
    id: 'field-timeline',
    label: 'Field Timeline',
    sublabel: 'Activity History',
    route: '/app/field-timeline',
    status: 'live',
    type: 'native',
  },
  {
    id: 'macro-rollup',
    label: 'Field Summary',
    sublabel: 'Whole-farm Overview',
    route: '/app/macro-rollup',
    status: 'live',
    type: 'native',
  },
  {
    id: 'farm-budget',
    label: 'Macro Rollup',
    sublabel: 'Enterprise & Field Planning',
    route: '/app/farm-budget',
    status: 'live',
    type: 'embed',
    embedKey: 'FARM_BUDGET',
  },
  {
    id: 'grain-tickets',
    label: 'Grain Tickets',
    sublabel: 'Grain Traceability',
    route: '/app/grain-tickets',
    status: 'live',
    type: 'embed',
    embedKey: 'GRAIN_TICKETS',
  },
  {
    id: 'farm-registry',
    label: 'Farm Registry',
    sublabel: 'Field & Acre Registry',
    route: '/app/farm-registry',
    status: 'live',
    type: 'embed',
    embedKey: 'FARM_REGISTRY',
  },
  {
    id: 'org-cert',
    label: 'Organic Cert',
    sublabel: 'NOP Compliance',
    route: '/app/org-cert',
    status: 'live',
    type: 'embed',
    embedKey: 'ORG_CERT',
  },
  {
    id: 'meristem-malt',
    label: 'Meristem Malt',
    sublabel: 'Malting Batch Budgets',
    route: '/app/meristem-malt',
    status: 'live',
    type: 'embed',
    embedKey: 'MERISTEM_MALT',
  },
  {
    id: 'seed-inventory',
    label: 'Seed Inventory',
    sublabel: 'Seed & Delivery Tracking',
    route: '/app/seed-inventory',
    status: 'live',
    type: 'embed',
    embedKey: 'SEED_INVENTORY',
  },
]
