'use client'

// Variety rows inside a crop pool card. Each variety expands to a drilldown of
// the contracts written against it — contract number, buyer, bushels, and the
// price legs (futures / basis / cash). Contract numbers are not a schema column:
// imports tag them into `notes` as "Buyer #NUMBER", so we parse them back out
// and fall back to a short id when a contract was hand-entered without one.
//
// Clicking a contract row deep-links to the contract list's edit drawer
// (?edit=<id>, handled by ContractListClient on mount) — the drilldown is where
// you eyeball the numbers, the drawer is where you fix what's wrong.

import { Fragment, useState } from 'react'
import { formatBu, formatBasis, formatPricePerBu } from '@/lib/fmt'
import type { PoolCardContract, Instrument } from './crop-pool-cards'

const EM = '—'

const INSTRUMENT_SHORT: Record<Instrument, string> = {
  PRICED: 'PRICED',
  SPOT: 'SPOT',
  FOB: 'FOB',
  PRICED_LATER: 'PTF',
  BASIS_FIXED: 'BASIS',
  FUTURES_FIXED: 'HTA',
  MIN_PRICE: 'MIN',
  ACCUMULATOR: 'ACCUM',
}

export interface VariantRowData {
  variantName: string
  projectedBu?: number | null
  soldBu: number
  premiumPerBu?: number | null
  pooledPriceCents?: number | null
}

