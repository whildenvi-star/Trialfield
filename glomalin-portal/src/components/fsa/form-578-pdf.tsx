// NO 'use client' — loaded via dynamic({ ssr: false }) from form-578-button.tsx
// Only this file and form-578-button.tsx import from @react-pdf/renderer.

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { CluRecord } from '@/lib/fsa/calc'

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    paddingTop: 28,
    paddingBottom: 28,
    paddingLeft: 28,
    paddingRight: 28,
    fontSize: 8,
  },
  // Header block
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  headerLeft: { flexDirection: 'column' },
  formTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#1a1a1a', marginBottom: 2 },
  formSubtitle: { fontSize: 8, color: '#444444' },
  formNote: { fontSize: 7, color: '#888888', fontStyle: 'italic', marginTop: 2 },
  headerRight: { flexDirection: 'column', alignItems: 'flex-end' },
  headerMeta: { fontSize: 8, color: '#444444' },
  divider: {
    borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid',
    marginBottom: 6, marginTop: 4,
  },
  // Farm / tract sub-headers
  farmBlock: { marginTop: 6 },
  farmBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1e3a5f',
    paddingHorizontal: 8, paddingVertical: 5,
    marginBottom: 1,
  },
  farmBarText: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#ffffff' },
  tractBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#dde4ee',
    paddingHorizontal: 12, paddingVertical: 3,
    marginBottom: 1,
  },
  tractBarText: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#1e3a5f' },
  // Table
  thead: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: '#999999', borderBottomStyle: 'solid',
    paddingBottom: 2, marginBottom: 1, backgroundColor: '#f2f2f2',
    paddingHorizontal: 2,
  },
  th: { fontFamily: 'Helvetica-Bold', fontSize: 7, paddingHorizontal: 2, paddingVertical: 2 },
  tr: {
    flexDirection: 'row',
    borderBottomWidth: 0.5, borderBottomColor: '#e0e0e0', borderBottomStyle: 'solid',
    paddingHorizontal: 2, paddingVertical: 1,
  },
  trAlt: { backgroundColor: '#f9f9f7' },
  td: { fontSize: 8, paddingHorizontal: 2, paddingVertical: 2 },
  // Column widths (landscape LETTER minus margins ≈ 756pt)
  cFarm:    { width: 40 },
  cTract:   { width: 36 },
  cClu:     { width: 30 },
  cField:   { width: 72 },
  cCrop:    { width: 90 },
  cUse:     { width: 50 },
  cAcres:   { width: 48, textAlign: 'right' },
  cShare:   { width: 32, textAlign: 'right' },
  cIrr:     { width: 28, textAlign: 'center' },
  cOrg:     { width: 28, textAlign: 'center' },
  cCC:      { width: 24, textAlign: 'center' },
  cPP:      { width: 24, textAlign: 'center' },
  cDate:    { width: 56 },
  // Subtotal / totals
  subtotalBar: {
    flexDirection: 'row',
    backgroundColor: '#ececec',
    borderTopWidth: 1, borderTopColor: '#aaaaaa', borderTopStyle: 'solid',
    paddingHorizontal: 2, paddingVertical: 2,
    marginBottom: 4,
  },
  subtotalLabel: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#333333', width: 278 },
  subtotalValue: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#333333', width: 48, textAlign: 'right' },
  // Summary page
  summaryTitle: {
    fontFamily: 'Helvetica-Bold', fontSize: 11, color: '#1e3a5f',
    borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid',
    paddingBottom: 3, marginBottom: 6,
  },
  summRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5, borderBottomColor: '#e0e0e0', borderBottomStyle: 'solid',
    paddingVertical: 3,
  },
  summLabel: { fontFamily: 'Helvetica-Bold', fontSize: 9, width: 200, paddingLeft: 4 },
  summValue: { fontSize: 9, width: 100, textAlign: 'right', paddingRight: 4 },
  grandBar: {
    flexDirection: 'row', backgroundColor: '#1e3a5f',
    paddingVertical: 5, paddingHorizontal: 4, marginTop: 6,
  },
  grandLabel: { fontFamily: 'Helvetica-Bold', fontSize: 10, color: '#ffffff', width: 200 },
  grandValue: { fontFamily: 'Helvetica-Bold', fontSize: 10, color: '#ffffff', width: 100, textAlign: 'right' },
  // Warning box
  warnBox: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#cc8800', borderStyle: 'solid',
    backgroundColor: '#fff8e6',
    paddingHorizontal: 8, paddingVertical: 4,
    marginBottom: 8, borderRadius: 2,
  },
  warnText: { fontSize: 8, color: '#7a5000' },
  // Footer
  footer: {
    position: 'absolute', bottom: 14, left: 28, right: 28,
    borderTopWidth: 0.5, borderTopColor: '#cccccc', borderTopStyle: 'solid',
    paddingTop: 4, flexDirection: 'row', justifyContent: 'space-between',
  },
  footerText: { fontSize: 7, color: '#aaaaaa' },
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function ac(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toFixed(2)
}

function yn(v: boolean | null | undefined): string {
  return v ? 'Y' : 'N'
}

