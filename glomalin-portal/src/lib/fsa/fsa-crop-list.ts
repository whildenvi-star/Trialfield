// FSA land-use categories that are NOT crops in the registry.
// These are retained as a local constant and merged at point of use.
// Registry stores only plantable crops (corn, soybeans, wheat, etc.) — not land-use codes.
export const FSA_LAND_USE_CATEGORIES: string[] = [
  'Cover Crop',
  'CRP',
  'Fallow',
  'Idle',
]

/**
 * Fetch the canonical crop list from farm-registry via the portal proxy.
 * Returns crop names formatted for FSA display — organic crops are prefixed with "Organic ".
 *
 * No local fallback — if farm-registry is down, this throws and callers should show an error.
 */
export async function fetchCropList(): Promise<string[]> {
  const res = await fetch('/api/registry/crops-autocomplete')
  if (!res.ok) throw new Error('Failed to fetch crop list from registry')
  const crops = await res.json() as { id: string; name: string; organic: boolean }[]
  return crops
    .map((c) => (c.organic ? `Organic ${c.name}` : c.name))
    .sort()
}

/**
 * Fetch the canonical crop list merged with FSA land-use categories.
 * Suitable for CLU crop fields where both crop and land-use options are needed.
 */
export async function fetchCropListWithLandUse(): Promise<string[]> {
  const crops = await fetchCropList()
  const all = Array.from(new Set([...crops, ...FSA_LAND_USE_CATEGORIES])).sort()
  return all
}
