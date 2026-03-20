const EMBED_TOKEN = process.env.EMBED_TOKEN ?? ''
const BUDGET_BASE = 'http://localhost:3001'
const SEED_BASE = 'http://localhost:3006'
const CERT_BASE = 'http://localhost:3004'
const REGISTRY_BASE = 'http://localhost:3005'

const defaultOptions = {
  signal: AbortSignal.timeout(8000),
  next: { revalidate: 0 },
} as RequestInit

/** Fetch from farm-budget service (Express, port 3001). */
export async function fetchBudgetService(path: string): Promise<Response> {
  return fetch(`${BUDGET_BASE}${path}`, {
    ...defaultOptions,
    headers: { Cookie: `embed_session=${EMBED_TOKEN}` },
  })
}

/** Fetch from seed-inventory service (Express, port 3006). */
export async function fetchSeedService(path: string): Promise<Response> {
  return fetch(`${SEED_BASE}${path}`, {
    ...defaultOptions,
    headers: { Cookie: `embed_session=${EMBED_TOKEN}` },
  })
}

/** Fetch from farm-registry service (Express, port 3005). */
export async function fetchRegistryService(path: string): Promise<Response> {
  return fetch(`${REGISTRY_BASE}${path}`, {
    ...defaultOptions,
    headers: { Cookie: `embed_session=${EMBED_TOKEN}` },
  })
}

/** Fetch from organic-cert service (Next.js, port 3004). */
export async function fetchCertService(
  path: string,
  options?: RequestInit
): Promise<Response> {
  return fetch(`${CERT_BASE}${path}`, {
    ...defaultOptions,
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
}
