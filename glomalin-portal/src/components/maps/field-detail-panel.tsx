'use client'

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

interface FieldDetailPanelProps {
  field: FieldProperties | null
  onClose: () => void
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
 */
export function FieldDetailPanel({ field, onClose }: FieldDetailPanelProps) {
  const isOpen = field !== null

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
          'bg-[#0e0c0b] border-l border-[#2a2218]',
          'transition-transform duration-300',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
        role="complementary"
        aria-label="Field details"
      >
        {field && (
          <div className="flex flex-col h-full p-5 overflow-y-auto">
            {/* Header row: field name + close button */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <h2 className="text-[#C8860A] font-mono text-lg font-semibold leading-snug">
                {field.name}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="flex-shrink-0 text-[#6a5a4a] hover:text-[#e8d8c0] transition-colors mt-0.5"
                aria-label="Close panel"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Crop + organic badges */}
            <div className="flex flex-wrap gap-2 mb-5">
              {field.crop ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-[#1a1510] border border-[#2a2218] text-[#e8d8c0]">
                  {field.crop}
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-[#1a1510] border border-[#2a2218] text-[#6a5a4a]">
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
                <span className="text-[#6a5a4a]">Reporting Acres</span>
                <span className="text-[#e8d8c0]">
                  {field.reportingAcres > 0
                    ? `${field.reportingAcres.toFixed(1)} ac`
                    : '— ac'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6a5a4a]">Organic Status</span>
                <span className={field.organic ? 'text-[#7A9E7E]' : 'text-[#e8d8c0]'}>
                  {field.organic ? 'Certified' : 'Conventional'}
                </span>
              </div>
              {field.fsa_reported !== null && (
                <div className="flex justify-between">
                  <span className="text-[#6a5a4a]">FSA 578</span>
                  <span className={field.fsa_reported ? 'text-[#7A9E7E]' : 'text-[#C8860A]'}>
                    {field.fsa_reported ? '● Reported' : '○ Not reported'}
                  </span>
                </div>
              )}
            </div>

            {/* Rainfall — only shown when precip data is available */}
            {field.last_7d_in != null && (
              <>
                <div className="my-5 border-t border-[#2a2218]" />
                <div className="space-y-1 mb-1">
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#6a5a4a]">
                    Rainfall
                  </span>
                </div>
                <div className="space-y-3 font-mono text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#6a5a4a]">Last 7 days</span>
                    <span className="text-[#7BAFD4]">{field.last_7d_in.toFixed(2)}&Prime;</span>
                  </div>
                  {field.last_30d_in != null && (
                    <div className="flex justify-between">
                      <span className="text-[#6a5a4a]">Last 30 days</span>
                      <span className="text-[#7BAFD4]">{field.last_30d_in.toFixed(2)}&Prime;</span>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Divider */}
            <div className="my-5 border-t border-[#2a2218]" />

            {/* Timeline link — future page, not yet built */}
            <a
              href={`/app/fields/${field.registry_field_id}/timeline`}
              className="text-sm font-mono text-[#C8860A] hover:underline"
            >
              View Field Activity Timeline →
            </a>
          </div>
        )}
      </div>
    </>
  )
}
