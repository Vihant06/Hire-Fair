'use client'
import { useState, useEffect } from 'react'

export default function FairnessPage() {
  const [tab, setTab] = useState<'audit' | 'evaluate'>('audit')
  const [screenings, setScreenings] = useState<any[]>([])
  const [selectedScreeningId, setSelectedScreeningId] = useState('')
  const [screeningDetails, setScreeningDetails] = useState<any>(null)
  const [loadingScreening, setLoadingScreening] = useState(false)

  // CSV upload state
  const [csvData, setCsvData] = useState<Array<Record<string, string>>>([])
  const [csvColumns, setCsvColumns] = useState<string[]>([])
  const [predCol, setPredCol] = useState('')
  const [labelCol, setLabelCol] = useState('')
  const [groupCol, setGroupCol] = useState('')

  // Evaluation results
  const [metrics, setMetrics] = useState<any>(null)
  const [loadingEval, setLoadingEval] = useState(false)
  const [evalError, setEvalError] = useState('')
  const [mitigation, setMitigation] = useState('none')

  useEffect(() => {
    fetch('/api/screening')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setScreenings(data)
      })
      .catch(err => console.error('Failed to load screenings', err))
  }, [])

  async function handleSelectScreening(id: string) {
    setSelectedScreeningId(id)
    if (!id) {
      setScreeningDetails(null)
      return
    }
    setLoadingScreening(true)
    try {
      const res = await fetch(`/api/screening?id=${id}`)
      if (res.ok) {
        const data = await res.json()
        setScreeningDetails(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingScreening(false)
    }
  }

  function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      if (!text) return
      const lines = text.split(/\r\n|\n/).filter(l => l.trim().length > 0)
      if (lines.length < 2) {
        alert('CSV must have a header row and at least one data row.')
        return
      }
      const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''))
      setCsvColumns(headers)

      const rows: Array<Record<string, string>> = []
      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''))
        const row: Record<string, string> = {}
        headers.forEach((h, idx) => {
          row[h] = vals[idx] || ''
        })
        rows.push(row)
      }
      setCsvData(rows)
      if (headers.length > 0) {
        setPredCol(headers.find(h => h.toLowerCase().includes('pred') || h.toLowerCase().includes('score')) || headers[0])
        setLabelCol(headers.find(h => h.toLowerCase().includes('label') || h.toLowerCase().includes('target') || h.toLowerCase().includes('hire')) || headers[1] || '')
        setGroupCol(headers.find(h => h.toLowerCase().includes('group') || h.toLowerCase().includes('gender') || h.toLowerCase().includes('race') || h.toLowerCase().includes('demographic')) || headers[2] || '')
      }
    }
    reader.readAsText(file)
  }

  async function runEvaluationFromCsv() {
    if (!predCol || !groupCol) {
      setEvalError('Please map at least the Prediction and Protected Group columns.')
      return
    }

    const predictions: number[] = []
    const labels: number[] = []
    const protectedGroups: string[] = []

    for (const row of csvData) {
      const pVal = parseFloat(row[predCol])
      if (isNaN(pVal)) continue
      // threshold prediction at >= 50 or 0.5 if raw score, or direct 0/1
      const pred = pVal > 1 ? (pVal >= 50 ? 1 : 0) : (pVal >= 0.5 ? 1 : 0)

      let label = 0
      if (labelCol && row[labelCol] !== undefined) {
        const lVal = parseFloat(row[labelCol])
        label = isNaN(lVal) ? (row[labelCol].toLowerCase() === 'true' || row[labelCol].toLowerCase() === 'yes' || row[labelCol] === '1' ? 1 : 0) : (lVal >= 0.5 ? 1 : 0)
      }

      const group = row[groupCol] || 'Unknown'

      predictions.push(pred)
      labels.push(label)
      protectedGroups.push(group)
    }

    if (predictions.length === 0) {
      setEvalError('No valid rows found after parsing CSV columns.')
      return
    }

    await submitEvaluation(predictions, labels, protectedGroups)
  }

  async function runEvaluationFromScreening() {
    if (!screeningDetails || !screeningDetails.candidates) return
    // For screening candidates, we use their score (>= 70 as 1) and prompt user or mock dummy labels if absent, or use match status.
    // Let's create a guided modal or prompt for protected groups if screening doesn't store them.
    // Since screening candidates don't store protected groups (privacy first!), we prompt or simulate group assignment for demonstration, or explain that screening runs lack protected group data by design for privacy.
    setEvalError('Screening runs contain candidate resumes and scores without protected group attributes (to protect privacy and prevent unlawful bias). Please upload an evaluation dataset CSV containing explicit group labels to audit fairness.')
  }

  async function submitEvaluation(predictions: number[], labels: number[], protectedGroups: string[]) {
    setLoadingEval(true)
    setEvalError('')
    try {
      const res = await fetch('/api/fairness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ predictions, labels, protected_groups: protectedGroups, mitigation })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Evaluation failed')
      }
      const data = await res.json()
      setMetrics(data)
    } catch (e: any) {
      setEvalError(e.message || 'Evaluation failed')
    } finally {
      setLoadingEval(false)
    }
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-8">
        <span className="font-mono text-xs uppercase tracking-wider text-accent bg-accent/10 px-3 py-1 rounded-full">
          Fairness Audit Workflows
        </span>
        <h1 className="font-display font-semibold text-3xl mt-3">Algorithmic Fairness Audit</h1>
        <p className="text-ink-soft mt-1">
          Evaluate whether your candidate screening or model predictions treat different demographic groups equitably.
        </p>
      </div>

      <div className="flex gap-2 mb-8 border-b border-ink/10">
        <button
          onClick={() => setTab('audit')}
          className={'px-5 py-2.5 text-sm font-medium rounded-t-xl transition ' + (tab === 'audit' ? 'bg-ink text-cream shadow-sm' : 'text-ink-soft hover:text-ink hover:bg-ink/5')}
        >
          1. Data Source & Mapping
        </button>
        <button
          onClick={() => setTab('evaluate')}
          className={'px-5 py-2.5 text-sm font-medium rounded-t-xl transition ' + (tab === 'evaluate' ? 'bg-ink text-cream shadow-sm' : 'text-ink-soft hover:text-ink hover:bg-ink/5')}
        >
          2. Metrics & Audit Report {metrics ? '✓' : ''}
        </button>
      </div>

      {tab === 'audit' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Step 1: Choose source */}
            <div className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-sm">
              <h2 className="font-display font-semibold text-xl mb-2">Select Evaluation Data Source</h2>
              <p className="text-sm text-ink-soft mb-6">
                Choose how to load your candidate predictions and protected group assignments.
              </p>

              <div className="space-y-4">
                <div className="border border-ink/10 rounded-xl p-4 bg-cream/30">
                  <h3 className="font-medium text-sm mb-2 text-ink">Option A: Upload Evaluation CSV</h3>
                  <p className="text-xs text-ink-soft mb-3">
                    Upload a CSV file containing columns for model predictions (or scores), ground-truth hiring outcomes (optional), and demographic/protected group labels.
                  </p>
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleCsvUpload}
                    className="block w-full text-xs text-ink-soft file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-medium file:bg-ink file:text-cream hover:file:opacity-90 cursor-pointer"
                  />
                </div>

                <div className="border border-ink/10 rounded-xl p-4 bg-cream/30">
                  <h3 className="font-medium text-sm mb-2 text-ink">Option B: Select Saved Screening Run</h3>
                  <p className="text-xs text-ink-soft mb-3">
                    Select a previously completed screening batch from your workspace.
                  </p>
                  <select
                    value={selectedScreeningId}
                    onChange={(e) => handleSelectScreening(e.target.value)}
                    className="w-full p-3 rounded-xl border border-ink/10 bg-white/50 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                  >
                    <option value="">-- Choose a screening run --</option>
                    {screenings.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.job_title} ({s.candidate_count} candidates, {new Date(s.created_at).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                  {selectedScreeningId && (
                    <button
                      onClick={runEvaluationFromScreening}
                      className="mt-3 text-xs bg-ink/10 hover:bg-ink/20 text-ink font-medium px-4 py-2 rounded-lg transition"
                    >
                      Inspect Screening Data →
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* CSV Column Mapping */}
            {csvData.length > 0 && (
              <div className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-sm">
                <h2 className="font-display font-semibold text-xl mb-2">Column Mapping & Validation</h2>
                <p className="text-sm text-ink-soft mb-6">
                  Successfully parsed {csvData.length} records. Map your CSV columns to audit variables.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="block text-xs font-medium text-ink-soft mb-1">Prediction / Score Col *</label>
                    <select
                      value={predCol}
                      onChange={(e) => setPredCol(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-ink/10 bg-white/50 text-sm"
                    >
                      {csvColumns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-soft mb-1">Ground-Truth Label Col (Optional)</label>
                    <select
                      value={labelCol}
                      onChange={(e) => setLabelCol(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-ink/10 bg-white/50 text-sm"
                    >
                      <option value="">-- None (Parity only) --</option>
                      {csvColumns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-soft mb-1">Protected Group Col *</label>
                    <select
                      value={groupCol}
                      onChange={(e) => setGroupCol(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-ink/10 bg-white/50 text-sm"
                    >
                      {csvColumns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-ink/10">
                  <div className="text-xs text-ink-soft">
                    {labelCol ? '✓ Ground truth available: Equalized Odds & FPR metrics unlocked.' : 'ℹ️ No ground truth: Demographic Parity & Selection Rate metrics unlocked.'}
                  </div>
                  <button
                    onClick={() => {
                      runEvaluationFromCsv()
                      setTab('evaluate')
                    }}
                    className="bg-ink text-cream px-6 py-3 rounded-xl font-medium text-sm hover:opacity-90 transition shadow-sm"
                  >
                    Run Fairness Audit →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar guidance */}
          <div className="space-y-6">
            <div className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-sm">
              <h3 className="font-display font-semibold text-lg mb-3">Privacy & Compliance</h3>
              <p className="text-xs text-ink-soft leading-relaxed mb-4">
                HireFair strictly respects candidate privacy. By default, resumes and screening results <strong>do not store or infer</strong> protected demographic characteristics (such as gender, race, or age).
              </p>
              <p className="text-xs text-ink-soft leading-relaxed">
                To perform a valid fairness audit, you must provide explicit group assignments from voluntary self-ID surveys or HRIS records.
              </p>
            </div>

            <div className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-sm">
              <h3 className="font-display font-semibold text-lg mb-3">Metrics Guide</h3>
              <ul className="space-y-3 text-xs text-ink-soft">
                <li>
                  <strong className="text-ink">Demographic Parity:</strong> Measures whether different demographic groups receive positive recommendations at similar rates.
                </li>
                <li>
                  <strong className="text-ink">Equalized Odds:</strong> Compares true positive rates across groups. Requires ground-truth hiring success labels.
                </li>
                <li>
                  <strong className="text-ink">False Positive Rate:</strong> Measures unjust rejections or false recommendations across groups.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {tab === 'evaluate' && (
        <div className="space-y-8">
          {evalError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {evalError}
              <div className="mt-2">
                <button
                  onClick={() => setTab('audit')}
                  className="text-xs font-medium underline text-red-800"
                >
                  ← Go back to Data Source & Mapping
                </button>
              </div>
            </div>
          )}

          {!metrics && !loadingEval && !evalError && (
            <div className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-2xl p-12 text-center">
              <h3 className="font-display font-semibold text-xl mb-2">No Audit Results Yet</h3>
              <p className="text-sm text-ink-soft max-w-md mx-auto mb-6">
                Please upload an evaluation dataset and map your columns in Step 1 to generate fairness metrics and visual breakdowns.
              </p>
              <button
                onClick={() => setTab('audit')}
                className="bg-ink text-cream px-6 py-3 rounded-xl font-medium text-sm hover:opacity-90 transition"
              >
                Go to Step 1: Data Source & Mapping →
              </button>
            </div>
          )}

          {loadingEval && (
            <div className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-2xl p-12 text-center">
              <div className="inline-block w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-sm text-ink-soft">Computing demographic parity, equalized odds, and group rates…</p>
            </div>
          )}

          {metrics && (
            <div className="space-y-8">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <ResultCard
                  label="Demographic Parity Diff"
                  value={metrics.baseline.demographic_parity_difference}
                  sub="Lower is fairer (target < 0.10)"
                  status={metrics.baseline.demographic_parity_difference <= 0.10 ? 'good' : 'warning'}
                />
                <ResultCard
                  label="Equalized Odds Diff"
                  value={metrics.baseline.equalized_odds_difference}
                  sub="TPR gap across groups"
                  status={metrics.baseline.equalized_odds_difference <= 0.10 ? 'good' : 'warning'}
                />
                <ResultCard
                  label="False Positive Rate Diff"
                  value={metrics.baseline.false_positive_rate_difference}
                  sub="FPR gap across groups"
                  status={metrics.baseline.false_positive_rate_difference <= 0.10 ? 'good' : 'warning'}
                />
                <ResultCard
                  label="Model Accuracy"
                  value={metrics.baseline.accuracy}
                  sub="Overall correct predictions"
                  status={metrics.baseline.accuracy >= 0.75 ? 'good' : 'warning'}
                />
              </div>

              {/* Group Breakdown */}
              <div className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-sm">
                <h2 className="font-display font-semibold text-xl mb-4">Group-by-Group Positive Rates</h2>
                <p className="text-sm text-ink-soft mb-6">
                  Percentage of candidates receiving a positive prediction (recommendation) broken down by protected group.
                </p>

                <div className="space-y-4">
                  {Object.entries(metrics.baseline.group_positive_rates || {}).map(([group, rate]: [string, any]) => {
                    const pct = (rate * 100).toFixed(1)
                    return (
                      <div key={group} className="space-y-1">
                        <div className="flex justify-between text-sm font-medium">
                          <span className="text-ink">{group}</span>
                          <span className="text-ink-soft">{pct}% recommended</span>
                        </div>
                        <div className="w-full bg-cream rounded-full h-3 overflow-hidden border border-ink/5">
                          <div
                            className="bg-accent h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(5, Math.min(100, rate * 100))}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Plain English Interpretation */}
              <div className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-sm">
                <h2 className="font-display font-semibold text-xl mb-3">Plain-English Interpretation</h2>
                <div className="space-y-3 text-sm text-ink-soft">
                  <p>
                    {metrics.baseline.demographic_parity_difference <= 0.10 ? (
                      <span className="text-green-700 font-medium">✓ Low Disparity: </span>
                    ) : (
                      <span className="text-amber-700 font-medium">⚠️ Noticeable Disparity: </span>
                    )}
                    The demographic parity difference is <strong className="text-ink">{metrics.baseline.demographic_parity_difference}</strong>.
                    {metrics.baseline.demographic_parity_difference <= 0.10
                      ? ' Positive recommendation rates are well-balanced across protected groups.'
                      : ' Certain groups receive recommendations at significantly higher rates than others, indicating potential disparate impact.'}
                  </p>
                  <p>
                    {metrics.baseline.accuracy >= 0.75 ? (
                      <span className="text-green-700 font-medium">✓ Strong Predictive Performance: </span>
                    ) : (
                      <span className="text-amber-700 font-medium">⚠️ Moderate Performance: </span>
                    )}
                    Overall model accuracy is <strong className="text-ink">{(metrics.baseline.accuracy * 100).toFixed(1)}%</strong>.
                  </p>
                </div>

                <div className="mt-6 pt-6 border-t border-ink/10 flex items-center justify-between">
                  <div className="text-xs text-ink-soft">
                    Ready to mitigate disparities? Test threshold adjustment or reweighting in Debiasing Experiments.
                  </div>
                  <a
                    href="/app/debiasing"
                    className="bg-accent text-cream px-5 py-2.5 rounded-xl font-medium text-sm hover:opacity-90 transition shadow-sm"
                  >
                    Go to Debiasing Experiments →
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  )
}

function ResultCard({ label, value, sub, status }: { label: string; value: number; sub: string; status: 'good' | 'warning' }) {
  const isGood = status === 'good'
  return (
    <div className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-2xl p-5 shadow-sm">
      <div className="text-xs font-medium text-ink-soft mb-1">{label}</div>
      <div className="text-2xl font-bold font-display text-ink mb-1">
        {value !== undefined ? value.toFixed(4) : 'N/A'}
      </div>
      <div className={'text-xs flex items-center gap-1 ' + (isGood ? 'text-green-700' : 'text-amber-700')}>
        <span>{sub}</span>
      </div>
    </div>
  )
}