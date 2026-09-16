import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import {
  fieldViewTokenNeedsRefresh,
  refreshFieldViewTokens,
} from './fieldview'

const NOW = Date.UTC(2026, 8, 16, 12, 0, 0)
const iso = (msFromNow: number) => new Date(NOW + msFromNow).toISOString()

describe('fieldViewTokenNeedsRefresh', () => {
  it('is false for a token with hours left', () => {
    expect(fieldViewTokenNeedsRefresh({ expires_at: iso(4 * 60 * 60 * 1000) }, NOW)).toBe(false)
  })

  it('is true for an already-expired token', () => {
    expect(fieldViewTokenNeedsRefresh({ expires_at: iso(-1000) }, NOW)).toBe(true)
  })

  it('is true inside the 5 minute margin, so a token cannot lapse mid-import', () => {
    expect(fieldViewTokenNeedsRefresh({ expires_at: iso(4 * 60 * 1000) }, NOW)).toBe(true)
  })

  it('is false just outside the margin', () => {
    expect(fieldViewTokenNeedsRefresh({ expires_at: iso(6 * 60 * 1000) }, NOW)).toBe(false)
  })

  it('treats a missing or unparseable expiry as needing refresh', () => {
    expect(fieldViewTokenNeedsRefresh({ expires_at: '' }, NOW)).toBe(true)
    expect(fieldViewTokenNeedsRefresh({ expires_at: 'not-a-date' }, NOW)).toBe(true)
  })
})

describe('refreshFieldViewTokens', () => {
  beforeEach(() => {
    process.env.FIELDVIEW_CLIENT_ID = 'test-client'
    process.env.FIELDVIEW_CLIENT_SECRET = 'test-secret'
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function stubFetch(status: number, body: unknown) {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('sends a refresh_token grant with the client credentials', async () => {
    const fetchMock = stubFetch(200, {
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      expires_in: 14400,
    })

    await refreshFieldViewTokens('old-refresh')

    const [, init] = fetchMock.mock.calls[0]
    const body = new URLSearchParams(init.body as string)
    expect(body.get('grant_type')).toBe('refresh_token')
    expect(body.get('refresh_token')).toBe('old-refresh')
    expect(body.get('client_id')).toBe('test-client')
  })

  it('returns the rotated refresh token when one comes back', async () => {
    stubFetch(200, { access_token: 'a', refresh_token: 'rotated', expires_in: 14400 })
    const out = await refreshFieldViewTokens('old-refresh')
    expect(out.refresh_token).toBe('rotated')
    expect(out.access_token).toBe('a')
  })

  it('carries the old refresh token forward when none is returned', async () => {
    // Dropping it here would break every subsequent refresh.
    stubFetch(200, { access_token: 'a', expires_in: 14400 })
    const out = await refreshFieldViewTokens('old-refresh')
    expect(out.refresh_token).toBe('old-refresh')
  })

  it('computes expires_at from expires_in', async () => {
    stubFetch(200, { access_token: 'a', expires_in: 3600 })
    const out = await refreshFieldViewTokens('r')
    expect(out.expires_at).toBe(new Date(NOW + 3600 * 1000).toISOString())
  })

  it('falls back to a 4 hour lifetime when expires_in is absent', async () => {
    stubFetch(200, { access_token: 'a' })
    const out = await refreshFieldViewTokens('r')
    expect(out.expires_at).toBe(new Date(NOW + 4 * 60 * 60 * 1000).toISOString())
  })

  it('throws on a rejected refresh, so the caller can tell the user to reconnect', async () => {
    stubFetch(401, {})
    await expect(refreshFieldViewTokens('dead')).rejects.toThrow(/401/)
  })

  it('throws when the response carries no access_token', async () => {
    stubFetch(200, { refresh_token: 'r' })
    await expect(refreshFieldViewTokens('r')).rejects.toThrow(/no access_token/)
  })
})
