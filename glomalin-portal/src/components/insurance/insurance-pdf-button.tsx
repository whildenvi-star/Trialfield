// NO 'use client' directive — loaded via dynamic({ ssr: false }) from insurance-workspace.tsx
// This file and insurance-pdf.tsx are the ONLY files that import from @react-pdf/renderer.

import { PDFDownloadLink } from '@react-pdf/renderer'
import { InsurancePdfDocument } from './insurance-pdf'
import type { InsurancePolicy, PricingEntry } from '@/lib/fsa/calc'

interface InsurancePdfButtonProps {
  policies: InsurancePolicy[]
  pricing: PricingEntry[]
}

export function InsurancePdfButton({ policies, pricing }: InsurancePdfButtonProps) {
  return (
    <PDFDownloadLink
      document={<InsurancePdfDocument policies={policies} pricing={pricing} />}
      fileName="insurance-summary-2026.pdf"
    >
      {({ loading }) => (
        <button
          className="bg-glomalin-accent text-glomalin-bg px-4 py-2 rounded font-mono text-sm font-bold hover:opacity-90 disabled:opacity-50"
          disabled={loading}
          type="button"
        >
          {loading ? 'Generating...' : 'Export PDF'}
        </button>
      )}
    </PDFDownloadLink>
  )
}
