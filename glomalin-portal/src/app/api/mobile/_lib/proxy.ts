function getBase() {
  return {
    embedToken: process.env.EMBED_TOKEN ?? '',
    budget:   process.env.BUDGET_SERVICE_URL   ?? 'http://127.0.0.1:3001',
    seed:     process.env.SEED_SERVICE_URL     ?? 'http://127.0.0.1:3006',
    cert:     process.env.CERT_SERVICE_URL     ?? 'http://127.0.0.1:3004',
    registry: process.env.REGISTRY_SERVICE_URL ?? 'http://127.0.0.1:3005',
    gt:       process.env.GT_SERVICE_URL       ?? 'http://127.0.0.1:3007',
  }
}

/** Fetch from farm-budget service (Express, port 3001). */
export async function fetchBudgetService(path: string): Promise<Response> {
  const { budget, embedToken } = getBase()
  return fetch(`${budget}${path}`, {
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 0 },
    headers: { Cookie: `embed_session=${embedToken}` },
  } as RequestInit)
}

/** Fetch from seed-inventory service (Express, port 3006). */
export async function fetchSeedService(path: string): Promise<Response> {
  const { seed, embedToken } = getBase()
  return fetch(`${seed}${path}`, {
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 0 },
    headers: { Cookie: `embed_session=${embedToken}` },
  } as RequestInit)
}

/** Fetch from farm-registry service (Express, port 3005). */
export async function fetchRegistryService(path: string): Promise<Response> {
  const { registry, embedToken } = getBase()
  return fetch(`${registry}${path}`, {
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 0 },
    headers: { Cookie: `embed_session=${embedToken}` },
  } as RequestInit)
}

/** Fetch from grain-tickets service (Express, port 3007). */
export async function fetchGrainService(path: string): Promise<Response> {
  const { gt, embedToken } = getBase()
  return fetch(`${gt}${path}`, {
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 0 },
    headers: { Cookie: `embed_session=${embedToken}` },
  } as RequestInit)
}

/** Fetch from organic-cert service (Next.js, port 3004). */
export async function fetchCertService(
  path: string,
  options?: RequestInit
): Promise<Response> {
  const { cert } = getBase()
  return fetch(`${cert}${path}`, {
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 0 },
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  } as RequestInit)
}

/**
 * Fetch from organic-cert service with Supabase Bearer token forwarding.
 * Required for marketing routes that call getMarketingAuthContext().
 */
export async function fetchCertServiceWithAuth(
  path: string,
  accessToken: string,
  options?: RequestInit
): Promise<Response> {
  const { cert } = getBase()
  return fetch(`${cert}${path}`, {
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 0 },
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      ...options?.headers,
    },
  } as RequestInit)
}
