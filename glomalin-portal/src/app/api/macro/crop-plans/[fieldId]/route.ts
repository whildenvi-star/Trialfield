import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const BUDGET_BASE = 'http://localhost:3001'
const EMBED_TOKEN = process.env.EMBED_TOKEN ?? ''

function budgetFetch(path: string, init?: RequestInit) {
  return fetch(`${BUDGET_BASE}${path}`, {
    signal: AbortSignal.timeout(8000),
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Cookie: `embed_session=${EMBED_TOKEN}`,
      ...init?.headers,
    },
  })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ fieldId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role ?? 'viewer'
  if (!['operator', 'agronomist', 'admin'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { fieldId } = await params

  let body: { crop?: string; seed?: { variety?: string; population?: number }; inputs?: unknown[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // GET current field so we don't clobber financial data
  const getRes = await budgetFetch(`/api/fields/${fieldId}`)
  if (getRes.status === 404) {
    return NextResponse.json({ error: 'Field not found' }, { status: 404 })
  }
  if (!getRes.ok) {
    return NextResponse.json({ error: 'Farm-budget unavailable' }, { status: 502 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const current: any = await getRes.json()

  // Merge only crop-plan fields — financial fields are never touched
  const update = {
    ...current,
    ...(body.crop !== undefined && { crop: body.crop }),
    ...(body.seed !== undefined && {
      seed: {
        ...(current.seed ?? {}),
        ...(body.seed.variety !== undefined && { variety: body.seed.variety }),
        ...(body.seed.population !== undefined && { population: body.seed.population }),
      },
    }),
    ...(body.inputs !== undefined && { inputs: body.inputs }),
  }

  const putRes = await budgetFetch(`/api/fields/${fieldId}`, {
    method: 'PUT',
    body: JSON.stringify(update),
  })

  if (!putRes.ok) {
    return NextResponse.json({ error: 'Failed to update field' }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
