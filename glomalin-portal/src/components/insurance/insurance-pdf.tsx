// NO 'use client' directive — loaded via dynamic({ ssr: false }) from insurance-pdf-button.tsx
// This file and insurance-pdf-button.tsx are the ONLY files that import from @react-pdf/renderer.

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { computeInsurancePolicy, type InsurancePolicy, type PricingEntry } from '@/lib/fsa/calc'

// ===== Styles =====

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    paddingTop: 30,
    paddingBottom: 40,
    paddingLeft: 30,
    paddingRight: 30,
    fontSize: 9,
    backgroundColor: '#ffffff',
  },
  header: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
    color: '#333333',
  },
  generatedDate: {
    fontSize: 8,
    color: '#666666',
    marginBottom: 10,
  },
  subheader: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
    color: '#555555',
    marginTop: 12,
  },
  disclaimer: {
    fontSize: 7,
    color: '#888888',
    fontStyle: 'italic',
    marginTop: 10,
  },
  pageDisclaimer: {
    position: 'absolute',
    bottom: 16,
    left: 30,
    right: 30,
    fontSize: 7,
    color: '#888888',
    fontStyle: 'italic',
    borderTopWidth: 0.5,
    borderTopColor: '#cccccc',
    borderTopStyle: 'solid',
    paddingTop: 4,
  },
  // Table styles
  table: {
    flexDirection: 'column',
    borderWidth: 1,
    borderColor: '#cccccc',
    borderStyle: 'solid',
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
    borderBottomStyle: 'solid',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
    borderBottomStyle: 'solid',
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
    borderBottomStyle: 'solid',
    backgroundColor: '#fafafa',
  },
  cellBold: {
    fontFamily: 'Helvetica-Bold',
    padding: 4,
    fontSize: 8,
  },
  cell: {
    padding: 4,
    fontSize: 8,
  },
  cellRight: {
    padding: 4,
    fontSize: 8,
    textAlign: 'right',
  },
  cellRightBold: {
    fontFamily: 'Helvetica-Bold',
    padding: 4,
    fontSize: 8,
    textAlign: 'right',
  },
  // Policy table column widths
  colFarm: { flex: 1.5 },
  colCrop: { flex: 1 },
  colPlan: { flex: 0.8 },
  colCoverage: { flex: 0.7 },
  colAcres: { flex: 0.7 },
  colGuarantee: { flex: 0.8 },
  colActual: { flex: 0.8 },
  colAlert: { flex: 0.7 },
  // Matrix section
  policyLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: '#333333',
    marginTop: 8,
    marginBottom: 3,
  },
  // Coverage matrix columns
  colCovLevel: { width: 55 },
  colPlanType: { flex: 1 },
})

// ===== Coverage levels and plan types (mirrors CoverageMatrix component) =====

const COVERAGE_LEVELS = [50, 55, 60, 65, 70, 75, 80, 85] as const
const PLAN_TYPES = ['RP', 'RP-HPE', 'YP'] as const

function computeMatrixCell(
  policy: InsurancePolicy,
  pricing: PricingEntry[],
  coverage: number,
  planType: (typeof PLAN_TYPES)[number]
): number {
  let adjustedPricing = pricing
  if (planType === 'RP-HPE' || planType === 'YP') {
    adjustedPricing = pricing.map((p) => ({ ...p, fall_price: p.spring_price }))
  }
  const result = computeInsurancePolicy({ ...policy, coverage_level: coverage }, adjustedPricing)
  return result.indemnity
}

// ===== Helpers =====

