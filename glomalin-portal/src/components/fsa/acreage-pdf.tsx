// NO 'use client' directive — loaded via dynamic({ ssr: false }) from acreage-pdf-button.tsx
// This file and acreage-pdf-button.tsx are the ONLY files that import from @react-pdf/renderer.

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { CluRecord } from '@/lib/fsa/calc'

// ===== Styles =====

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    paddingTop: 30,
    paddingBottom: 30,
    paddingLeft: 30,
    paddingRight: 30,
    fontSize: 9,
  },
  title: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 8,
    color: '#666666',
    marginBottom: 12,
  },
  disclaimer: {
    fontSize: 7,
    fontStyle: 'italic',
    color: '#888888',
    marginBottom: 12,
  },
  // Table
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
    borderBottomStyle: 'solid',
    paddingBottom: 4,
    marginBottom: 2,
    backgroundColor: '#f5f5f5',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e0e0e0',
    borderBottomStyle: 'solid',
    paddingTop: 2,
    paddingBottom: 2,
  },
  cellBold: {
    fontFamily: 'Helvetica-Bold',
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 6,
    paddingRight: 6,
    fontSize: 9,
  },
  cell: {
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 6,
    paddingRight: 6,
    fontSize: 9,
  },
  // Column widths (landscape LETTER = 792pt wide, minus 60pt margins = 732pt)
  colClu: { width: 40 },
  colField: { width: 90 },
  colCrop: { width: 80 },
  colPractice: { width: 70 },
  colAcres: { width: 55 },
  colPlantDate: { width: 65 },
  colOrganic: { width: 50 },
  colStatus: { width: 60 },
  // Farm/Tract headers
  farmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 8,
    paddingRight: 8,
    marginBottom: 2,
    marginTop: 4,
  },
  farmHeaderText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: '#ffffff',
  },
  tractHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8e0d0',
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 12,
    paddingRight: 8,
    marginBottom: 2,
  },
  tractHeaderText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: '#333333',
  },
  subtotalRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#999999',
    borderTopStyle: 'solid',
    paddingTop: 3,
    paddingBottom: 3,
    backgroundColor: '#f0ece4',
    marginBottom: 4,
  },
  subtotalCell: {
    fontFamily: 'Helvetica-Bold',
    paddingTop: 3,
    paddingBottom: 3,
    paddingLeft: 6,
    paddingRight: 6,
    fontSize: 9,
    color: '#333333',
  },
  // Summary section
  sectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    marginBottom: 6,
    marginTop: 12,
    color: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
    borderBottomStyle: 'solid',
    paddingBottom: 3,
  },
  summaryRow: {
    flexDirection: 'row',
    paddingTop: 3,
    paddingBottom: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e0e0e0',
    borderBottomStyle: 'solid',
  },
  summaryLabel: {
    fontFamily: 'Helvetica-Bold',
    width: 180,
    paddingLeft: 4,
    paddingRight: 4,
    fontSize: 9,
  },
  summaryValue: {
    width: 100,
    paddingLeft: 4,
    paddingRight: 4,
    fontSize: 9,
    textAlign: 'right',
  },
  grandTotalRow: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    paddingTop: 5,
    paddingBottom: 5,
    marginTop: 6,
  },
  grandTotalLabel: {
    fontFamily: 'Helvetica-Bold',
    width: 180,
    paddingLeft: 8,
    paddingRight: 4,
    fontSize: 10,
    color: '#ffffff',
  },
  grandTotalValue: {
    fontFamily: 'Helvetica-Bold',
    width: 100,
    paddingLeft: 4,
    paddingRight: 4,
    fontSize: 10,
    color: '#ffffff',
    textAlign: 'right',
  },
})

