const buFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const usdFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const usdCentsFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pctFormatter = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 })
const acresFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })

/** Format bushels: 12,345 */
export function formatBu(n: number): string {
  return buFormatter.format(n)
}

/** Format whole-dollar amounts: $12,345 */
export function formatUsd(n: number): string {
  return usdFormatter.format(n)
}

/** Format dollar amounts with cents: $4.52 */
export function formatUsdCents(n: number): string {
  return usdCentsFormatter.format(n)
}

/** Format as percentage from a fraction (0.85 → 85.0%): pass pre-divided value */
export function formatPct(n: number): string {
  return pctFormatter.format(n)
}

/** Format basis in cents/bu: +12¢ or -8¢ */
export function formatBasis(n: number): string {
  const sign = n > 0 ? '+' : ''
  return `${sign}${Math.round(n * 100)}¢`
}

/** Format acres: 1,234.5 */
export function formatAcres(n: number): string {
  return acresFormatter.format(n)
}

/** Format a price per bushel: $4.52/bu */
export function formatPricePerBu(n: number): string {
  return `${usdCentsFormatter.format(n)}/bu`
}
