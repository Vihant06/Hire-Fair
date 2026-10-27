'use client'
import { useState } from 'react'
import type { BiasAuditRequest, BiasAuditResponse } from '@/lib/types'

export default function Home() {
  const [jobDescription, setJobDescription] = useState('')
  const [resume, setResume] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BiasAuditResponse | null>(null)
  const [error, setError] = useState('')

  async function handleAudit() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription, resume } as BiasAuditRequest),
      })
      if (!res.ok) throw new Error('Audit failed')
      const data: BiasAuditResponse = await res.json()
      setResult(data)
    } catch (e) {
      setError('Failed to run audit. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-cream text-ink">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-2 font-display font-bold text-lg tracking-wider">
          <svg className="w-5 h-5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="12" cy="12" r="9"/>
            <path d="M12 7 L14.5 12 L12 17 L9.5 12 Z" fill="currentColor" stroke="none"/>
          </svg>
          HireFair
        </div>
        <div className="flex items-center gap-6 text-sm text-ink-soft">
          <a href="#" className="hover:text-ink transition">Research</a>
          <a href="#" className="hover:text-ink transition">Methodology</a>
          <a href="#" className="hover:text-ink transition">Resources</a>
          <button className="bg-ink text-cream px-4 py-2 rounded-full text-sm font-medium hover:opacity-90 transition">
            Run bias scan →
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center text-center px-6 pt-16 pb-24">
        <div className="font-mono text-xs tracking-[0.26em] uppercase text-ink-soft mb-6 flex items-center gap-4">
          <span className="w-7 h-px bg-accent" />
          Debiasing NLP for hiring
          <span className="w-7 h-px bg-accent" />
        </div>
        <h1 className="font-display font-semibold text-5xl md:text-7xl leading-none tracking-tight max-w-4xl">
          Fair models make <span className="text-accent">fair hires.</span>
        </h1>
        <p className="text-ink-soft text-lg max-w-xl mt-6">
          Audit, measure, and mitigate bias in your resume screening pipeline — before it shapes who gets hired.
        </p>

        {/* Audit Form */}
        <div className="w-full max-w-2xl mt-12 bg-white/60 backdrop-blur-xl border border-white/50 rounded-3xl p-6 shadow-2xl">
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2 text-ink-soft">Job Description</label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste your job description here…"
              className="w-full h-32 p-4 rounded-xl border border-ink/10 bg-cream/50 resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 text-sm"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2 text-ink-soft">Resume (optional)</label>
            <textarea
              value={resume}
              onChange={(e) => setResume(e.target.value)}
              placeholder="Paste a sample resume for counterfactual testing…"
              className="w-full h-24 p-4 rounded-xl border border-ink/10 bg-cream/50 resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 text-sm"
            />
          </div>
          <button
            onClick={handleAudit}
            disabled={loading || !jobDescription}
            className="w-full bg-ink text-cream py-3 rounded-xl font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? 'Auditing…' : 'Run bias scan →'}
          </button>
          {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
        </div>

        {/* Results */}
        {result && (
          <div className="w-full max-w-2xl mt-8 bg-white/60 backdrop-blur-xl border border-white/50 rounded-3xl p-6 shadow-2xl text-left">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display font-semibold text-2xl">Audit Results</h2>
              <div className={`text-2xl font-bold ${result.overallScore >= 80 ? 'text-green-600' : result.overallScore >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                {result.overallScore}/100
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <MetricCard label="Gender-coded" value={result.metrics.genderCodedWords} />
              <MetricCard label="Name proxy" value={result.metrics.nameProxyRisk} />
              <MetricCard label="Edu proxy" value={result.metrics.educationProxyRisk} />
              <MetricCard label="Age proxy" value={result.metrics.ageProxyRisk} />
            </div>

            {/* Compliance */}
            <div className="flex gap-4 mb-6 text-sm">
              <div className={`px-3 py-1 rounded-full ${result.compliance.nycLL144Ready ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                NYC LL144: {result.compliance.nycLL144Ready ? 'Ready' : 'Needs work'}
              </div>
              <div className={`px-3 py-1 rounded-full ${result.compliance.eeocRisk === 'low' ? 'bg-green-100 text-green-700' : result.compliance.eeocRisk === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                EEOC Risk: {result.compliance.eeocRisk}
              </div>
            </div>

            {/* Findings */}
            <div className="space-y-3">
              {result.findings.map((f, i) => (
                <div key={i} className="border border-ink/10 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{f.category}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      f.severity === 'high' ? 'bg-red-100 text-red-700' :
                      f.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {f.severity}
                    </span>
                  </div>
                  <p className="text-sm text-ink-soft mb-2">{f.description}</p>
                  <p className="text-xs text-ink/70 italic">→ {f.mitigation}</p>
                </div>
              ))}
            </div>

            {/* Rewritten JD */}
            {result.rewrittenJobDescription && (
              <div className="mt-6 p-4 bg-cream/50 rounded-xl">
                <h3 className="font-medium text-sm mb-2">Rewritten Job Description</h3>
                <p className="text-sm text-ink-soft whitespace-pre-wrap">{result.rewrittenJobDescription}</p>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-cream/50 rounded-xl p-3 text-center">
      <div className="text-2xl font-bold text-ink">{value}</div>
      <div className="text-xs text-ink-soft mt-1">{label}</div>
    </div>
  )
}