function formatDollars(value: number): string {
  if (value <= 0) return '—'
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${Math.round(value / 1_000).toLocaleString()}K`
  return `$${Math.round(value).toLocaleString()}`
}

// ===== Page disclaimer footer (renders on every page) =====

function PageDisclaimer() {
  return (
    <Text style={styles.pageDisclaimer} fixed>
      This is a decision-support summary for producer records. It is not an official insurance
      document. Verify all figures with your insurance agent before making coverage decisions.
    </Text>
  )
}

// ===== Main Document =====

interface InsurancePdfDocumentProps {
  policies: InsurancePolicy[]
  pricing: PricingEntry[]
}

export function InsurancePdfDocument({ policies, pricing }: InsurancePdfDocumentProps) {
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const hasPricing = pricing.length > 0

  return (
    <Document>
      {/* ===== Page 1: Policy Summary ===== */}
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <Text style={styles.header}>Insurance Summary — 2026 Crop Year</Text>
        <Text style={styles.generatedDate}>Generated: {today}</Text>
        <Text style={styles.disclaimer}>
          This is a decision-support summary for producer records. It is not an official insurance
          document. Verify all figures with your insurance agent.
        </Text>

        {/* Policy table */}
        <View style={styles.table}>
          {/* Header row */}
          <View style={styles.tableHeader}>
            <Text style={[styles.cellBold, styles.colFarm]}>Farm</Text>
            <Text style={[styles.cellBold, styles.colCrop]}>Crop</Text>
            <Text style={[styles.cellBold, styles.colPlan]}>Plan Type</Text>
            <Text style={[styles.cellRightBold, styles.colCoverage]}>Coverage</Text>
            <Text style={[styles.cellRightBold, styles.colAcres]}>Planted Ac</Text>
            <Text style={[styles.cellRightBold, styles.colGuarantee]}>Guarantee</Text>
            <Text style={[styles.cellRightBold, styles.colActual]}>Actual</Text>
            <Text style={[styles.cellBold, styles.colAlert]}>Alert</Text>
          </View>

          {/* Policy rows */}
          {policies.map((policy, idx) => {
            const rowStyle = idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt
            return (
              <View key={policy.id} style={rowStyle} wrap={false}>
                <Text style={[styles.cell, styles.colFarm]}>
                  {policy.farm_name ?? '(no farm)'}
                </Text>
                <Text style={[styles.cell, styles.colCrop]}>{policy.crop ?? '(none)'}</Text>
                <Text style={[styles.cell, styles.colPlan]}>
                  {policy.plan_type ?? '—'}
                </Text>
                <Text style={[styles.cellRight, styles.colCoverage]}>
                  {policy.coverage_level}%
                </Text>
                <Text style={[styles.cellRight, styles.colAcres]}>
                  {policy.planted_acres.toFixed(1)}
                </Text>
                <Text style={[styles.cellRight, styles.colGuarantee]}>
                  {policy.guarantee > 0 ? policy.guarantee.toFixed(1) : '—'}
                </Text>
                <Text style={[styles.cellRight, styles.colActual]}>
                  {policy.actual > 0 ? policy.actual.toFixed(1) : '—'}
                </Text>
                <Text style={[styles.cell, styles.colAlert]}>
                  {policy.claim_alert === 'potential' ? 'Potential' : '—'}
                </Text>
              </View>
            )
          })}
        </View>

        <PageDisclaimer />
      </Page>

      {/* ===== Page 2: Coverage Matrix Snapshot (if pricing available) ===== */}
      {hasPricing && (
        <Page size="LETTER" orientation="landscape" style={styles.page}>
          <Text style={styles.header}>Coverage Level Comparison</Text>
          <Text style={styles.generatedDate}>Generated: {today}</Text>
          <Text style={styles.disclaimer}>
            Indemnity = shortfall bushels × price × planted acres. RP-HPE and YP use spring price.
            Figures are illustrative — verify with your agent.
          </Text>

          {policies.map((policy) => {
            const label = `${policy.farm_name ?? '(no farm)'} — ${policy.crop ?? '(no crop)'}`

            return (
              <View key={policy.id} wrap={false}>
                <Text style={styles.policyLabel}>{label}</Text>

                {/* Mini matrix table */}
                <View style={styles.table}>
                  {/* Header */}
                  <View style={styles.tableHeader}>
                    <Text style={[styles.cellBold, styles.colCovLevel]}>Coverage</Text>
                    {PLAN_TYPES.map((pt) => (
                      <Text key={pt} style={[styles.cellRightBold, styles.colPlanType]}>
                        {pt}
                      </Text>
                    ))}
                  </View>

                  {/* Rows */}
                  {COVERAGE_LEVELS.map((coverage, rowIdx) => {
                    const rowStyle = rowIdx % 2 === 0 ? styles.tableRow : styles.tableRowAlt
                    const isCurrentLevel = coverage === policy.coverage_level

                    return (
                      <View key={coverage} style={rowStyle}>
                        <Text
                          style={[
                            isCurrentLevel ? styles.cellBold : styles.cell,
                            styles.colCovLevel,
                          ]}
                        >
                          {coverage}%{isCurrentLevel ? ' *' : ''}
                        </Text>
                        {PLAN_TYPES.map((pt) => {
                          const indemnity = computeMatrixCell(policy, pricing, coverage, pt)
                          return (
                            <Text
                              key={pt}
                              style={[
                                indemnity > 0 ? styles.cellRightBold : styles.cellRight,
                                styles.colPlanType,
                              ]}
                            >
                              {formatDollars(indemnity)}
                            </Text>
                          )
                        })}
                      </View>
                    )
                  })}
                </View>

                {policy.plan_type && (
                  <Text style={{ fontSize: 7, color: '#666666', marginBottom: 4 }}>
                    * = current coverage level. Active plan: {policy.plan_type}
                  </Text>
                )}
              </View>
            )
          })}

          <PageDisclaimer />
        </Page>
      )}
    </Document>
  )
}