// ── Table header (repeatable) ─────────────────────────────────────────────────

function Thead() {
  return (
    <View style={s.thead} fixed>
      <Text style={[s.th, s.cFarm]}>Farm #</Text>
      <Text style={[s.th, s.cTract]}>Tract #</Text>
      <Text style={[s.th, s.cClu]}>CLU #</Text>
      <Text style={[s.th, s.cField]}>Field Name</Text>
      <Text style={[s.th, s.cCrop]}>Commodity</Text>
      <Text style={[s.th, s.cUse]}>Intended Use</Text>
      <Text style={[s.th, s.cAcres]}>Planted Ac</Text>
      <Text style={[s.th, s.cShare]}>Share %</Text>
      <Text style={[s.th, s.cIrr]}>Irr</Text>
      <Text style={[s.th, s.cOrg]}>Org</Text>
      <Text style={[s.th, s.cCC]}>CC</Text>
      <Text style={[s.th, s.cPP]}>PP</Text>
      <Text style={[s.th, s.cDate]}>Plant Date</Text>
    </View>
  )
}

// ── Data row ──────────────────────────────────────────────────────────────────

function Trow({ r, idx }: { r: CluRecord; idx: number }) {
  const rowStyle = idx % 2 === 1 ? [s.tr, s.trAlt] : [s.tr]
  return (
    <View style={rowStyle} wrap={false}>
      <Text style={[s.td, s.cFarm]}>{r.farm_number}</Text>
      <Text style={[s.td, s.cTract]}>{r.tract_number}</Text>
      <Text style={[s.td, s.cClu]}>{r.clu}</Text>
      <Text style={[s.td, s.cField]}>{r.field_name ?? '—'}</Text>
      <Text style={[s.td, s.cCrop]}>{r.crop ?? '—'}</Text>
      <Text style={[s.td, s.cUse]}>{r.use ?? '—'}</Text>
      <Text style={[s.td, s.cAcres]}>{ac(r.fsa_acres)}</Text>
      <Text style={[s.td, s.cShare]}>100%</Text>
      <Text style={[s.td, s.cIrr]}>{r.irrigated ? 'I' : 'N'}</Text>
      <Text style={[s.td, s.cOrg]}>{r.organic ? 'O' : 'C'}</Text>
      <Text style={[s.td, s.cCC]}>{yn(r.cover_crop)}</Text>
      <Text style={[s.td, s.cPP]}>{yn(r.prevented_planting)}</Text>
      <Text style={[s.td, s.cDate]}>{r.grain_plant_date ?? '—'}</Text>
    </View>
  )
}

// ── Main document ─────────────────────────────────────────────────────────────

interface Form578Props {
  records: CluRecord[]    // all clu_records for the crop year
  cropYear: number
  confirmedOnly?: boolean // if true, only include reported=true rows
}

