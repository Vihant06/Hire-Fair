'use client'
import { useState, useRef } from 'react'

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void
  label: string
  accept?: string
  maxSizeMB?: number
}

export default function FileUpload({ onFilesSelected, label, accept = '.pdf,.docx,.doc,.txt', maxSizeMB = 5 }: FileUploadProps) {
  const [dragging, setDragging] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function validateAndAdd(files: FileList | File[]) {
    const fileArray = Array.from(files)
    const valid: File[] = []
    let err = ''
    for (const f of fileArray) {
      if (f.size > maxSizeMB * 1024 * 1024) {
        err = `${f.name} exceeds ${maxSizeMB}MB limit`
        continue
      }
      const ext = f.name.split('.').pop()?.toLowerCase()
      if (!['pdf', 'docx', 'doc', 'txt'].includes(ext || '')) {
        err = `${f.name} is not a supported file type`
        continue
      }
      valid.push(f)
    }
    if (err) setError(err)
    else setError('')
    const updated = [...selectedFiles, ...valid]
    setSelectedFiles(updated)
    onFilesSelected(updated)
  }

  function removeFile(i: number) {
    const updated = selectedFiles.filter((_, idx) => idx !== i)
    setSelectedFiles(updated)
    onFilesSelected(updated)
  }

  return (
    <div className="space-y-3">
      <div
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
          dragging ? 'border-accent bg-accent/5' : 'border-ink/20 hover:border-ink/40'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) validateAndAdd(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files?.length) validateAndAdd(e.target.files) }}
        />
        <p className="text-sm text-ink-soft">{label}</p>
        <p className="text-xs text-ink/50 mt-1">Drag & drop or click to upload (PDF, DOCX, TXT — max {maxSizeMB}MB each)</p>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          {selectedFiles.map((f, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-ink/10 bg-white/50">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-ink-soft" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-sm truncate max-w-xs">{f.name}</span>
                <span className="text-xs text-ink-soft">({(f.size / 1024).toFixed(1)} KB)</span>
              </div>
              <button onClick={() => removeFile(i)} className="text-xs text-red-600 hover:underline">Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}