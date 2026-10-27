'use client'
import { useState } from 'react'
import FileUpload from '@/components/FileUpload'

const TEMPLATES = [
  { title: 'Software Engineer', desc: 'We are looking for a Software Engineer with 3+ years of experience in Python, React, and AWS. Responsibilities include building scalable web applications, collaborating with cross-functional teams, and writing clean, maintainable code. Requirements: BS in Computer Science, experience with REST APIs, and strong communication skills.' },
  { title: 'Data Scientist', desc: 'Seeking a Data Scientist to analyze large datasets, build ML models, and communicate insights. Requirements: Python, SQL, statistics, machine learning, TensorFlow or PyTorch. Must have experience with data visualization and stakeholder communication.' },
  { title: 'Product Manager', desc: 'Looking for a Product Manager to lead product strategy, work with engineering and design teams, and drive roadmap execution. Requirements: 5+ years PM experience, agile methodologies, strong analytical skills, and excellent communication.' },
]

export default function ScreeningPage() {
  const [jobTitle, setJobTitle] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  async function handleScreen() {
    if (!jobTitle || !jobDescription || files.length === 0) {
      setError('Please fill in job title, description, and at least one resume.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('job_title', jobTitle)
      formData.append('job_description', jobDescription)
      files.forEach((f) => formData.append('files', f))
      const res = await fetch('/api/screening', { method: 'POST', body: formData })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Screening failed')
      }
      const data = await res.json()
      setResult(data)
    } catch (e: any) {
      setError(e.message || 'Screening failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <h1 className="font-display font-semibold text-3xl mb-8">Resume Screening</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Job Info */}
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2 text-ink-soft">Job Title</label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Software Engineer"
              className="w-full p-3 rounded-xl border border-ink/10 bg-white/50 focus:outline-none focus:ring-2 focus:ring-accent/30 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-ink-soft">Job Description (plain text only)</label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste or type the job description here. No file data will be shown."
              className="w-full h-48 p-4 rounded-xl border border-ink/10 bg-white/50 resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-ink-soft">Templates</label>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.title}
                  onClick={() => { setJobTitle(t.title); setJobDescription(t.desc) }}
                  className="px-3 py-1.5 text-xs rounded-full border border-ink/10 hover:bg-ink/5 transition"
                >
                  {t.title}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Resumes */}
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2 text-ink-soft">Candidate Resumes (PDF/DOCX/TXT)</label>
            <FileUpload label="Upload resume files" onFilesSelected={setFiles} />
          </div>
          {files.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-ink-soft">{files.length} resume(s) selected</p>
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-ink/10 bg-white/50">
                  <span className="text-sm truncate max-w-xs">{f.name}</span>
                  <button onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))} className="text-xs text-red-600 hover:underline">Remove</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 flex items-center gap-4">
        <button
          onClick={handleScreen}
          disabled={loading}
          className="bg-ink text-cream px-6 py-3 rounded-xl font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {loading ? 'Screening…' : 'Run Screening →'}
        </button>
        {error && <p className="text-red-600 text-sm">{error}</p>}
      </div>

      {/* Results */}
      {result && (
        <div className="mt-10 space-y-6">
          <h2 className="font-display font-semibold text-2xl">Screening Results</h2>
          <p className="text-sm text-ink-soft">
            Scores reflect TF-IDF cosine similarity and skill overlap — not hiring probability or automatic decisions.
          </p>
          <div className="space-y-4">
            {result.candidates.map((c: any, i: number) => (
              <div key={c.id} className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-ink-soft">#{i + 1}</span>
                    <span className="font-medium">{c.filename}</span>
                  </div>
                  <span className={`text-2xl font-bold ${c.score >= 70 ? 'text-green-600' : c.score >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {c.score}
                  </span>
                </div>
                <p className="text-xs text-ink-soft mb-3">{c.explanation}</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium text-green-700 mb-1">Matched Skills ({c.matched_skills.length})</p>
                    <div className="flex flex-wrap gap-1">
                      {c.matched_skills.map((s: string) => (
                        <span key={s} className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">{s}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="font-medium text-red-700 mb-1">Missing Skills ({c.missing_skills.length})</p>
                    <div className="flex flex-wrap gap-1">
                      {c.missing_skills.map((s: string) => (
                        <span key={s} className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs">{s}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}