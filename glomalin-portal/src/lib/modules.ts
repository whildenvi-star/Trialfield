export interface Module {
  id: string
  label: string
  sublabel: string
  route: string
  status: 'live' | 'coming-soon'
}

export const MODULES: Module[] = [
  {
    id: 'fsa-578',
    label: 'FSA 578',
    sublabel: 'Acreage Reporting',
    route: '/app/fsa-578',
    status: 'live',
  },
  {
    id: 'insurance',
    label: 'Insurance',
    sublabel: 'Crop Insurance Tools',
    route: '/app/insurance',
    status: 'live',
  },
  {
    id: 'claims',
    label: 'Claims',
    sublabel: 'Crop Insurance Claims',
    route: '/app/claims',
    status: 'live',
  },
  {
    id: 'macro-rollup',
    label: 'Macro Rollup',
    sublabel: 'Whole-farm P&L',
    route: '/app/macro-rollup',
    status: 'coming-soon',
  },
  {
    id: 'farm-registry',
    label: 'Farm Registry',
    sublabel: 'Field & Acre Registry',
    route: '/app/farm-registry',
    status: 'coming-soon',
  },
  {
    id: 'org-cert',
    label: 'Organic Cert',
    sublabel: 'NOP Compliance',
    route: '/app/org-cert',
    status: 'coming-soon',
  },
  {
    id: 'inputs-seeds',
    label: 'Inputs & Seeds',
    sublabel: 'Seed & Input Tracking',
    route: '/app/inputs-seeds',
    status: 'coming-soon',
  },
  {
    id: 'fsa-reporting',
    label: 'FSA Reporting',
    sublabel: 'FSA Reporting',
    route: '/app/fsa-reporting',
    status: 'coming-soon',
  },
]
