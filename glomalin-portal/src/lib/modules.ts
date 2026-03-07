export interface Module {
  id: string
  label: string
  sublabel: string
  route: string
  status: 'live' | 'coming-soon'
  type: 'native' | 'embed'
  embedKey?: string
}

const EMBED_URLS: Record<string, string | undefined> = {
  GRAIN_TICKETS: process.env.NEXT_PUBLIC_EMBED_URL_GRAIN_TICKETS,
  FARM_BUDGET: process.env.NEXT_PUBLIC_EMBED_URL_FARM_BUDGET,
  MERISTEM_MALT: process.env.NEXT_PUBLIC_EMBED_URL_MERISTEM_MALT,
  ORG_CERT: process.env.NEXT_PUBLIC_EMBED_URL_ORG_CERT,
  FARM_REGISTRY: process.env.NEXT_PUBLIC_EMBED_URL_FARM_REGISTRY,
  SEED_INVENTORY: process.env.NEXT_PUBLIC_EMBED_URL_SEED_INVENTORY,
}

export function getEmbedUrl(mod: Module): string | null {
  if (mod.type !== 'embed' || !mod.embedKey) return null
  return EMBED_URLS[mod.embedKey] ?? null
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
