export interface Module {
  id: string
  label: string
  sublabel: string
  route: string
}

export const MODULES: Module[] = [
  {
    id: 'macro-rollup',
    label: 'Macro Rollup',
    sublabel: 'Whole-farm P&L',
    route: '/app/macro-rollup',
  },
  {
    id: 'farm-registry',
    label: 'Farm Registry',
    sublabel: 'Field & Acre Registry',
    route: '/app/farm-registry',
  },
  {
    id: 'org-cert',
    label: 'Organic Cert',
    sublabel: 'NOP Compliance',
    route: '/app/org-cert',
  },
  {
    id: 'inputs-seeds',
    label: 'Inputs & Seeds',
    sublabel: 'Seed & Input Tracking',
    route: '/app/inputs-seeds',
  },
  {
    id: 'fsa-reporting',
    label: 'FSA Reporting',
    sublabel: 'FSA Reporting',
    route: '/app/fsa-reporting',
  },
]
