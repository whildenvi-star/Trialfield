'use client'

import { Suspense } from 'react'
import { SectionHeader } from '@/components/ui/section-header'
import { YearSelector } from '@/components/ui/year-selector'
import type { CrewEnterprise, CertOperation, CertSeedUsage, CertMaterialUsage } from './page'

const OP_TYPE_LABELS: Record<string, string> = {
  TILLAGE: 'Tillage',
  PLANTING: 'Planting',
  CULTIVATION: 'Cultivation',
  MOWING: 'Mowing',
  IRRIGATION: 'Irrigation',
  FLAMING: 'Flaming',
  HARVEST: 'Harvest',
  SPRAYING: 'Spraying',
  OTHER: 'Other',
}

const ORGANIC_BADGES: Record<string, { label: string; className: string }> = {
  ORGANIC:      { label: 'ORG',  className: 'text-glomalin-green border-glomalin-green/40' },
  TRANSITIONAL: { label: 'TRAN', className: 'text-amber-400 border-amber-400/40' },
  CONVENTIONAL: { label: 'CONV', className: 'text-glomalin-muted border-glomalin-border' },
  SPLIT:        { label: 'SPLIT', className: 'text-glomalin-muted border-glomalin-border' },
}

function fmt(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function EmptyRow({ label }: { label: string }) {
  return (
    <p className="text-glomalin-muted font-mono text-xs py-3 px-1">{label}</p>
  )
}

function OrganicBadge({ status }: { status: string }) {
  const badge = ORGANIC_BADGES[status] ?? ORGANIC_BADGES.CONVENTIONAL
  return (
    <span className={`text-[10px] font-mono border rounded px-1 py-0.5 ${badge.className}`}>
      {badge.label}
    </span>
  )
}

function CropsSection({ enterprises }: { enterprises: CrewEnterprise[] }) {
  return (
    <section>
      <SectionHeader title={`Crops & Acres (${enterprises.length})`} />
      {enterprises.length === 0 ? (
        <EmptyRow label="No fields on record for this year" />
      ) : (
        <div className="divide-y divide-glomalin-border border border-glomalin-border rounded">
          {enterprises.map((e) => (
            <div key={e.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-glomalin-text truncate font-medium">
                    {e.field.name}
                  </span>
                  {e.label && (
                    <span className="text-[10px] font-mono text-glomalin-muted border border-glomalin-border rounded px-1 shrink-0">
                      {e.label}
                    </span>
                  )}
                  <OrganicBadge status={e.organicStatus} />
                </div>
                <div className="font-mono text-xs text-glomalin-muted mt-0.5">
                  {e.crop}{e.variety ? ` · ${e.variety}` : ''}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono text-sm text-glomalin-text">{e.plantedAcres.toFixed(1)}</div>
                <div className="font-mono text-[10px] text-glomalin-muted">ac planted</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function OperationRow({ op, fieldName }: { op: CertOperation; fieldName: string }) {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5">
      <div className="flex-1 min-w-0">
        <div className="font-mono text-sm text-glomalin-text">
          {OP_TYPE_LABELS[op.type] ?? op.type}
        </div>
        <div className="font-mono text-xs text-glomalin-muted mt-0.5">
          {fieldName}
          {op.acresWorked != null && ` · ${op.acresWorked.toFixed(1)} ac`}
          {op.operator && ` · ${op.operator.name}`}
        </div>
        {op.notes && (
          <div className="font-mono text-xs text-glomalin-muted/70 mt-0.5 truncate">{op.notes}</div>
        )}
      </div>
      <div className="text-right shrink-0 font-mono text-xs text-glomalin-muted">
        {fmt(op.operationDate)}
      </div>
    </div>
  )
}

function TasksSection({
  enterprises,
  passStatus,
}: {
  enterprises: CrewEnterprise[]
  passStatus: 'planned' | 'completed'
}) {
  const items: Array<{ op: CertOperation; fieldName: string }> = enterprises.flatMap((e) =>
    e.operations[passStatus].map((op) => ({ op, fieldName: e.field.name }))
  )

  const label = passStatus === 'planned' ? 'Planned' : 'Completed'

  return (
    <section>
      <SectionHeader
        title={`${label} (${items.length})`}
        description={passStatus === 'planned' ? 'Scheduled operations' : 'Confirmed operations'}
      />
      {items.length === 0 ? (
        <EmptyRow label={`No ${label.toLowerCase()} operations on record`} />
      ) : (
        <div className={`divide-y divide-glomalin-border border rounded border-glomalin-border`}>
          <div className={`h-0.5 rounded-t ${passStatus === 'planned' ? 'bg-amber-400/30' : 'bg-glomalin-green/30'}`} />
          {items.map(({ op, fieldName }) => (
            <OperationRow key={op.id} op={op} fieldName={fieldName} />
          ))}
        </div>
      )}
    </section>
  )
}

function SeedsSection({ enterprises }: { enterprises: CrewEnterprise[] }) {
  const items: Array<{ seed: CertSeedUsage; fieldName: string; crop: string }> =
    enterprises.flatMap((e) =>
      e.seeds.map((s) => ({ seed: s, fieldName: e.field.name, crop: e.crop }))
    )

  return (
    <section>
      <SectionHeader title={`Seeds (${items.length})`} />
      {items.length === 0 ? (
        <EmptyRow label="No seed records on file" />
      ) : (
        <div className="divide-y divide-glomalin-border border border-glomalin-border rounded">
          {items.map(({ seed, fieldName }) => (
            <div key={seed.id} className="flex items-start gap-3 px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <div className="font-mono text-sm text-glomalin-text">
                  {seed.seedLot.variety}
                  {seed.seedLot.brand && (
                    <span className="text-glomalin-muted"> · {seed.seedLot.brand}</span>
                  )}
                </div>
                <div className="font-mono text-xs text-glomalin-muted mt-0.5">
                  {fieldName} · {seed.acres.toFixed(1)} ac
                  {seed.seedLot.isOrganic && (
                    <span className="ml-1 text-glomalin-green">· Org</span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono text-xs text-glomalin-text">
                  {seed.rate} {seed.rateUnit}
                </div>
                <div className="font-mono text-[10px] text-glomalin-muted">{fmt(seed.plantingDate)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function InputsSection({ enterprises }: { enterprises: CrewEnterprise[] }) {
  const items: Array<{ input: CertMaterialUsage; fieldName: string }> =
    enterprises.flatMap((e) =>
      e.inputs.map((i) => ({ input: i, fieldName: e.field.name }))
    )

  return (
    <section>
      <SectionHeader title={`Inputs (${items.length})`} />
      {items.length === 0 ? (
        <EmptyRow label="No input applications on file" />
      ) : (
        <div className="divide-y divide-glomalin-border border border-glomalin-border rounded">
          {items.map(({ input, fieldName }) => (
            <div key={input.id} className="flex items-start gap-3 px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <div className="font-mono text-sm text-glomalin-text">{input.material.name}</div>
                <div className="font-mono text-xs text-glomalin-muted mt-0.5">
                  {fieldName} · {input.acres.toFixed(1)} ac
                  {input.applicator && ` · ${input.applicator}`}
                </div>
                {input.notes && (
                  <div className="font-mono text-xs text-glomalin-muted/70 mt-0.5 truncate">
                    {input.notes}
                  </div>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono text-xs text-glomalin-text">
                  {input.rate} {input.rateUnit}
                </div>
                <div className="font-mono text-[10px] text-glomalin-muted">
                  {fmt(input.applicationDate)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

interface CrewDashboardClientProps {
  year: number
  enterprises: CrewEnterprise[]
  userName: string
}

export function CrewDashboardClient({ year, enterprises, userName }: CrewDashboardClientProps) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-base font-semibold text-glomalin-text tracking-wide uppercase">
            Field Operations
          </h1>
          {userName && (
            <p className="font-mono text-xs text-glomalin-muted mt-0.5">{userName}</p>
          )}
        </div>
        <Suspense>
          <YearSelector currentYear={year} />
        </Suspense>
      </div>

      <CropsSection enterprises={enterprises} />
      <TasksSection enterprises={enterprises} passStatus="planned" />
      <TasksSection enterprises={enterprises} passStatus="completed" />
      <SeedsSection enterprises={enterprises} />
      <InputsSection enterprises={enterprises} />
    </div>
  )
}
