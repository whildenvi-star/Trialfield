'use client'

import { useState } from 'react'
import { pdf, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { TimelineEntry } from '@/lib/timeline/types'

interface TimelineExportProps {
  entries: TimelineEntry[]
  fieldName: string
  year: number
  fieldId: string
}

const SOURCE_COLORS: Record<string, string> = {
  budget: '#C8860A',
  cert: '#7A9E7E',
  fieldops: '#6A8CAF',
  grain: '#B87333',
}

const SOURCE_LABELS: Record<string, string> = {
  budget: 'Budget',
  cert: 'Organic',
  fieldops: 'FieldOps',
  grain: 'Grain',
}

// ── PDF Document ──

const pdfStyles = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 30,
    paddingHorizontal: 30,
    backgroundColor: '#FFFFFF',
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#1a1a1a',
  },
  title: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 9,
    color: '#666666',
    marginBottom: 20,
  },
  monthHeader: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginTop: 14,
    marginBottom: 4,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e5e5',
    alignItems: 'flex-start',
  },
  rowAlt: {
    backgroundColor: '#f9f9f9',
  },
  dateCol: {
    width: 55,
    color: '#666666',
  },
  sourceCol: {
    width: 55,
  },
  typeCol: {
    width: 80,
    color: '#666666',
  },
  summaryCol: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 4,
    backgroundColor: '#f0f0f0',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
})

function fmtDateShort(dateStr: string | null): string {
  if (!dateStr || dateStr === '9999-12-31') return 'Planned'
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getMonthLabel(dateStr: string | null): string {
  if (!dateStr || dateStr === '9999-12-31') return 'Unscheduled'
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return 'Unknown'
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

interface PdfDocumentProps {
  entries: TimelineEntry[]
  fieldName: string
  year: number
}

function TimelinePdfDocument({ entries, fieldName, year }: PdfDocumentProps) {
  // Group by month
  const monthMap = new Map<string, TimelineEntry[]>()
  for (const entry of entries) {
    const key = getMonthLabel(entry.date)
    const group = monthMap.get(key) ?? []
    group.push(entry)
    monthMap.set(key, group)
  }

  return (
    <Document>
      <Page size="LETTER" orientation="portrait" style={pdfStyles.page}>
        <Text style={pdfStyles.title}>
          {fieldName} — Activity Timeline {year}
        </Text>
        <Text style={pdfStyles.subtitle}>
          {entries.length} activities | Generated {new Date().toLocaleDateString('en-US')}
        </Text>

        {/* Table header */}
        <View style={pdfStyles.headerRow}>
          <Text style={pdfStyles.dateCol}>Date</Text>
          <Text style={pdfStyles.sourceCol}>Source</Text>
          <Text style={pdfStyles.typeCol}>Type</Text>
          <Text style={pdfStyles.summaryCol}>Summary</Text>
        </View>

        {Array.from(monthMap.entries()).map(([month, monthEntries]) => (
          <View key={month}>
            <Text style={pdfStyles.monthHeader}>{month}</Text>
            {monthEntries.map((entry, i) => {
              const sourceColor = SOURCE_COLORS[entry.source] ?? '#666666'
              return (
                <View key={entry.id} style={[pdfStyles.row, i % 2 === 1 ? pdfStyles.rowAlt : {}]}>
                  <Text style={pdfStyles.dateCol}>{fmtDateShort(entry.date)}</Text>
                  <Text style={[pdfStyles.sourceCol, { color: sourceColor }]}>
                    {SOURCE_LABELS[entry.source] ?? entry.source}
                  </Text>
                  <Text style={pdfStyles.typeCol}>{entry.activityType}</Text>
                  <Text style={pdfStyles.summaryCol}>{entry.summary}</Text>
                </View>
              )
            })}
          </View>
        ))}
      </Page>
    </Document>
  )
}

// ── CSV export helper ──

function buildCsvRows(entries: TimelineEntry[]): string {
  const headers = [
    'Date',
    'Source',
    'Activity Type',
    'Summary',
    'Status',
    'Ticket #',
    'Weight (lbs)',
    'Bushels',
    'Operator',
    'Equipment',
    'Acres',
  ]

  const rows = entries.map((e) => {
    const d = e.detail
    const netWeight = typeof d.netWeight === 'number' ? d.netWeight : null
    const bushels =
      netWeight !== null
        ? (netWeight / (typeof d.testWeight === 'number' ? (d.testWeight as number) : 56)).toFixed(1)
        : ''

    return [
      e.date && e.date !== '9999-12-31' ? e.date : 'Planned',
      SOURCE_LABELS[e.source] ?? e.source,
      e.activityType,
      e.summary,
      e.status ?? '',
      typeof d.ticketNumber === 'string' || typeof d.ticketNumber === 'number'
        ? String(d.ticketNumber)
        : '',
      netWeight !== null ? String(netWeight) : '',
      bushels,
      typeof d.operator === 'string' ? d.operator : '',
      typeof d.equipment === 'string' ? d.equipment : '',
      typeof d.acres === 'number'
        ? d.acres.toFixed(1)
        : typeof d.plannedAcres === 'number'
        ? d.plannedAcres.toFixed(1)
        : typeof d.acresWorked === 'number'
        ? d.acresWorked.toFixed(1)
        : '',
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`)
  })

  return [headers.map((h) => `"${h}"`).join(','), ...rows.map((r) => r.join(','))].join('\n')
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 100)
}

// ── Export component ──

export function TimelineExport({ entries, fieldName, year }: TimelineExportProps) {
  const [pdfLoading, setPdfLoading] = useState(false)

  const safeFileName = fieldName.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-')

  async function handleExportPdf() {
    setPdfLoading(true)
    try {
      const blob = await pdf(
        <TimelinePdfDocument entries={entries} fieldName={fieldName} year={year} />
      ).toBlob()
      downloadBlob(blob, `${safeFileName}-timeline-${year}.pdf`)
    } catch (err) {
      console.error('PDF export failed', err)
    } finally {
      setPdfLoading(false)
    }
  }

  function handleExportCsv() {
    const csv = buildCsvRows(entries)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    downloadBlob(blob, `${safeFileName}-timeline-${year}.csv`)
  }

  const disabled = entries.length === 0

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleExportCsv}
        disabled={disabled}
        className="px-3 py-1.5 text-xs font-mono border border-glomalin-border text-glomalin-muted hover:text-glomalin-text hover:border-glomalin-accent disabled:opacity-40 disabled:cursor-not-allowed rounded transition-colors"
      >
        Export CSV
      </button>
      <button
        onClick={handleExportPdf}
        disabled={disabled || pdfLoading}
        className="px-3 py-1.5 text-xs font-mono border border-glomalin-border text-glomalin-muted hover:text-glomalin-text hover:border-glomalin-accent disabled:opacity-40 disabled:cursor-not-allowed rounded transition-colors"
      >
        {pdfLoading ? 'Generating...' : 'Export PDF'}
      </button>
    </div>
  )
}
