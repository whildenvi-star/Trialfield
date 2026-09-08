export interface Module {
  id: string
  label: string
  sublabel: string
  route: string
  status: 'live' | 'coming-soon'
  type: 'native' | 'embed'
  embedKey?: string
  query?: string
  /** Extra terms the palette matches against — how people actually say it. */
  aliases?: string[]
}

export type GroupIcon = 'field' | 'ops' | 'finance' | 'inputs'

// Same-origin embed paths — Caddy proxies /embed/<app>/* to Express ports.
// This keeps iframes on the portal's origin so they share localStorage
// (theme, text-scale) without cross-origin isolation issues.
// Falls back to NEXT_PUBLIC_EMBED_URL_* env vars for local dev.
const EMBED_PATHS: Record<string, string> = {
  GRAIN_TICKETS: '/embed/grain-tickets/',
  FARM_BUDGET: '/embed/farm-budget/',
  FARM_BUDGET_2027: '/embed/farm-budget-2027/',
  MERISTEM_MALT: '/embed/meristem-malt/',
  ORG_CERT: 'https://cert.whughesfarms.com/',
  FARM_REGISTRY: '/embed/farm-registry/',
  SEED_INVENTORY: '/embed/seed-inventory/',
}

const EMBED_URL_OVERRIDES: Record<string, string | undefined> = {
  GRAIN_TICKETS: process.env.NEXT_PUBLIC_EMBED_URL_GRAIN_TICKETS,
  FARM_BUDGET: process.env.NEXT_PUBLIC_EMBED_URL_FARM_BUDGET,
  FARM_BUDGET_2027: process.env.NEXT_PUBLIC_EMBED_URL_FARM_BUDGET_2027,
  MERISTEM_MALT: process.env.NEXT_PUBLIC_EMBED_URL_MERISTEM_MALT,
  ORG_CERT: process.env.NEXT_PUBLIC_EMBED_URL_ORG_CERT,
  FARM_REGISTRY: process.env.NEXT_PUBLIC_EMBED_URL_FARM_REGISTRY,
  SEED_INVENTORY: process.env.NEXT_PUBLIC_EMBED_URL_SEED_INVENTORY,
}

export function getEmbedUrl(mod: Module): string | null {
  if (mod.type !== 'embed' || !mod.embedKey) return null
  // Use env override (for local dev) or same-origin proxy path (production)
  let base = EMBED_URL_OVERRIDES[mod.embedKey] || EMBED_PATHS[mod.embedKey] || null
  if (!base) return null
  if (mod.query) base += (base.includes('?') ? '&' : '?') + mod.query
  // No credential here: the raw EMBED_TOKEN stays server-side. The module
  // page appends a per-user signed grant instead (see lib/embed-grant.ts).
  return base
}

