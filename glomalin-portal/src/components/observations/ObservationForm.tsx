'use client'

import { useRef, useState, useEffect } from 'react'
import { useObservationQueue } from '@/hooks/useObservationQueue'
import { SyncStatus } from './SyncStatus'

async function resizeImage(file: File, maxPx = 1200): Promise<Blob> {
  const img = await createImageBitmap(file)
  const scale = Math.min(maxPx / img.width, maxPx / img.height, 1)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return new Promise(resolve =>
    canvas.toBlob(blob => resolve(blob!), 'image/jpeg', 0.8)
  )
}

interface Feedback {
  type: 'success' | 'error'
  message: string
}

export function ObservationForm() {
  const photoRef = useRef<HTMLInputElement>(null)
  const [note, setNote] = useState('')
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const { submitObservation, pendingCount, isSyncing, lastSyncMessage } = useObservationQueue()

  // Show sync confirmation toast when background sync completes
  useEffect(() => {
    if (lastSyncMessage) {
      setFeedback({ type: 'success', message: lastSyncMessage })
      const timer = setTimeout(() => setFeedback(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [lastSyncMessage])

  // Revoke object URL on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Revoke previous preview URL
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }

    try {
      const blob = await resizeImage(file)
      const url = URL.createObjectURL(blob)
      setPhotoBlob(blob)
      setPreviewUrl(url)
    } catch {
      setFeedback({ type: 'error', message: 'Failed to process photo. Please try again.' })
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!note.trim() || isSubmitting) return

    setIsSubmitting(true)
    setFeedback(null)

    try {
      await submitObservation(note.trim(), photoBlob ?? undefined)
      setNote('')
      setPhotoBlob(null)
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
        setPreviewUrl(null)
      }
      if (photoRef.current) {
        photoRef.current.value = ''
      }
      setFeedback({
        type: 'success',
        message: navigator.onLine
          ? 'Observation submitted!'
          : 'Saved offline \u2014 will sync when connected',
      })
    } catch {
      setFeedback({ type: 'error', message: 'Failed to save observation' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Sync status banner — shows pending count or syncing indicator */}
      <SyncStatus pendingCount={pendingCount} isSyncing={isSyncing} />

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Hidden file input for camera/photo selection */}
        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={handlePhotoChange}
        />

        {/* Note textarea */}
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={4}
          placeholder="Describe what you observed in the field..."
          className="w-full rounded-lg border border-glomalin-border bg-glomalin-surface text-glomalin-text p-3 min-h-[120px] text-base resize-none focus:outline-none focus:ring-2 focus:ring-glomalin-accent"
        />

        {/* Attach photo button */}
        <button
          type="button"
          onClick={() => photoRef.current?.click()}
          className="w-full py-3 rounded-lg border border-glomalin-border text-glomalin-text font-mono text-sm hover:bg-glomalin-surface transition-colors"
        >
          {previewUrl ? 'Change Photo' : 'Attach Photo'}
        </button>

        {/* Photo preview thumbnail */}
        {previewUrl && (
          <img
            src={previewUrl}
            alt="Photo preview"
            className="w-full rounded-lg mt-2 object-cover max-h-64"
          />
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={!note.trim() || isSubmitting}
          className="w-full py-3 rounded-lg bg-glomalin-accent text-white font-bold text-base disabled:opacity-50 transition-opacity"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Observation'}
        </button>

        {/* Feedback messages */}
        {feedback && (
          <p
            className={`text-sm font-mono mt-2 ${
              feedback.type === 'success' ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {feedback.message}
          </p>
        )}
      </form>
    </div>
  )
}
