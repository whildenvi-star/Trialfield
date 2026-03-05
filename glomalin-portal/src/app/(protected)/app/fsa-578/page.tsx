import { createClient } from '@/lib/supabase/server'
import { CluWorkspace } from '@/components/fsa/clu-workspace'
import type { CluRecord } from '@/lib/fsa/calc'

export default async function FsaPage() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('clu_records')
    .select('*')
    .eq('crop_year', 2026)
    .order('farm_number')
    .order('tract_number')
    .order('clu')

  const records: CluRecord[] = (data as CluRecord[]) ?? []

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <CluWorkspace
        initialRecords={records}
        loadError={error?.message ?? null}
      />
    </div>
  )
}
