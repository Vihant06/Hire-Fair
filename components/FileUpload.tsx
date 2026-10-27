'use client'
import { useState, useRef } from 'react'

interface FileUploadProps {
  onFileContent: (content: string) => void
  label: string
}

export default function FileUpload({ onFileContent, label }: FileUploadProps) {
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setLoading(true)
    setFileName(file.name)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json()
      onFileContent(data.text)
    } catch (e) {
      alert('Failed to parse file. Please paste text manually.')
    } finally {
      setLoading(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition ${
        dragging ? 'border-accent bg-accent/5' : 'border-ink/20 hover:border-ink/40'
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".txt,.pdf,.docx,.doc"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />
      {loading ? (
        <p className="text-sm text-ink-soft">Parsing…</p>
      ) : fileName ? (
        <p className="text-sm text-ink">✓ {fileName}</p>
      ) : (
        <div>
          <p className="text-sm text-ink-soft">{label}</p>
          <p className="text-xs text-ink/50 mt-1">Drag & drop or click to upload (.txt, .pdf, .docx)</p>
        </div>
      )}
    </div>
  )
}