'use client'

import { useState, useEffect } from 'react'
import { BottomSheet } from '@/components/canvas/bottom-sheet'

export interface FieldProperties {
  registry_field_id: string
  name: string
  crop: string | null
  organic: boolean
  reportingAcres: number
  centroid_lat: number | null
  centroid_lng: number | null
  fsa_reported: boolean | null
  last_7d_in:  number | null
  last_30d_in: number | null
}

interface ScorecardData {
  fieldId: string
  fsaAcres: number | null
  polygonAcres: number | null
  aph: Array<{ crop_year: number; actual_yield: number; is_disaster_year: boolean }>
  priced_bu: number | null
  estimated_bu: number | null
  open_claims: number
  recent_observations: number
}

interface FieldDetailPanelProps {
  field: FieldProperties | null
  onClose: () => void
  /**
   * 'panel' docks to the right edge (desktop); 'sheet' presents the same
   * content in a draggable bottom sheet (mobile), where a right-docked panel
   * would cover the map entirely. Same content, two presentations — the sheet
   * supplies its own title row, so the inline header is dropped there.
   */
  variant?: 'panel' | 'sheet'
  /** Space below the sheet, e.g. the 56px mobile tab bar. */
  sheetBottomOffset?: number
}

/**
 * FieldDetailPanel — slide-in right panel showing field details.
 *
 * Content per CONTEXT.md spec (keep it tight):
 *   - Field name (large mono, accent color)
 *   - Crop badge or "No crop assigned"
 *   - Organic badge if organic=true
 *   - Reporting Acres
 *   - Organic Status (Certified / Conventional)
 *   - "View Field Activity Timeline →" link (future page, not yet built)
 *
 * No weather data, no GDD, no Open-Meteo fetch — intentionally minimal.
 *
 * Panel slides in from the right when field !== null.
 * Click-outside overlay (z-10) sits behind the panel (z-20) to catch outside clicks.
 *
 * Scorecard section is appended below the rainfall divider — fetched on field selection,
 * all data is best-effort (partial results render, sections are omitted when null).
 */
