'use client'

/**
 * DocumentUpload — react-dropzone upload zone with three-step signed URL flow.
 *
 * Three-step upload per Phase 31-02 locked decision:
 *   Step 1: POST /api/claims/[id]/upload-url   → server generates signed upload URL + token
 *   Step 2: supabase.storage.uploadToSignedUrl → client PUTs file bytes directly to Storage
 *   Step 3: POST /api/claims/[id]/documents    → client saves metadata (path, name, size, type)
 *
 * File bytes NEVER route through Next.js server actions (1MB limit — architectural constraint).
 * Signed token is always fresh — on retry, start from Step 1 for a new token.
 *
 * Accepts: PDF, JPG, PNG, WebP, XLSX, CSV — max 25MB per file.
 */

import { useDropzone } from 'react-dropzone'
import type { FileRejection } from 'react-dropzone'
import { createClient } from '@/lib/supabase/browser'
import { useState, useCallback } from 'react'
import type { ClaimDocument } from './claim-drawer'

const MAX_SIZE_BYTES = 25 * 1024 * 1024 // 25MB

// react-dropzone accept object — maps MIME type to allowed extensions
const ALLOWED_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'text/csv': ['.csv'],
}

interface DocumentUploadProps {
  claimId: string
  documents: ClaimDocument[]
  onUploadComplete: () => Promise<void>
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * DocumentUpload
 *
 * Props:
 *   claimId          — used for upload-url + documents API calls
 *   documents        — list state owned by ClaimDrawer, passed down (read-only here)
 *   onUploadComplete — callback that re-fetches document list from ClaimDrawer
 */
export function DocumentUpload({ claimId, documents, onUploadComplete }: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const onDrop = useCallback(
    async (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      setUploadError(null)

      if (rejectedFiles.length > 0) {
        const firstError = rejectedFiles[0]?.errors[0]?.message
        setUploadError(firstError ?? 'File rejected. Check type and size (max 25MB).')
        return
      }

      const file = acceptedFiles[0]
      if (!file) return

      // Redundant client-side size guard (explicit UX message before API call)
      if (file.size > MAX_SIZE_BYTES) {
        setUploadError(`File too large. Maximum size is 25MB. Your file: ${formatFileSize(file.size)}`)
        return
      }

      setUploading(true)

      try {
        // Step 1: Get signed upload URL from server
        const urlRes = await fetch(`/api/claims/${claimId}/upload-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, mimeType: file.type }),
        })
        if (!urlRes.ok) {
          const err = await urlRes.json().catch(() => ({}))
          throw new Error(err.error ?? 'Failed to get upload URL')
        }
        const { path, token } = await urlRes.json()

        // Step 2: Upload file bytes directly to Supabase Storage using signed URL
        // CRITICAL: token is single-use — never cache or reuse across retries
        const supabase = createClient()
        const { error: storageError } = await supabase.storage
          .from('claim-documents')
          .uploadToSignedUrl(path, token, file, { contentType: file.type })
        if (storageError) {
          throw new Error(storageError.message ?? 'Storage upload failed')
        }

        // Step 3: Save document metadata to server (triggers doc_upload timeline event)
        const metaRes = await fetch(`/api/claims/${claimId}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storagePath: path,
            filename: file.name,
            fileSize: file.size,
            mimeType: file.type,
          }),
        })
        if (!metaRes.ok) {
          const err = await metaRes.json().catch(() => ({}))
          throw new Error(err.error ?? 'Failed to save document metadata')
        }

        // Trigger ClaimDrawer to re-fetch document list
        await onUploadComplete()
      } catch (err) {
        setUploadError(
          err instanceof Error ? err.message : 'Upload failed. Please try again.',
        )
      } finally {
        setUploading(false)
      }
    },
    [claimId, onUploadComplete],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ALLOWED_TYPES,
    maxSize: MAX_SIZE_BYTES,
    maxFiles: 1,
    disabled: uploading,
  })

  return (
    <div className="flex-1 overflow-y-auto flex flex-col px-5 py-4">
      {/* Document list */}
      {documents.length === 0 ? (
        <p className="text-[#6a5a4a] font-mono text-xs mb-6">No documents uploaded yet.</p>
      ) : (
        <div className="mb-6 space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between py-2 border-b border-[#2a2218]"
            >
              <div className="flex-1 min-w-0">
                {doc.signedUrl ? (
                  <a
                    href={doc.signedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#C8860A] font-mono text-xs underline underline-offset-2 hover:opacity-80 transition-opacity truncate block"
                  >
                    {doc.filename}
                  </a>
                ) : (
                  <p className="text-[#e8d8c0] font-mono text-xs truncate">{doc.filename}</p>
                )}
                <p className="text-[#6a5a4a] font-mono text-xs mt-0.5">
                  {formatFileSize(doc.file_size)} ·{' '}
                  {new Date(doc.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* react-dropzone upload zone */}
      <div
        {...getRootProps()}
        className={[
          'border-2 border-dashed rounded p-6 text-center transition-colors cursor-pointer',
          isDragActive
            ? 'border-[#C8860A] bg-[#C8860A]/5'
            : 'border-[#2a2218] hover:border-[#6a5a4a]',
          uploading ? 'opacity-50 cursor-not-allowed' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <p className="text-[#6a5a4a] font-mono text-xs">Uploading...</p>
        ) : isDragActive ? (
          <p className="text-[#C8860A] font-mono text-xs">Drop the file here...</p>
        ) : (
          <>
            <p className="text-[#6a5a4a] font-mono text-xs mb-2">
              Drop a file here or click to select
            </p>
            <p className="text-[#6a5a4a] font-mono text-xs opacity-60">
              PDF, JPG, PNG, WebP, XLSX, CSV — max 25MB
            </p>
          </>
        )}
        {uploadError && (
          <p className="text-red-400 font-mono text-xs mt-3">{uploadError}</p>
        )}
      </div>
    </div>
  )
}
