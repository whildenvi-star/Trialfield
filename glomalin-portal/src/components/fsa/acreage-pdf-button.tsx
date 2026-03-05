// NO 'use client' directive — loaded via dynamic({ ssr: false }) from clu-workspace.tsx
// This file and acreage-pdf.tsx are the ONLY files that import from @react-pdf/renderer.

import { PDFDownloadLink } from '@react-pdf/renderer'
import { AcreagePdfDocument } from './acreage-pdf'
import type { CluRecord } from '@/lib/fsa/calc'

interface AcreagePdfButtonProps {
  records: CluRecord[]
}

export function AcreagePdfButton({ records }: AcreagePdfButtonProps) {
  return (
    <PDFDownloadLink
      document={<AcreagePdfDocument records={records} />}
      fileName="acreage-reporting-summary-2026.pdf"
    >
      {({ loading }) => (
        <button
          className="bg-soil-accent text-soil-bg px-4 py-2 rounded font-mono text-sm font-bold hover:opacity-90 disabled:opacity-50"
          disabled={loading}
          type="button"
        >
          {loading ? 'Generating...' : 'Export PDF'}
        </button>
      )}
    </PDFDownloadLink>
  )
}
