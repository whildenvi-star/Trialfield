'use client'

import React from 'react'

interface SectionTableProps {
  headers: string[]
  rows: React.ReactNode[][]
  emptyMessage?: string
  className?: string
}

export function SectionTable({
  headers,
  rows,
  emptyMessage = 'No records',
  className = '',
}: SectionTableProps) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-xs font-mono">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className="bg-glomalin-surface text-glomalin-muted uppercase tracking-wider text-left px-3 py-2"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={headers.length}
                className="text-glomalin-muted text-center py-6 border-t border-glomalin-border"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className="border-t border-glomalin-border text-glomalin-text px-3 py-2 align-top"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
