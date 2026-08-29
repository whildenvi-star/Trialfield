/**
 * Agronomic stage classifier for field-history rows.
 *
 * TypeScript port of farm-budget/public/field-ops-groups.js — the pattern rules
 * are derived from real data.json product/implement names and must stay in sync
 * with that file when new products/implements appear.
 */

export const STAGE_ORDER = [
  'Tillage',
  'Fertility',
  'Planting',
  'Pre-emerge',
  'Post-emerge',
  'Fungicide',
  'Harvest',
  'Other',
] as const

export type Stage = (typeof STAGE_ORDER)[number]

const RULES: { group: Stage; patterns: string[] }[] = [
  {
    group: 'Tillage',
    patterns: ['chisel', 'chisle', 'disk', 'soil finisher', 'cultivat', 'rock pick', 'stalk chop', 'tillage'],
  },
  {
    group: 'Fertility',
    patterns: [
      '0-0-50', '0-0-60', '0-46-0', '10-34-0', '12-0-0', '18-46-0', '21-0-0', '28%', '32%', '46-0-0',
      'potash', 'anhydrous', 'urea', 'ammonia', 'amm thio', ' ams', 'ams ', 'dap', 'sulfur', 's04',
      'chicken litter', 'tulls manure', 'manure', 'compost', 'lime', 'gypsum', 'feathermeal',
      'chilean nitrate', 'boron', 'zinc', 'manganese', 'calcium', 'terafed', 'eco tec',
      'acomplish max', 'accomplish max', 'nitrogen', 'sprayable fertilizer', 'spe-120',
      'bioactive', 'biorepl', 'boost', 'mint casting',
    ],
  },
  {
    group: 'Planting',
    patterns: [
      'planter', 'drill', 'custom no till planting', 'seed treatment application', 'inoculant',
      'ppst', 'rhizoliz', 'exceed', 'kws cc rye', 'red clover', 'rye seed', 'oats', 'planting',
    ],
  },
  {
    group: 'Pre-emerge',
    patterns: [
      'application - liquid ppi', 'application - liquid pre', 'application - burndown',
      'application - vrt', 'application - spinner', 'prowl', 'outlook', 'sharpen', 'sonic',
      'zidua', 'resicore', 'authority', 'verdict', 'forsyte', 'pendimethalin', 'batallion',
      'tine weed', 'hooded redball', 'spinner',
    ],
  },
  {
    group: 'Post-emerge',
    patterns: [
      'application - post', 'liberty', 'basagran', 'buccaneer', 'durango', 'powermax', 'roundup',
      'enlist', 'armezon', 'atrazine', 'status', 'laudis', 'callisto', 'steadfast', 'distinct',
      'mauler', 'cobra', 'huskie', 'flexstar', 'raptor', 'volunteer', 'weed slayer', 'weed zapper',
      'rotary hoe', 'crop oil', 'meth oil', 'nis', 'thunder master',
    ],
  },
  {
    group: 'Fungicide',
    patterns: ['miravis', 'palisade', 'headline', 'veltyma', 'strobilurin', 'fungicide', 'tebuconazole', 'propiconazole'],
  },
  {
    group: 'Harvest',
    patterns: ['combine', 'buggy', 'grain cart', 'ear picker', 'trucking', 'truck', 'chop', 'haul', 'dump cart', 'harvest'],
  },
]

/** Classify a product or implement name into an agronomic stage. Never returns null. */
export function classifyStage(name: string | null | undefined): Stage {
  if (!name) return 'Other'
  const lower = name.toLowerCase()
  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      if (lower.includes(pattern)) return rule.group
    }
  }
  return 'Other'
}