// ===== Helpers =====

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function formatAcres(n: number | null | undefined): string {
  if (n == null) return '—'
  return round2(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '—'
  return d
}

// ===== Table Header Row =====

function PdfTableHeader() {
  return (
    <View style={styles.tableHeader}>
      <Text style={[styles.cellBold, styles.colClu]}>CLU</Text>
      <Text style={[styles.cellBold, styles.colField]}>Field Name</Text>
      <Text style={[styles.cellBold, styles.colCrop]}>Crop</Text>
      <Text style={[styles.cellBold, styles.colPractice]}>Practice</Text>
      <Text style={[styles.cellBold, styles.colAcres]}>Acres</Text>
      <Text style={[styles.cellBold, styles.colPlantDate]}>Plant Date</Text>
      <Text style={[styles.cellBold, styles.colOrganic]}>Organic</Text>
      <Text style={[styles.cellBold, styles.colStatus]}>Status</Text>
    </View>
  )
}

// ===== CLU Record Row =====

function PdfCluRow({ record }: { record: CluRecord }) {
  return (
    <View style={styles.tableRow} wrap={false}>
      <Text style={[styles.cell, styles.colClu]}>{record.clu || '—'}</Text>
      <Text style={[styles.cell, styles.colField]}>{record.field_name || '—'}</Text>
      <Text style={[styles.cell, styles.colCrop]}>{record.crop || '(no crop)'}</Text>
      <Text style={[styles.cell, styles.colPractice]}>
        {record.irrigated ? 'Irrigated' : 'Non-Irrig.'}
      </Text>
      <Text style={[styles.cell, styles.colAcres]}>{formatAcres(record.fsa_acres)}</Text>
      <Text style={[styles.cell, styles.colPlantDate]}>{formatDate(record.grain_plant_date)}</Text>
      <Text style={[styles.cell, styles.colOrganic]}>{record.organic ? 'Yes' : 'No'}</Text>
      <Text style={[styles.cell, styles.colStatus]}>{record.reported ? 'Reported' : 'Pending'}</Text>
    </View>
  )
}

// ===== Main Document Component =====

interface AcreagePdfDocumentProps {
  records: CluRecord[]
}

export function AcreagePdfDocument({ records }: AcreagePdfDocumentProps) {
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Group by farm → tract
  const farmMap: Record<string, Record<string, CluRecord[]>> = {}
  for (const r of records) {
    const farm = r.farm_number || 'Unknown'
    const tract = r.tract_number || 'Unknown'
    if (!farmMap[farm]) farmMap[farm] = {}
    if (!farmMap[farm][tract]) farmMap[farm][tract] = []
    farmMap[farm][tract].push(r)
  }

  const farmNumbers = Object.keys(farmMap).sort()

  // Per-crop subtotals (for summary section)
  const cropMap: Record<string, number> = {}
  for (const r of records) {
    const crop = r.crop || '(no crop)'
    cropMap[crop] = (cropMap[crop] || 0) + (r.fsa_acres || 0)
  }
  const cropEntries = Object.entries(cropMap)
    .map(([crop, acres]) => ({ crop, acres: round2(acres) }))
    .sort((a, b) => b.acres - a.acres)

  // Organic/Conventional split
  let organicAcres = 0
  let conventionalAcres = 0
  for (const r of records) {
    if (r.organic) organicAcres += r.fsa_acres || 0
    else conventionalAcres += r.fsa_acres || 0
  }
  organicAcres = round2(organicAcres)
  conventionalAcres = round2(conventionalAcres)

  // Grand totals
  const totalAcres = round2(records.reduce((sum, r) => sum + (r.fsa_acres || 0), 0))
  const totalReported = records.filter((r) => r.reported).length
  const totalUnreported = records.filter((r) => !r.reported).length

  return (
    <Document>
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        {/* Document header */}
        <Text style={styles.title}>Acreage Reporting Summary — Crop Year 2026</Text>
        <Text style={styles.subtitle}>Generated: {today}</Text>
        <Text style={styles.disclaimer}>
          This is a reporting summary for producer records. It is not an official FSA-578
          government form.
        </Text>

        {/* Table header (repeated notion — in react-pdf, headers do not auto-repeat; use once) */}
        <PdfTableHeader />

        {/* Farm groups */}
        {farmNumbers.map((farmNumber, farmIdx) => {
          const tracts = farmMap[farmNumber]
          const tractNumbers = Object.keys(tracts).sort()

          // Farm-level totals
          const farmRecords = tractNumbers.flatMap((t) => tracts[t])
          const farmTotalAcres = round2(farmRecords.reduce((s, r) => s + (r.fsa_acres || 0), 0))
          const farmReported = farmRecords.filter((r) => r.reported).length
          const farmUnreported = farmRecords.filter((r) => !r.reported).length
          const farmName = farmRecords[0]?.farm_name || ''

          return (
            <View key={farmNumber} break={farmIdx > 0}>
              {/* Farm header */}
              <View style={styles.farmHeader}>
                <Text style={styles.farmHeaderText}>
                  Farm {farmNumber}
                  {farmName ? ` — ${farmName}` : ''}
                </Text>
              </View>

              {/* Tracts */}
              {tractNumbers.map((tractNumber) => {
                const tractRecords = tracts[tractNumber]
                return (
                  <View key={tractNumber} wrap>
                    {/* Tract header */}
                    <View style={styles.tractHeader}>
                      <Text style={styles.tractHeaderText}>
                        Tract {tractNumber} ({tractRecords.length} CLUs)
                      </Text>
                    </View>

                    {/* CLU rows */}
                    {tractRecords.map((record) => (
                      <PdfCluRow key={record.id} record={record} />
                    ))}
                  </View>
                )
              })}

              {/* Per-farm subtotal */}
              <View style={styles.subtotalRow} wrap={false}>
                <Text style={[styles.subtotalCell, { width: 210 }]}>
                  Farm {farmNumber} Subtotal
                </Text>
                <Text style={[styles.subtotalCell, { width: 55 }]}>
                  {formatAcres(farmTotalAcres)}
                </Text>
                <Text style={[styles.subtotalCell, { width: 120 }]}>
                  {farmReported} reported / {farmUnreported} pending
                </Text>
              </View>
            </View>
          )
        })}

        {/* Summary section */}
        <View wrap={false}>
          <Text style={styles.sectionTitle}>Summary</Text>

          {/* Per-crop subtotals */}
          <Text
            style={[
              styles.sectionTitle,
              { fontSize: 10, marginTop: 0, marginBottom: 4 },
            ]}
          >
            Crop Breakdown
          </Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.cellBold, { width: 180 }]}>Crop</Text>
            <Text style={[styles.cellBold, { width: 100 }]}>Total Acres</Text>
          </View>
          {cropEntries.map((entry) => (
            <View key={entry.crop} style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{entry.crop}</Text>
              <Text style={styles.summaryValue}>{formatAcres(entry.acres)}</Text>
            </View>
          ))}

          {/* Organic/Conventional split */}
          <Text
            style={[
              styles.sectionTitle,
              { fontSize: 10, marginTop: 8, marginBottom: 4 },
            ]}
          >
            Organic / Conventional Split
          </Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Organic Acres</Text>
            <Text style={styles.summaryValue}>{formatAcres(organicAcres)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Conventional Acres</Text>
            <Text style={styles.summaryValue}>{formatAcres(conventionalAcres)}</Text>
          </View>

          {/* Grand total */}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Grand Total</Text>
            <Text style={styles.grandTotalValue}>{formatAcres(totalAcres)}</Text>
          </View>
          <View style={[styles.summaryRow, { backgroundColor: '#f0ece4' }]}>
            <Text style={styles.summaryLabel}>Total CLU Records</Text>
            <Text style={styles.summaryValue}>{records.length.toLocaleString()}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Reported</Text>
            <Text style={styles.summaryValue}>{totalReported.toLocaleString()}</Text>
          </View>
          <View style={[styles.summaryRow, { backgroundColor: '#f0ece4' }]}>
            <Text style={styles.summaryLabel}>Pending</Text>
            <Text style={styles.summaryValue}>{totalUnreported.toLocaleString()}</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
