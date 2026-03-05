'use client'

import { useState } from 'react'
import { CropTypeahead } from './crop-typeahead'
import { ConfirmDialog } from './confirm-dialog'

interface BulkActionBarProps {
  selectedCount: number
  onAction: (action: 'mark-reported' | 'mark-unreported' | 'assign-crop', crop?: string) => void
  onClear: () => void
}

export function BulkActionBar({ selectedCount, onAction, onClear }: BulkActionBarProps) {
  const [assignMode, setAssignMode] = useState(false)
  const [assignCrop, setAssignCrop] = useState('')
  const [confirmDialog, setConfirmDialog] = useState<{
    action: 'mark-reported' | 'mark-unreported'
    title: string
    message: string
  } | null>(null)

  const handleReportedClick = () => {
    setConfirmDialog({
      action: 'mark-reported',
      title: 'Mark as Reported',
      message: `Mark ${selectedCount} CLU${selectedCount !== 1 ? 's' : ''} as reported to FSA?`,
    })
  }

  const handleUnreportedClick = () => {
    setConfirmDialog({
      action: 'mark-unreported',
      title: 'Mark as Unreported',
      message: `Mark ${selectedCount} CLU${selectedCount !== 1 ? 's' : ''} as unreported?`,
    })
  }

  const handleConfirm = () => {
    if (confirmDialog) {
      onAction(confirmDialog.action)
      setConfirmDialog(null)
    }
  }

  const handleAssignConfirm = () => {
    if (assignCrop.trim()) {
      onAction('assign-crop', assignCrop.trim())
      setAssignMode(false)
      setAssignCrop('')
    }
  }

  const handleAssignCancel = () => {
    setAssignMode(false)
    setAssignCrop('')
  }

  return (
    <>
      {/* Confirm dialog */}
      {confirmDialog && (
        <ConfirmDialog
          open={true}
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      {/* Sticky bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-soil-surface border-t border-soil-accent px-6 py-3 flex items-center gap-4">
        {/* Selection count */}
        <span className="font-mono text-sm font-bold text-soil-accent flex-shrink-0">
          {selectedCount} selected
        </span>

        {assignMode ? (
          /* Assign crop inline flow */
          <>
            <div className="flex-1 max-w-xs">
              <CropTypeahead
                value={assignCrop}
                onChange={setAssignCrop}
                className="w-full"
              />
            </div>
            <button
              onClick={handleAssignConfirm}
              disabled={!assignCrop.trim()}
              className="font-mono text-sm font-bold bg-soil-accent text-soil-bg rounded px-4 py-1.5 hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              Assign
            </button>
            <button
              onClick={handleAssignCancel}
              className="font-mono text-sm text-soil-muted hover:text-soil-text transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          /* Normal action buttons */
          <>
            <button
              onClick={handleReportedClick}
              className="font-mono text-sm text-soil-green border border-soil-green/40 rounded px-3 py-1.5 hover:bg-soil-green/10 transition-colors"
            >
              Mark Reported
            </button>
            <button
              onClick={handleUnreportedClick}
              className="font-mono text-sm text-amber-400 border border-amber-800/40 rounded px-3 py-1.5 hover:bg-amber-950/30 transition-colors"
            >
              Mark Unreported
            </button>
            <button
              onClick={() => setAssignMode(true)}
              className="font-mono text-sm text-soil-text border border-soil-border rounded px-3 py-1.5 hover:border-soil-muted transition-colors"
            >
              Assign Crop
            </button>
            <button
              onClick={onClear}
              className="font-mono text-sm text-soil-muted hover:text-soil-text transition-colors ml-auto"
            >
              Clear
            </button>
          </>
        )}
      </div>
    </>
  )
}
