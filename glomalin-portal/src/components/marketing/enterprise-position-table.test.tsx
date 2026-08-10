// Run: npx vitest run src/components/marketing/enterprise-position-table.test.tsx
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { EnterprisePositionTable } from './enterprise-position-table'
import type { OfficeCommodityRollupRow } from '../../lib/marketing/enterprise-rollup'
import type { EnterpriseDataNotes } from '../../lib/marketing/load-enterprise-data'

afterEach(cleanup)

const ROW: OfficeCommodityRollupRow = {
  commodityName: 'Corn',
  cropYear: 2026,
  cbotSymbol: 'C',
  acres: 500,
  projYieldPerAcre: 200,
  projectedBu: 100000,
  actualBu: null,
  soldBu: 40000,
  pricedBu: 40000,
  pctSold: 0.4,
  overhedged: false,
  variants: [],
} as unknown as OfficeCommodityRollupRow

function notes(overrides: Partial<EnterpriseDataNotes> = {}): EnterpriseDataNotes {
  return {
    budgetAvailable: true,
    ticketsAvailable: true,
    cbotAvailable: false,
    excludedTickets: null,
    excludedTicketDetails: null,
    ...overrides,
  }
}

function renderTable(n: EnterpriseDataNotes) {
  return render(
    <EnterprisePositionTable rows={[ROW]} isOwner={false} cropYear={2026} notes={n} />
  )
}

describe('EnterprisePositionTable excluded-tickets warning', () => {
  it('renders no warning when there are no excluded tickets', () => {
    renderTable(notes({ excludedTickets: { noFieldId: 0, noCropId: 0 } }))
    expect(screen.queryByText(/excluded from actuals/)).toBeNull()
  })

  it('uses singular copy for one ticket and links to grain-tickets when details are absent', () => {
    renderTable(notes({ excludedTickets: { noFieldId: 0, noCropId: 1 } }))
    const link = screen.getByText('1 scale ticket missing registry IDs excluded from actuals')
    expect(link.tagName).toBe('A')
    expect(link.getAttribute('href')).toBe('/app/grain-tickets')
  })

  it('uses plural copy for multiple tickets', () => {
    renderTable(notes({ excludedTickets: { noFieldId: 1, noCropId: 1 } }))
    expect(
      screen.getByText('2 scale tickets missing registry IDs excluded from actuals')
    ).toBeTruthy()
  })

  it('expands to per-ticket detail rows with reason text and a grain-tickets link', () => {
    renderTable(
      notes({
        excludedTickets: { noFieldId: 0, noCropId: 1 },
        excludedTicketDetails: [
          {
            id: 42,
            farm: 'Home Farm',
            crop: 'Organic Seed Wheat',
            date: '2026-07-15T00:00:00.000Z',
            reason: 'noCropId',
          },
        ],
      })
    )
    const toggle = screen.getByText(/1 scale ticket missing registry IDs/)
    fireEvent.click(toggle)
    expect(screen.getByText('#42')).toBeTruthy()
    expect(screen.getByText(/crop not linked to a registry crop/)).toBeTruthy()
    const link = screen.getByText('open Grain Tickets')
    expect(link.getAttribute('href')).toBe('/app/grain-tickets')
  })

  it('shows a truncation note when details cover fewer tickets than the count', () => {
    renderTable(
      notes({
        excludedTickets: { noFieldId: 3, noCropId: 0 },
        excludedTicketDetails: [
          { id: 1, farm: 'A', crop: 'Corn', date: '2026-07-01', reason: 'noFieldId' },
        ],
      })
    )
    fireEvent.click(screen.getByText(/3 scale tickets missing registry IDs/))
    expect(screen.getByText('…and 2 more')).toBeTruthy()
  })
})
