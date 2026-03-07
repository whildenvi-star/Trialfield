'use client'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    /* Backdrop — above bulk action bar (z-50), below nothing */
    <div className="fixed inset-0 z-[60] bg-black/50" onClick={onCancel}>
      {/* Dialog card */}
      <div
        className="bg-glomalin-surface border border-glomalin-border rounded-lg p-6 max-w-sm mx-auto mt-[30vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-glomalin-text font-mono font-bold text-base mb-2">{title}</h2>
        <p className="text-glomalin-muted font-mono text-sm mb-6">{message}</p>
        <div className="flex items-center gap-3 justify-end">
          <button
            onClick={onCancel}
            className="font-mono text-sm text-glomalin-muted hover:text-glomalin-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="font-mono text-sm font-bold bg-glomalin-accent text-glomalin-bg rounded px-4 py-2 hover:opacity-90 transition-opacity"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}