/** "DeLong #F302915 (Active Contracts Report 04/27/26)" -> "F302915" */
export function contractNumber(c: PoolCardContract): string {
  const tagged = c.notes?.match(/#\s*([A-Za-z0-9][A-Za-z0-9._/-]*)/)
  if (tagged) return tagged[1]
  return c.id ? c.id.slice(-6).toUpperCase() : EM
}

/** Stored final price, else futures + basis once both legs are known. */
function cashPrice(c: PoolCardContract): number | null {
  if (c.finalCashPrice != null) return c.finalCashPrice
  if (c.futuresPrice != null && c.basis != null) return c.futuresPrice + c.basis
  return null
}

/**
 * ContractListClient reads ?edit=<id> on mount, opens the edit drawer for that
 * contract, and strips the param so a refresh doesn't reopen it. Navigated as a
 * full page load (not router.push) so the param is on the URL before that
 * mount-time effect reads window.location.search — same as the dashboard's
 * ?new=1 CTA.
 */
function editHref(id: string): string {
  return `/app/marketing/contracts?edit=${encodeURIComponent(id)}`
}

function shortDate(iso?: string | null): string {
  if (!iso) return EM
  const d = new Date(iso)
  if (isNaN(d.getTime())) return EM
  return `${d.getUTCMonth() + 1}/${String(d.getUTCDate()).padStart(2, '0')}`
}

export function VariantContractRows({
  variants,
  contractsByVariant,
  isOwner,
}: {
  variants: VariantRowData[]
  /** lowercased variant name -> contracts written against it */
  contractsByVariant: Record<string, PoolCardContract[]>
  isOwner: boolean
}) {
  const [open, setOpen] = useState<string | null>(null)
  const cols = isOwner ? 5 : 3

  return (
    <tbody>
      {variants.map((v) => {
        const key = v.variantName.toLowerCase()
        const rows = contractsByVariant[key] ?? []
        const isOpen = open === v.variantName
        const hasContracts = rows.length > 0

        return (
          <Fragment key={v.variantName}>
            <tr className="border-b border-glomalin-border/30 last:border-0">
              <td className="py-1 text-glomalin-text">
                {hasContracts ? (
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : v.variantName)}
                    aria-expanded={isOpen}
                    className="flex items-center gap-1 text-left hover:text-glomalin-accent transition-colors"
                    title={`${rows.length} contract${rows.length === 1 ? '' : 's'}`}
                  >
                    <span
                      className={`text-glomalin-muted transition-transform ${isOpen ? 'rotate-90' : ''}`}
                      aria-hidden="true"
                    >
                      ▸
                    </span>
                    {v.variantName}
                    <span className="text-glomalin-muted/70">({rows.length})</span>
                  </button>
                ) : (
                  <span className="pl-[13px]">{v.variantName}</span>
                )}
              </td>
              <td className="py-1 text-right tabular-nums text-glomalin-muted">
                {v.projectedBu != null ? formatBu(Math.round(v.projectedBu)) : EM}
              </td>
              <td className="py-1 text-right tabular-nums text-glomalin-text">
                {formatBu(v.soldBu)}
              </td>
              {isOwner && (
                <>
                  <td
                    className={`py-1 text-right tabular-nums ${
                      (v.premiumPerBu ?? 0) >= 0
                        ? 'text-glomalin-success'
                        : 'text-glomalin-warning'
                    }`}
                  >
                    {v.premiumPerBu != null && v.premiumPerBu !== 0
                      ? `${v.premiumPerBu > 0 ? '+' : ''}${formatPricePerBu(v.premiumPerBu)}`
                      : EM}
                  </td>
                  <td className="py-1 text-right tabular-nums text-glomalin-accent-light">
                    {v.pooledPriceCents != null
                      ? formatPricePerBu(v.pooledPriceCents / 100)
                      : EM}
                  </td>
                </>
              )}
            </tr>

            {isOpen && (
              <tr className="border-b border-glomalin-border/30">
                <td colSpan={cols} className="py-1.5 pl-3 pr-0">
                  <table className="w-full text-[10px] font-mono">
                    <thead>
                      <tr className="text-glomalin-muted/80 border-b border-glomalin-border/40">
                        <th className="text-left py-0.5 font-medium uppercase tracking-wider">
                          Contract
                        </th>
                        <th className="text-left py-0.5 font-medium uppercase tracking-wider">
                          Buyer
                        </th>
                        <th className="text-right py-0.5 font-medium uppercase tracking-wider">
                          Bushels
                        </th>
                        {isOwner && (
                          <>
                            <th className="text-right py-0.5 font-medium uppercase tracking-wider">
                              Futures
                            </th>
                            <th className="text-right py-0.5 font-medium uppercase tracking-wider">
                              Basis
                            </th>
                            <th className="text-right py-0.5 font-medium uppercase tracking-wider">
                              Cash
                            </th>
                          </>
                        )}
                        <th className="text-right py-0.5 font-medium uppercase tracking-wider">
                          Delivery
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((c) => {
                        const cash = cashPrice(c)
                        return (
                          <tr
                            key={c.id ?? contractNumber(c)}
                            onClick={() => { if (c.id) window.location.href = editHref(c.id) }}
                            title={c.id ? `Edit contract ${contractNumber(c)}` : undefined}
                            className={`border-b border-glomalin-border/20 last:border-0 ${
                              c.id
                                ? 'cursor-pointer hover:bg-glomalin-elevated/50 transition-colors'
                                : ''
                            }`}
                          >
                            <td className="py-0.5 text-glomalin-bright whitespace-nowrap">
                              {/* Real anchor so the row is keyboard-reachable and
                                  middle-click opens the drawer in a new tab. */}
                              <a
                                href={c.id ? editHref(c.id) : undefined}
                                onClick={(e) => e.stopPropagation()}
                                className="hover:text-glomalin-accent transition-colors"
                              >
                                {contractNumber(c)}
                              </a>
                              <span className="ml-1.5 text-glomalin-muted/70">
                                {INSTRUMENT_SHORT[c.instrument]}
                              </span>
                            </td>
                            <td className="py-0.5 text-glomalin-muted truncate">
                              {c.customer?.shortCode ?? c.customer?.name ?? EM}
                            </td>
                            <td className="py-0.5 text-right tabular-nums text-glomalin-text">
                              {c.buyerTakesAll ? 'take-all' : formatBu(c.contractedBushels)}
                            </td>
                            {isOwner && (
                              <>
                                <td className="py-0.5 text-right tabular-nums text-glomalin-muted">
                                  {c.futuresPrice != null
                                    ? formatPricePerBu(c.futuresPrice)
                                    : EM}
                                </td>
                                <td
                                  className={`py-0.5 text-right tabular-nums ${
                                    c.basis == null
                                      ? 'text-glomalin-warning'
                                      : c.basis >= 0
                                        ? 'text-glomalin-success'
                                        : 'text-glomalin-muted'
                                  }`}
                                >
                                  {c.basis != null ? formatBasis(c.basis) : 'open'}
                                </td>
                                <td className="py-0.5 text-right tabular-nums text-glomalin-accent-light">
                                  {cash != null ? formatPricePerBu(cash) : EM}
                                </td>
                              </>
                            )}
                            <td className="py-0.5 text-right tabular-nums text-glomalin-muted/70 whitespace-nowrap">
                              {shortDate(c.deliveryStart)}–{shortDate(c.deliveryEnd)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </td>
              </tr>
            )}
          </Fragment>
        )
      })}
    </tbody>
  )
}
