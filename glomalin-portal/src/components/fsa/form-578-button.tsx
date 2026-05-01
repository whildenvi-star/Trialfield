// NO 'use client' — loaded via dynamic({ ssr: false }) from parent components.
// Only form-578-pdf.tsx and this file import from @react-pdf/renderer.

import { PDFDownloadLink } from '@react-pdf/renderer'
import { Form578Document } from './form-578-pdf'
import type { CluRecord } from '@/lib/fsa/calc'

interface Form578ButtonProps {
  records: CluRecord[]
  cropYear: number
  confirmedOnly?: boolean
}

export function Form578Button({ records, cropYear, confirmedOnly = true }: Form578ButtonProps) {
  const confirmedCount = records.filter((r) => r.reported).length
  const label = confirmedOnly
    ? `Export 578 PDF (${confirmedCount} confirmed)`
    : `Export 578 PDF (all ${records.length})`

  return (
    <PDFDownloadLink
      document={
        <Form578Document
          records={records}
          cropYear={cropYear}
          confirmedOnly={confirmedOnly}
        />
      }
      fileName={`fsa-578-crop-year-${cropYear}.pdf`}
    >
      {({ loading }) => (
        <button
          disabled={loading || (confirmedOnly && confirmedCount === 0)}
          type="button"
          className="px-3 py-1.5 rounded border border-glomalin-accent text-glomalin-accent text-xs font-mono hover:bg-glomalin-accent/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Generating PDF...' : label}
        </button>
      )}
    </PDFDownloadLink>
  )
}
