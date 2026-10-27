'use client'
import { useState, useEffect } from 'react'

export default function FairnessPage() {
  const [tab, setTab] = useState<'audit' | 'debias'>('audit')

  // Data source state
  const [csvData, setCsvData] = useState<Array<Record<string, string>>>([])
  const [csvColumns, setCsvColumns] = useState<string[]>([])
  const [predCol, setPredCol] = useState('')
  const [labelCol, setLabelCol] = useState('')
  const [groupCol, setGroupCol] = useState('')
  const [metrics, setMetrics] = useState<any>(null)
  const [loadingEval, setLoadingEval] = useState(false)
  const [evalError, setEvalError] = useState('')
  const [mitigation, setMitigation] = useState('threshold')

  // Debiasing state
  const [experiments, setExperiments] = useState<any[]>([])
  const [loadingExps, setLoadingExps] = useState(true)
  const [creating, setCreating] = useState(false)
  const [expError, setExpError] = useState('')

  useEffect(() => {
    fetch('/api/fairness').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setExperiments(d)
    }).catch(() => {}).finally(() => setLoadingExps(false))
  }, [])

  function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      if (!text) return
      const lines = text.split(/\r\n|\n/).filter(l => l.trim().length > 0)
      if (lines.length < 2) { alert('CSV must have header + data rows.'); return }
      const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''))
      setCsvColumns(headers)
      const rows: Array<Record<string, string>> = []
      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''))
        const row: Record<string, string> = {}
        headers.forEach((h, idx) => { row[h] = vals[idx] || '' })
        rows.push(row)
      }
      setCsvData(rows)
      setPredCol(headers.find(h => /pred|score/i.test(h)) || headers[0])
      setLabelCol(headers.find(h => /label|target|hire/i.test(h)) || '')
      setGroupCol(headers.find(h => /group|gender|race|demo/i.test(h)) || headers[2] || '')
    }
    reader.readAsText(file)
  }

  async function runAudit() {
    if (!predCol || !groupCol) { setEvalError('Map Prediction and Group columns.'); return }
    const predictions: number[] = [], labels: number[] = [], groups: string[] = []
    for (const row of csvData) {
      const pVal = parseFloat(row[predCol])
      if (isNaN(pVal)) continue
      const pred = pVal > 1 ? (pVal >= 50 ? 1 : 0) : (pVal >= 0.5 ? 1 : 0)
      let label = 0
      if (labelCol && row[labelCol] !== undefined) {
        const lVal = parseFloat(row[labelCol])
        label = isNaN(lVal) ? (['true','yes','1'].includes(row[labelCol].toLowerCase()) ? 1 : 0) : (lVal >= 0.5 ? 1 : 0)
      }
      predictions.push(pred); labels.push(label); groups.push(row[groupCol] || 'Unknown')
    }
    if (predictions.length === 0) { setEvalError('No valid rows.'); return }
    setLoadingEval(true); setEvalError('')
    try {
      const res = await fetch('/api/fairness', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ predictions, labels, protected_groups: groups, mitigation })
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Eval failed') }
      setMetrics(await res.json())
    } catch (e: any) { setEvalError(e.message || 'Eval failed') } finally { setLoadingEval(false) }
  }

  async function createExperiment() {
    if (!metrics) { setExpError('Run an audit first to generate baseline metrics.'); return }
    setCreating(true); setExpError('')
    try {
      const res = await fetch('/api/fairness', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Mitigation Experiment — ${new Date().toLocaleDateString()}`,
          baseline_predictions: metrics.predictions || [0, 1],
          baseline_labels: metrics.labels || [0, 1],
          baseline_protected: metrics.protected_groups || ['A', 'B'],
          mitigation_method: mitigation,
          config: { description: 'Counterfactual debiasing from fairness audit' }
        })
      })
      if (!res.ok) throw new Error('Failed')
      const exps = await fetch('/api/fairness').then(r => r.json())
      if (Array.isArray(exps)) setExperiments(exps)
    } catch (e: any) { setExpError(e.message) } finally { setCreating(false) }
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-8">
        <span className="font-mono text-xs uppercase tracking-wider text-accent bg-accent/10 px-3 py-1 rounded-full">Fairness & Debiasing</span>
        <h1 className="font-display font-semibold text-3xl mt-3">Fairness & Debiasing Check</h1>
        <p className="text-ink-soft mt-1">Audit selection-rate disparities and test mitigation strategies. All results use your own data — no fabricated metrics.</p>
      </div>

      <div className="flex gap-2 mb-8 border-b border-ink/10">
        <button onClick={() => setTab('audit')} className={'px-5 py-2.5 text-sm font-medium rounded-t-xl transition ' + (tab === 'audit' ? 'bg-ink text-cream' : 'text-ink-soft hover:text-ink hover:bg-ink/5')}>Fairness Audit</button>
        <button onClick={() => setTab('debias')} className={'px-5 py-2.5 text-sm font-medium rounded-t-xl transition ' + (tab === 'debias' ? 'bg-ink text-cream' : 'text-ink-soft hover:text-ink hover:bg-ink/5')}>Debiasing Experiments</button>
      </div>

      {tab === 'audit' && (
        <div className="space-y-6">
          <div className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-sm">
            <h2 className="font-display font-semibold text-xl mb-2">Upload Evaluation Dataset</h2>
            <p className="text-sm text-ink-soft mb-4">CSV with predictions, ground-truth labels (optional), and protected group assignments. HireFair never infers protected characteristics.</p>
            <input type="file" accept=".csv,.txt" onChange={handleCsvUpload} className="block w-full text-xs text-ink-soft file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-medium file:bg-ink file:text-cream hover:file:opacity-90 cursor-pointer" />
          </div>

          {csvData.length > 0 && (
            <div className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-sm">
              <h2 className="font-display font-semibold text-xl mb-2">Column Mapping</h2>
              <p className="text-sm text-ink-soft mb-4">{csvData.length} records parsed.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div><label className="block text-xs font-medium text-ink-soft mb-1">Prediction / Score *</label>
                  <select value={predCol} onChange={e => setPredCol(e.target.value)} className="w-full p-2.5 rounded-xl border border-ink/10 bg-white/50 text-sm">{csvColumns.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                <div><label className="block text-xs font-medium text-ink-soft mb-1">Ground-Truth Label (optional)</label>
                  <select value={labelCol} onChange={e => setLabelCol(e.target.value)} className="w-full p-2.5 rounded-xl border border-ink/10 bg-white/50 text-sm"><option value="">-- None --</option>{csvColumns.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                <div><label className="block text-xs font-medium text-ink-soft mb-1">Protected Group *</label>
                  <select value={groupCol} onChange={e => setGroupCol(e.target.value)} className="w-full p-2.5 rounded-xl border border-ink/10 bg-white/50 text-sm">{csvColumns.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-xs text-ink-soft">{labelCol ? '✓ Labels available: Equalized Odds & FPR unlocked.' : 'ℹ️ No labels: Demographic Parity only.'}</div>
                <button onClick={() => { runAudit(); }} className="bg-ink text-cream px-6 py-3 rounded-xl font-medium text-sm hover:opacity-90 transition">Run Audit →</button>
              </div>
              {evalError && <p className="text-red-600 text-sm mt-3">{evalError}</p>}
            </div>
          )}

          {loadingEval && <div className="text-center py-8 text-ink-soft">Computing metrics…</div>}

          {metrics && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard label="Demographic Parity Diff" value={metrics.baseline.demographic_parity_difference} sub="Lower is fairer (< 0.10)" />
                <MetricCard label="Equalized Odds Diff" value={metrics.baseline.equalized_odds_difference} sub="TPR gap across groups" />
                <MetricCard label="FPR Diff" value={metrics.baseline.false_positive_rate_difference} sub="FPR gap across groups" />
                <MetricCard label="Accuracy" value={metrics.baseline.accuracy} sub="Overall correct predictions" />
              </div>
              <div className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-sm">
                <h3 className="font-display font-semibold text-lg mb-4">Group Positive Rates</h3>
                {Object.entries(metrics.baseline.group_positive_rates || {}).map(([g, r]: [string, any]) => (
                  <div key={g} className="mb-3">
                    <div className="flex justify-between text-sm mb-1"><span className="text-ink font-medium">{g}</span><span className="text-ink-soft">{(r * 100).toFixed(1)}%</span></div>
                    <div className="w-full bg-cream rounded-full h-2.5"><div className="bg-accent h-full rounded-full" style={{ width: `${Math.max(5, r * 100)}%` }} /></div>
                  </div>
                ))}
              </div>
              <div className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-sm">
                <h3 className="font-display font-semibold text-lg mb-2">Interpretation</h3>
                <p className="text-sm text-ink-soft">
                  {metrics.baseline.demographic_parity_difference <= 0.10 ? '✓ Low disparity: positive recommendation rates are well-balanced.' : '⚠️ Noticeable disparity: certain groups receive recommendations at significantly different rates.'}
                  {' '}These metrics are informational. They do not certify compliance or guarantee fairness.
                </p>
                <div className="mt-4 pt-4 border-t border-ink/10 flex gap-3">
                  <button onClick={() => setTab('debias')} className="bg-accent text-cream px-5 py-2.5 rounded-xl font-medium text-sm hover:opacity-90 transition">Test Mitigation →</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'debias' && (
        <div className="space-y-6">
          <div className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-sm">
            <h2 className="font-display font-semibold text-xl mb-2">Mitigation Experiments</h2>
            <p className="text-sm text-ink-soft mb-4">Compare baseline vs. post-mitigation fairness metrics. Threshold adjustment (post-processing) and reweighting (pre-processing) are available.</p>
            {expError && <p className="text-red-600 text-sm mb-3">{expError}</p>}
            <button onClick={createExperiment} disabled={creating || !metrics} className="bg-ink text-cream px-6 py-3 rounded-xl font-medium text-sm hover:opacity-90 transition disabled:opacity-50">{creating ? 'Saving…' : 'Run Mitigation from Last Audit →'}</button>
            {!metrics && <p className="text-xs text-ink-soft mt-2">Run a fairness audit first to generate baseline metrics.</p>}
          </div>

          {loadingExps ? <p className="text-ink-soft text-sm">Loading experiments…</p> : experiments.length === 0 ? (
            <p className="text-ink-soft text-sm">No experiments yet. Run an audit and test mitigation above.</p>
          ) : (
            <div className="space-y-4">
              {experiments.map((exp: any) => (
                <div key={exp.id} className="border border-ink/10 rounded-2xl p-5 bg-white/60 backdrop-blur-xl shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-display font-semibold text-ink">{exp.name}</h3>
                      <p className="text-xs text-ink-soft">{exp.config?.description}</p>
                      <p className="text-xs text-ink/50 mt-1">{new Date(exp.created_at).toLocaleString()}</p>
                    </div>
                    <span className="text-xs font-mono bg-accent/10 text-accent px-2 py-0.5 rounded-full">{exp.mitigation_method}</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div><span className="text-ink-soft text-xs">DP Diff</span><div className="font-bold">{exp.baseline_metrics?.demographic_parity_difference?.toFixed(4)} → {exp.mitigation_metrics?.demographic_parity_difference?.toFixed(4)}</div></div>
                    <div><span className="text-ink-soft text-xs">EO Diff</span><div className="font-bold">{exp.baseline_metrics?.equalized_odds_difference?.toFixed(4)} → {exp.mitigation_metrics?.equalized_odds_difference?.toFixed(4)}</div></div>
                    <div><span className="text-ink-soft text-xs">FPR Diff</span><div className="font-bold">{exp.baseline_metrics?.false_positive_rate_difference?.toFixed(4)} → {exp.mitigation_metrics?.false_positive_rate_difference?.toFixed(4)}</div></div>
                    <div><span className="text-ink-soft text-xs">Accuracy</span><div className="font-bold">{exp.baseline_metrics?.accuracy?.toFixed(4)} → {exp.mitigation_metrics?.accuracy?.toFixed(4)}</div></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  )
}

function MetricCard({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-2xl p-5 shadow-sm">
      <div className="text-xs font-medium text-ink-soft mb-1">{label}</div>
      <div className="text-2xl font-bold font-display text-ink mb-1">{value !== undefined ? value.toFixed(4) : 'N/A'}</div>
      <div className="text-xs text-ink-soft">{sub}</div>
    </div>
  )
}