export const MODULES: Module[] = [
  {
    id: 'crew',
    label: 'Field Operations',
    sublabel: 'Crops · Tasks · Seeds · Inputs',
    route: '/app/crew',
    status: 'live',
    type: 'native',
    aliases: ['crew', 'tasks', 'operators', 'jobs'],
  },
  {
    id: 'maps',
    label: 'Field Map',
    sublabel: 'Polygon Map & Field Detail',
    route: '/app/maps',
    status: 'live',
    type: 'native',
    aliases: ['map', 'boundaries', 'polygons', 'satellite', 'canvas'],
  },
  {
    id: 'weather',
    label: 'Precipitation',
    sublabel: 'Current · History · Forecast',
    route: '/app/weather',
    status: 'live',
    type: 'native',
    aliases: ['rain', 'precip', 'precipitation', 'forecast', 'weather'],
  },
  {
    id: 'compliance',
    label: 'FSA Side',
    sublabel: 'FSA · Insurance · Claims',
    route: '/app/compliance',
    status: 'live',
    type: 'native',
    aliases: ['fsa', 'acreage', 'reporting', '578', 'clu'],
  },
  {
    id: 'field-ops',
    label: 'Field Ops TC Log',
    sublabel: 'TC Sign-off & NOP History',
    route: '/app/field-ops',
    status: 'live',
    type: 'native',
    aliases: ['tc', 'sign-off', 'nop', 'passes', 'applied'],
  },
  {
    id: 'marketing',
    label: 'Grain Marketing',
    sublabel: 'Position & Contracts',
    route: '/app/marketing',
    status: 'live',
    type: 'native',
    aliases: ['contracts', 'basis', 'sales', 'position', 'bushels', 'priced'],
  },
  {
    id: 'field-history',
    label: 'Field History',
    sublabel: 'Crop Rotation & As-Applied',
    route: '/app/field-history',
    status: 'live',
    type: 'native',
    aliases: ['rotation', 'as-applied', 'history', 'farm info'],
  },
  {
    id: 'performance',
    label: 'Farm Performance',
    sublabel: 'Season Overview & Health',
    route: '/app/performance',
    status: 'live',
    type: 'native',
    aliases: ['season', 'health', 'yield', 'overview'],
  },
  {
    id: 'enterprise-summary',
    label: 'Enterprise Summary',
    sublabel: 'Costs & Revenue by Crop',
    route: '/app/enterprise-summary',
    status: 'live',
    type: 'native',
    aliases: ['enterprise', 'costs', 'revenue', 'by crop', 'margin'],
  },
  {
    id: 'field-timeline',
    label: 'Field Timeline',
    sublabel: 'Activity History',
    route: '/app/field-timeline',
    status: 'live',
    type: 'native',
    aliases: ['activity', 'timeline', 'events'],
  },
  {
    id: 'farm-budget',
    label: 'MACRO 2026',
    sublabel: 'Farm & Field Planning',
    route: '/app/farm-budget',
    status: 'live',
    type: 'embed',
    embedKey: 'FARM_BUDGET',
    aliases: ['macro', 'budget', 'planning', 'crop plans', 'p&l', 'enterprise planner'],
  },
  {
    id: 'farm-budget-2027',
    label: 'MACRO 2027',
    sublabel: 'Next-Year Planning',
    route: '/app/farm-budget-2027',
    status: 'live',
    type: 'embed',
    embedKey: 'FARM_BUDGET_2027',
    aliases: ['macro 2027', '2027', 'next year', '2027 plan', 'rotation'],
  },
  {
    id: 'grain-tickets',
    label: 'Grain Tickets',
    sublabel: 'Grain Traceability',
    route: '/app/grain-tickets',
    status: 'live',
    type: 'embed',
    embedKey: 'GRAIN_TICKETS',
    aliases: ['tickets', 'loads', 'hauled', 'scale', 'moisture', 'deliveries'],
  },
  {
    id: 'farm-registry',
    label: 'Farm Registry',
    sublabel: 'Field & Acre Registry',
    route: '/app/farm-registry',
    status: 'live',
    type: 'embed',
    embedKey: 'FARM_REGISTRY',
    aliases: ['registry', 'fields', 'acres', 'source of truth'],
  },
  {
    id: 'org-cert',
    label: 'Organic Cert',
    sublabel: 'NOP Compliance',
    route: '/app/org-cert',
    status: 'live',
    type: 'embed',
    embedKey: 'ORG_CERT',
    aliases: ['organic', 'cert', 'certification', 'nop', 'audit'],
  },
  {
    id: 'meristem-malt',
    label: 'Meristem Malt',
    sublabel: 'Malting Batch Budgets',
    route: '/app/meristem-malt',
    status: 'live',
    type: 'embed',
    embedKey: 'MERISTEM_MALT',
    aliases: ['malt', 'barley', 'batch', 'brewing'],
  },
  {
    id: 'seed-inventory',
    label: 'Input Receiving',
    sublabel: 'Log Deliveries & Track vs. Plan',
    route: '/app/seed-inventory',
    status: 'live',
    type: 'embed',
    embedKey: 'SEED_INVENTORY',
    aliases: ['seed', 'inputs', 'receiving', 'deliveries', 'chemical', 'fertilizer'],
  },
  {
    id: 'reference-data',
    label: 'Reference Data',
    sublabel: 'Products, Seeds, Suppliers & Catalogs',
    route: '/app/reference-data',
    status: 'live',
    type: 'embed',
    embedKey: 'FARM_BUDGET',
    query: 'view=reference',
    aliases: ['products', 'suppliers', 'catalog', 'varieties'],
  },
]

