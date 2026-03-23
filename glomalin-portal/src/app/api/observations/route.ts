import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'

// POST /api/observations
// Accepts JSON { note } for text-only or FormData { note, photo } for text + photo.
// Inserts a row into field_observations and optionally saves photo to disk.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let note: string | undefined
  let photoPath: string | undefined

  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
    }

    note = formData.get('note') as string | undefined
    const photo = formData.get('photo') as File | null

    if (photo && photo.size > 0) {
      const uploadsDir = path.join(process.cwd(), 'uploads', 'observations')
      await fs.mkdir(uploadsDir, { recursive: true })

      const filename = `obs-${Date.now()}-${crypto.randomUUID()}.jpg`
      const buffer = Buffer.from(await photo.arrayBuffer())
      await fs.writeFile(path.join(uploadsDir, filename), buffer)
      photoPath = filename
    }
  } else {
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    note = body.note as string | undefined
  }

  if (!note || typeof note !== 'string' || !note.trim()) {
    return NextResponse.json({ error: 'note is required' }, { status: 400 })
  }

  const { data: observation, error: insertError } = await supabase
    .from('field_observations')
    .insert({
      submitted_by: user.id,
      note: note.trim(),
      photo_path: photoPath ?? null,
    })
    .select()
    .single()

  if (insertError || !observation) {
    return NextResponse.json(
      { error: 'Failed to save observation', details: insertError?.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ observation }, { status: 201 })
}

// GET /api/observations
// Returns the current user's observations ordered by date descending.
export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('field_observations')
    .select('*')
    .eq('submitted_by', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch observations', details: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ observations: data ?? [] })
}