export function Form578Document({ records, cropYear, confirmedOnly = true }: Form578Props) {
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const source = confirmedOnly ? records.filter((r) => r.reported) : records
  const unconfirmedCount = records.length - source.length

  // Group: farm → tract → rows
  const farmMap = new Map<string, Map<string, CluRecord[]>>()
  for (const r of source) {
    const farm  = r.farm_number  || 'Unknown'
    const tract = r.tract_number || 'Unknown'
    if (!farmMap.has(farm))  farmMap.set(farm, new Map())
    if (!farmMap.get(farm)!.has(tract)) farmMap.get(farm)!.set(tract, [])
    farmMap.get(farm)!.get(tract)!.push(r)
  }

  // Summary stats
  const totalAc   = source.reduce((s, r) => s + (r.fsa_acres ?? 0), 0)
  const organicAc = source.filter((r) => r.organic).reduce((s, r) => s + (r.fsa_acres ?? 0), 0)
  const convAc    = totalAc - organicAc

  const cropTotals = new Map<string, number>()
  for (const r of source) {
    const crop = r.crop ?? '(no crop)'
    cropTotals.set(crop, (cropTotals.get(crop) ?? 0) + (r.fsa_acres ?? 0))
  }
  const cropRows = Array.from(cropTotals.entries())
    .sort((a, b) => b[1] - a[1])

  const farmNumbers = Array.from(farmMap.keys()).sort()

  return (
    <Document>
      {/* ── Acreage page(s) ──────────────────────────────────────── */}
      <Page size="LETTER" orientation="landscape" style={s.page}>
        {/* Header */}
        <View style={s.headerRow}>
          <View style={s.headerLeft}>
            <Text style={s.formTitle}>FSA-578 — Report of Acreage</Text>
            <Text style={s.formSubtitle}>Crop Year {cropYear} | Rock County, WI</Text>
            <Text style={s.formNote}>
              Columns: Irr=Irrigation (I/N) · Org=Practice (O=Organic / C=Conv.) ·
              CC=Cover Crop · PP=Prevented Planting
            </Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerMeta}>Generated: {today}</Text>
            <Text style={s.headerMeta}>{source.length} CLU records | {ac(totalAc)} total acres</Text>
          </View>
        </View>

        {/* Unconfirmed warning */}
        {unconfirmedCount > 0 && (
          <View style={s.warnBox}>
            <Text style={s.warnText}>
              ⚠  {unconfirmedCount} CLU record{unconfirmedCount !== 1 ? 's' : ''} not yet confirmed
              and excluded from this report. Confirm all CLUs in the Reconcile tab before submitting.
            </Text>
          </View>
        )}

        <View style={s.divider} />

        {/* Table header (fixed repeats on each page) */}
        <Thead />

        {/* Farm groups */}
        {farmNumbers.map((farmNumber) => {
          const tracts    = farmMap.get(farmNumber)!
          const tractNums = Array.from(tracts.keys()).sort()
          const farmRecs  = tractNums.flatMap((t) => tracts.get(t)!)
          const farmAc    = farmRecs.reduce((s, r) => s + (r.fsa_acres ?? 0), 0)
          const farmName  = farmRecs[0]?.farm_name ?? ''

          return (
            <View key={farmNumber} style={s.farmBlock}>
              <View style={s.farmBar}>
                <Text style={s.farmBarText}>
                  Farm {farmNumber}{farmName ? ` — ${farmName}` : ''}
                  {'  '}({farmRecs.length} CLUs · {ac(farmAc)} ac)
                </Text>
              </View>

              {tractNums.map((tractNumber) => {
                const tractRecs = tracts.get(tractNumber)!
                const tractAc   = tractRecs.reduce((s, r) => s + (r.fsa_acres ?? 0), 0)

                return (
                  <View key={tractNumber}>
                    <View style={s.tractBar}>
                      <Text style={s.tractBarText}>
                        Tract {tractNumber} — {tractRecs.length} CLU{tractRecs.length !== 1 ? 's' : ''} · {ac(tractAc)} ac
                      </Text>
                    </View>

                    {tractRecs.map((r, i) => (
                      <Trow key={r.id} r={r} idx={i} />
                    ))}

                    {/* Tract subtotal */}
                    <View style={s.subtotalBar}>
                      <Text style={s.subtotalLabel}>  Tract {tractNumber} total</Text>
                      <Text style={s.subtotalValue}>{ac(tractAc)}</Text>
                    </View>
                  </View>
                )
              })}
            </View>
          )
        })}

        {/* Page footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>FSA-578 · Crop Year {cropYear} · Rock County, WI · Glomalin Portal</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}`
          } />
        </View>
      </Page>

      {/* ── Summary page ─────────────────────────────────────────── */}
      <Page size="LETTER" style={s.page}>
        <Text style={s.summaryTitle}>Summary — Crop Year {cropYear}</Text>

        <Text style={[s.formSubtitle, { marginBottom: 8 }]}>
          Generated: {today} · {source.length} confirmed CLU records
        </Text>

        {/* Crop breakdown */}
        <Text style={[s.summaryTitle, { fontSize: 9, marginBottom: 4 }]}>By Commodity</Text>
        <View style={s.thead}>
          <Text style={[s.th, { width: 200 }]}>Commodity</Text>
          <Text style={[s.th, { width: 100, textAlign: 'right' }]}>Acres</Text>
        </View>
        {cropRows.map(([crop, total]) => (
          <View key={crop} style={s.summRow}>
            <Text style={s.summLabel}>{crop}</Text>
            <Text style={s.summValue}>{ac(total)}</Text>
          </View>
        ))}

        {/* Organic split */}
        <Text style={[s.summaryTitle, { fontSize: 9, marginBottom: 4, marginTop: 12 }]}>
          Organic / Conventional Split
        </Text>
        <View style={s.summRow}>
          <Text style={s.summLabel}>Organic (O)</Text>
          <Text style={s.summValue}>{ac(organicAc)}</Text>
        </View>
        <View style={[s.summRow, { backgroundColor: '#f9f9f7' }]}>
          <Text style={s.summLabel}>Conventional (C)</Text>
          <Text style={s.summValue}>{ac(convAc)}</Text>
        </View>

        {/* Grand total */}
        <View style={s.grandBar}>
          <Text style={s.grandLabel}>Grand Total</Text>
          <Text style={s.grandValue}>{ac(totalAc)} acres</Text>
        </View>

        {/* Certification note */}
        <View style={{ marginTop: 40 }}>
          <Text style={[s.formNote, { fontSize: 8, color: '#333333', marginBottom: 24 }]}>
            I certify that the information on this form is correct and complete to the best
            of my knowledge and belief.
          </Text>
          <View style={{ flexDirection: 'row', gap: 40 }}>
            <View style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: '#333', paddingBottom: 2 }}>
              <Text style={[s.formNote, { fontSize: 7, marginTop: 4 }]}>Producer Signature</Text>
            </View>
            <View style={{ width: 120, borderBottomWidth: 1, borderBottomColor: '#333', paddingBottom: 2 }}>
              <Text style={[s.formNote, { fontSize: 7, marginTop: 4 }]}>Date</Text>
            </View>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>FSA-578 · Crop Year {cropYear} · Rock County, WI · Glomalin Portal</Text>
          <Text style={s.footerText}>Summary</Text>
        </View>
      </Page>
    </Document>
  )
}