// ─── Navigation grouping ──────────────────────────────────────────────────────
// Single source of truth. SideNav, MobileBottomNav, and the module drawer all
// read this — previously it was hand-duplicated and 'crew' had fallen out of
// every group, making it unreachable from the desktop rail.

export interface ModuleGroup {
  label: string
  icon: GroupIcon
  ids: string[]
}

export const MODULE_GROUPS: ModuleGroup[] = [
  { label: 'Field',      icon: 'field',   ids: ['maps', 'weather', 'field-history', 'field-timeline'] },
  { label: 'Operations', icon: 'ops',     ids: ['crew', 'field-ops', 'compliance', 'org-cert', 'farm-registry'] },
  { label: 'Finance',    icon: 'finance', ids: ['performance', 'enterprise-summary', 'marketing', 'farm-budget', 'farm-budget-2027', 'grain-tickets'] },
  { label: 'Inputs',     icon: 'inputs',  ids: ['seed-inventory', 'reference-data', 'meristem-malt'] },
]

/** Every module id that appears in some group — guards against future drift. */
export const GROUPED_MODULE_IDS = new Set(MODULE_GROUPS.flatMap((g) => g.ids))

/** Modules defined but not placed in any group. Should always be empty. */
export const UNGROUPED_MODULES = MODULES.filter((m) => !GROUPED_MODULE_IDS.has(m.id))

// ─── Secondary pages ──────────────────────────────────────────────────────────
// Real destinations that aren't modules: they're reached from dashboard cards,
// deep links, or from inside another module. They get no rail entry (the rail is
// for the 17 modules) but they are reachable from the command palette, which is
// the difference between "not in the nav" and "unreachable".

export interface PortalPage {
  id: string
  label: string
  sublabel: string
  route: string
  /** Module whose access grant governs this page, if any. */
  requires?: string
  aliases?: string[]
}

// Note: /app/macro and /app/macro-rollup are deliberate redirect stubs that keep
// old deep links alive (→ farm-budget, → marketing). They are not listed here.
export const PAGES: PortalPage[] = [
  { id: 'dashboard',  label: 'Dashboard',    sublabel: 'Summary & action items',      route: '/dashboard',     aliases: ['home', 'start'] },
  { id: 'crop-plans', label: 'Field Passes', sublabel: 'In-field tap-confirm logger', route: '/crop-plans',    aliases: ['log a pass', 'passes', 'phone', 'confirm'] },
  { id: 'fsa-578',    label: 'FSA-578',      sublabel: 'Acreage report & audit',      route: '/app/fsa-578',   requires: 'compliance', aliases: ['578', 'acreage report'] },
  { id: 'insurance',  label: 'Insurance',    sublabel: 'Policies & APH',              route: '/app/insurance', requires: 'compliance', aliases: ['policy', 'aph', 'rma'] },
  { id: 'claims',     label: 'Claims',       sublabel: 'Open & settled claims',       route: '/app/claims',    requires: 'compliance', aliases: ['claim', 'loss', 'adjuster'] },
]

/**
 * Human name for whatever route the user is on. Falls back to the last path
 * segment title-cased, so a new route always shows *something* real rather
 * than a hardcoded placeholder.
 */
export function resolveRouteTitle(pathname: string): string {
  const destinations: { route: string; label: string }[] = [
    ...MODULES.map((m) => ({ route: m.route, label: m.label })),
    ...PAGES.map((p) => ({ route: p.route, label: p.label })),
    { route: '/admin', label: 'User Management' },
  ]

  // Longest matching route wins, so /app/field-history beats a shorter prefix.
  const match = destinations
    .filter((d) => pathname === d.route || pathname.startsWith(d.route + '/'))
    .sort((a, b) => b.route.length - a.route.length)[0]

  if (match) return match.label

  const segment = pathname.split('/').filter(Boolean).pop()
  if (!segment) return 'Glomalin'
  return segment
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