export function FieldDetailPanel({
  field,
  onClose,
  variant = 'panel',
  sheetBottomOffset = 0,
}: FieldDetailPanelProps) {
  const isOpen = field !== null

  const [scorecard, setScorecard] = useState<ScorecardData | null>(null)
  const [scorecardLoading, setScorecardLoading] = useState(false)

  useEffect(() => {
    if (!field) { setScorecard(null); return }
    setScorecardLoading(true)
    fetch(`/api/maps/field-scorecard?fieldId=${encodeURIComponent(field.registry_field_id)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setScorecard(d))
      .catch(() => {})
      .finally(() => setScorecardLoading(false))
  }, [field?.registry_field_id])

  // Acreage mismatch: compare FSA acres to reporting acres (panel prop)
  const showAcreageCheck =
    scorecard !== null &&
    scorecard.fsaAcres !== null &&
    field !== null &&
    field.reportingAcres > 0
  const acreageDelta =
    showAcreageCheck && scorecard && field
      ? Math.abs((scorecard.fsaAcres! - field.reportingAcres) / field.reportingAcres)
      : 0
  const acreageMismatch = acreageDelta > 0.01

  // Marketing %
  const marketingPct =
    scorecard?.estimated_bu && scorecard.estimated_bu > 0 && scorecard.priced_bu !== null
      ? Math.min(100, (scorecard.priced_bu / scorecard.estimated_bu) * 100)
      : null

  const showScorecard =
    scorecard !== null &&
    (showAcreageCheck ||
      (scorecard.aph && scorecard.aph.length > 0) ||
      (scorecard.estimated_bu !== null && scorecard.estimated_bu > 0) ||
      scorecard.open_claims > 0 ||
      scorecard.recent_observations > 0)

  const isSheet = variant === 'sheet'

  const body = field ? (
    <div className={isSheet ? 'pb-2' : 'flex flex-col h-full p-5 overflow-y-auto'}>
      {/* Header row — the sheet supplies its own title, so skip it there */}
      {!isSheet && (
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 className="text-glomalin-canvas-accent font-mono text-lg font-semibold leading-snug">
            {field.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 text-glomalin-canvas-muted hover:text-glomalin-canvas-text transition-colors mt-0.5"
            aria-label="Close panel"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

            {/* Crop + organic badges */}
            <div className="flex flex-wrap gap-2 mb-5">
              {field.crop ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-glomalin-canvas-elevated border border-glomalin-canvas-border text-glomalin-canvas-text">
                  {field.crop}
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-glomalin-canvas-elevated border border-glomalin-canvas-border text-glomalin-canvas-muted">
                  No crop assigned
                </span>
              )}
              {field.organic && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-[#0d1a0e] border border-[#7A9E7E] text-[#7A9E7E]">
                  Organic
                </span>
              )}
            </div>

            {/* Details table */}
            <div className="space-y-3 font-mono text-sm">
              <div className="flex justify-between">
                <span className="text-glomalin-canvas-muted">Reporting Acres</span>
                <span className="text-glomalin-canvas-text">
                  {field.reportingAcres > 0
                    ? `${field.reportingAcres.toFixed(1)} ac`
                    : '— ac'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-glomalin-canvas-muted">Organic Status</span>
                <span className={field.organic ? 'text-[#7A9E7E]' : 'text-glomalin-canvas-text'}>
                  {field.organic ? 'Certified' : 'Conventional'}
                </span>
              </div>
              {field.fsa_reported !== null && (
                <div className="flex justify-between">
                  <span className="text-glomalin-canvas-muted">FSA 578</span>
                  <span className={field.fsa_reported ? 'text-[#7A9E7E]' : 'text-glomalin-canvas-accent'}>
                    {field.fsa_reported ? '● Reported' : '○ Not reported'}
                  </span>
                </div>
              )}
            </div>

            {/* Rainfall — only shown when precip data is available */}
            {field.last_7d_in != null && (
              <>
                <div className="my-5 border-t border-glomalin-canvas-border" />
                <div className="space-y-1 mb-1">
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-glomalin-canvas-muted">
                    Rainfall
                  </span>
                </div>
                <div className="space-y-3 font-mono text-sm">
                  <div className="flex justify-between">
                    <span className="text-glomalin-canvas-muted">Last 7 days</span>
                    <span className="text-[#7BAFD4]">{field.last_7d_in.toFixed(2)}&Prime;</span>
                  </div>
                  {field.last_30d_in != null && (
                    <div className="flex justify-between">
                      <span className="text-glomalin-canvas-muted">Last 30 days</span>
                      <span className="text-[#7BAFD4]">{field.last_30d_in.toFixed(2)}&Prime;</span>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── Scorecard section ─────────────────────────────────────── */}
            {scorecardLoading && (
              <>
                <div className="my-5 border-t border-glomalin-canvas-border" />
                <span className="text-[11px] font-mono text-glomalin-canvas-muted">loading...</span>
              </>
            )}

            {!scorecardLoading && showScorecard && scorecard && (
              <>
                <div className="my-5 border-t border-glomalin-canvas-border" />
                <div className="space-y-1 mb-3">
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-glomalin-canvas-muted">
                    Scorecard
                  </span>
                </div>

                <div className="space-y-4 font-mono text-sm">
                  {/* Acreage check */}
                  {showAcreageCheck && (
                    <div className="flex justify-between items-center">
                      <span className="text-glomalin-canvas-muted">Acreage</span>
                      {acreageMismatch ? (
                        <span className="text-glomalin-canvas-accent text-xs">
                          FSA: {scorecard.fsaAcres!.toFixed(1)} ac / Registry: {field.reportingAcres.toFixed(1)} ac
                        </span>
                      ) : (
                        <span className="text-[#7A9E7E] text-xs">Acreage reconciled ✓</span>
                      )}
                    </div>
                  )}

                  {/* APH yield trend */}
                  {scorecard.aph.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase tracking-[0.2em] text-glomalin-canvas-muted">
                        APH Yield
                      </span>
                      {scorecard.aph.map((rec) => (
                        <div
                          key={rec.crop_year}
                          className="flex justify-between"
                        >
                          <span className="text-glomalin-canvas-muted">{rec.crop_year}</span>
                          <span
                            className={
                              rec.is_disaster_year ? 'text-glomalin-canvas-accent' : 'text-[#7A9E7E]'
                            }
                          >
                            {rec.actual_yield.toFixed(1)} bu/ac
                            {rec.is_disaster_year ? ' (disaster)' : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Marketing position */}
                  {scorecard.estimated_bu !== null &&
                    scorecard.estimated_bu > 0 &&
                    scorecard.priced_bu !== null &&
                    marketingPct !== null && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-baseline">
                          <span className="text-glomalin-canvas-muted">Priced</span>
                          <span className="text-glomalin-canvas-text text-xs">
                            {scorecard.priced_bu.toLocaleString()} / {scorecard.estimated_bu.toLocaleString()} bu ({marketingPct.toFixed(0)}%)
                          </span>
                        </div>
                        {/* Progress bar */}
                        <div className="h-1 rounded-full bg-glomalin-canvas-border overflow-hidden">
                          <div
                            className="h-full rounded-full bg-glomalin-canvas-accent"
                            style={{ width: `${marketingPct}%` }}
                          />
                        </div>
                      </div>
                    )}

                  {/* Alerts row */}
                  {(scorecard.open_claims > 0 || scorecard.recent_observations > 0) && (
                    <div className="flex flex-wrap gap-3">
                      {scorecard.open_claims > 0 && (
                        <span className="text-glomalin-canvas-accent text-xs">
                          ● {scorecard.open_claims} open claim{scorecard.open_claims !== 1 ? 's' : ''}
                        </span>
                      )}
                      {scorecard.recent_observations > 0 && (
                        <span className="text-[#5BBFBF] text-xs">
                          ● {scorecard.recent_observations} observation{scorecard.recent_observations !== 1 ? 's' : ''} (30d)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

      {/* Divider */}
      <div className="my-5 border-t border-glomalin-canvas-border" />

      {/* Out to the full module, scoped to this field — the object → function
          hop. /app/fields/<id>/timeline was never built and 404'd. */}
      <a
        href={`/app/field-timeline?field=${encodeURIComponent(field.registry_field_id)}`}
        className="text-sm font-mono text-glomalin-canvas-accent hover:underline"
      >
        View Field Activity Timeline →
      </a>
    </div>
  ) : null

  if (isSheet) {
    return (
      <BottomSheet
        open={isOpen}
        onClose={onClose}
        title={field?.name ?? ''}
        subtitle={
          field
            ? [
                field.crop ?? 'No crop',
                `${field.reportingAcres.toLocaleString()} ac`,
                field.organic ? 'organic' : null,
              ].filter(Boolean).join(' · ')
            : undefined
        }
        bottomOffset={sheetBottomOffset}
      >
        {body}
      </BottomSheet>
    )
  }

  return (
    <>
      {/* Click-outside overlay — transparent, fills viewport, behind the panel */}
      {isOpen && (
        <div
          className="fixed inset-0 z-10"
          aria-hidden="true"
          onClick={onClose}
        />
      )}

      {/* Slide-in panel */}
      <div
        className={[
          'fixed right-0 top-0 h-screen w-96 max-w-[90vw] z-20',
          'bg-glomalin-canvas-surface border-l border-glomalin-canvas-border',
          'transition-transform duration-300',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
        role="complementary"
        aria-label="Field details"
      >
        {body}
      </div>
    </>
  )
}
