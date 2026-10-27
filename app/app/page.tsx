'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function Dashboard() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8 text-ink-soft">Loading dashboard…</div>
  if (!data) return <div className="p-8 text-red-600">Failed to load dashboard.</div>

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <h1 className="font-display font-semibold text-3xl mb-8">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard label="Total Screenings" value={data.total_screenings} />
        <StatCard label="Total Candidates" value={data.total_candidates} />
        <StatCard label="Avg. Score" value={data.avg_score} />
      </div>
      <div className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-2xl p-6">
        <h2 className="font-display font-semibold text-xl mb-4">Recent Screenings</h2>
        {data.recent_screenings.length === 0 ? (
          <p className="text-ink-soft text-sm">No screenings yet. <Link href="/app/screening" className="text-accent underline">Start one →</Link></p>
        ) : (
          <div className="space-y-3">
            {data.recent_screenings.map((s: any) => (
              <Link key={s.id} href={`/app/screening?view=${s.id}`} className="block p-4 rounded-xl border border-ink/10 hover:bg-ink/5 transition">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{s.job_title}</span>
                  <span className="text-sm text-ink-soft">{new Date(s.created_at).toLocaleDateString()}</span>
                </div>
                <span className="text-xs text-ink-soft">{s.candidate_count} candidates</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-2xl p-6 text-center">
      <div className="text-3xl font-bold text-ink">{value}</div>
      <div className="text-sm text-ink-soft mt-1">{label}</div>
    </div>
  )
}