'use client'

import { CROP_COLORS, ORGANIC_BORDER_COLOR } from '@/lib/map-config'

interface MapLegendProps {
  crops: string[]
  showPrecip?: boolean
}

/**
 * MapLegend — compact always-visible overlay at the bottom-left of the map.
 *
 * Positioned absolute bottom-4 left-4 inside the map container (position: relative).
 *
 * Shows:
 *   - Color swatches for each crop present on the map
 *   - A "No crop" swatch for fields with no crop assigned
 *   - A dashed line indicator for "Organic certified"
 *
 * Always visible — no toggle, no collapse.
 */
export function MapLegend({ crops, showPrecip = false }: MapLegendProps) {
  // Filter to only crops that are in the CROP_COLORS palette
  const presentCrops = crops.filter(
    (c) => c && !c.startsWith('__') && CROP_COLORS[c]
  )

  return (
    <div
      className="absolute bottom-4 left-4 z-10 rounded border border-[#2a2218] p-3"
      style={{ backgroundColor: 'rgba(14, 12, 11, 0.92)' }}
      role="note"
      aria-label="Map legend"
    >
      <div className="space-y-1.5 min-w-[140px]">

        {/* Crop color swatches */}
        {presentCrops.map((crop) => (
          <LegendSwatch key={crop} color={CROP_COLORS[crop]} label={crop} />
        ))}

        {/* Always show "No crop" swatch */}
        <LegendSwatch color={CROP_COLORS.__unassigned} label="No crop" />

        {/* Divider before organic indicator */}
        <div className="border-t border-[#2a2218] my-2" />

        {/* Organic certified indicator — dashed line */}
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-0 flex-shrink-0"
            style={{ borderTop: `2px dashed ${ORGANIC_BORDER_COLOR}` }}
            aria-hidden="true"
          />
          <span className="text-xs font-mono text-[#e8d8c0] leading-none">
            Organic certified
          </span>
        </div>

        {/* Precip gradient legend — only when precip layer is active */}
        {showPrecip && (
          <>
            <div className="border-t border-[#2a2218] my-2" />
            <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#6a5a4a] leading-none block mb-1.5">
              Rainfall (7d)
            </span>
            <PrecipSwatch color="rgba(180,210,255,0.55)" label='&lt; 0.5&Prime;' />
            <PrecipSwatch color="rgba(100,165,240,0.65)" label="0.5 – 1.5&Prime;" />
            <PrecipSwatch color="rgba(50,120,220,0.72)"  label="1.5 – 3.0&Prime;" />
            <PrecipSwatch color="rgba(20,80,200,0.82)"   label='&gt; 3.0&Prime;' />
          </>
        )}

      </div>
    </div>
  )
}

function PrecipSwatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-3 h-3 flex-shrink-0 rounded-sm"
        style={{ backgroundColor: color, border: '1px solid rgba(255,255,255,0.15)' }}
        aria-hidden="true"
      />
      <span
        className="text-xs font-mono text-[#e8d8c0] leading-none"
        dangerouslySetInnerHTML={{ __html: label }}
      />
    </div>
  )
}

/** Single legend row: colored square swatch + label. */
function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-3 h-3 flex-shrink-0 rounded-sm"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span className="text-xs font-mono text-[#e8d8c0] leading-none truncate max-w-[120px]">
        {label}
      </span>
    </div>
  )
}
