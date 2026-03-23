import { createClient } from '@/lib/supabase/server'
import { promises as fs } from 'fs'
import path from 'path'

// GET /api/observations/photo/[filename]
// Serves observation photos with auth check and path traversal protection.
export async function GET(
  _request: Request,
  { params }: { params: { filename: string } }
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Sanitize filename to prevent path traversal attacks
  const { filename } = params
  const safe = path.basename(filename)

  const filePath = path.join(process.cwd(), 'uploads', 'observations', safe)

  let buffer: Buffer
  try {
    buffer = await fs.readFile(filePath)
  } catch (err: unknown) {
    const nodeErr = err as NodeJS.ErrnoException
    if (nodeErr.code === 'ENOENT') {
      return new Response('Not Found', { status: 404 })
    }
    return new Response('Internal Server Error', { status: 500 })
  }

  return new Response(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'max-age=86400',
    },
  })
}
