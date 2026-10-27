'use client'
import { useState } from 'react'

export default function FairnessPage() {
  const [tab, setTab] = useState('overview')
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [predictions, setPredictions] = useState('')
  const [labels, setLabels] = useState('')
  const [protectedGroups, setProtectedGroups] = useState('')
  const [mitigation, setMitigation] = useState('threshold')

  async function handleEvaluate() {
    try {
      const preds = predictions.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
      const labs = labels.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
      const prot = protectedGroups.split(',').map(s => s.trim()).filter(s => s)

      if (preds.length === 0 || labs.length === 0 || prot.length === 0) {
        setError('All fields required. Use comma-separated values.')
        return
      }
      if (preds.length !== labs.length || preds.length !== prot.length) {
        setError('All arrays must have equal length')
        return
      }
      if (!preds.every(p => p === 0 || p === 1) || !labs.every(l => l === 0 || l === 1)) {
        setError('Predictions and labels must be 0 or 1 only')
        return
      }

      setLoading(true)
      setError('')
      const res = await fetch('/api/fairness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ predictions: preds, labels: labs, protected_groups: prot, mitigation })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Evaluation failed')
      }
      const data = await res.json()
      setMetrics(data)
    } catch (e: any) {
      setError(e.message || 'Evaluation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <h1 className="font-display font-semibold text-3xl mb-8">Fairness Audit</h1>

      <div className="flex gap-1 mb-8 border-b border-ink/10">
        <button
          onClick={() => setTab('overview')}
          className={'px-4 py-2 text-sm font-medium rounded-t-xl transition ' + (tab === 'overview' ? 'bg-ink text-cream' : 'text-ink-soft hover:text-ink hover:bg-ink/5')}
        >
          Overview and Metrics
        </button>
        <button
          onClick={() => setTab('evaluate')}
          className={'px-4 py-2 text-sm font-medium rounded-t-xl transition ' + (tab === 'evaluate' ? 'bg-ink text-cream' : 'text-ink-soft hover:text-ink hover:bg-ink/5')}
        >
          Run Evaluation
        </button>
      </div>

      {tab === 'overview' && (
        <div className="space-y-8">
          <div className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-2xl p-6">
            <h2 className="font-display font-semibold text-xl mb-4">What This Audit Measures</h2>
            <p className="text-ink-soft mb-6">
              Fairness audits evaluate whether your screening model treats different demographic groups equitably.
              This requires ground-truth labels (hiring outcomes) and protected group assignments — which you must provide.
              HireFair does not infer protected characteristics from names or resume content.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <MetricBox
                title="Demographic Parity"
                desc="Difference in positive prediction rates between groups. Lower = more fair."
                formula="max(P(Yhat=1|G=g)) - min(P(Yhat=1|G=g))"
              />
              <MetricBox
                title="Equalized Odds"
                desc="Difference in true positive rates across groups. Requires outcome labels."
                formula="max(TPR_g) - min(TPR_g)"
              />
              <MetricBox
                title="False Positive Rate"
                desc="Difference in false positive rates. Lower = fewer unjust rejections per group."
                formula="max(FPR_g) - min(FPR_g)"
              />
            </div>
          </div>

          <div className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-2xl p-6">
            <h2 className="font-display font-semibold text-xl mb-4">Data Requirements</h2>
            <ul className="space-y-3 text-ink-soft text-sm">
              <li>Predictions: Binary model outputs (1 = recommended, 0 = not recommended)</li>
              <li>Labels: Ground-truth outcomes (1 = hired/successful, 0 = not hired)</li>
              <li>Protected groups: Demographic assignments per candidate</li>
              <li>All three arrays must be equal length and aligned by candidate index</li>
              <li>Minimum 30 candidates per group for statistical validity</li>
            </ul>
            <p className="text-xs text-ink/50 mt-4">
              Note: For NYC Local Law 144 compliance, an independent third-party audit is required annually.
              This tool provides metrics for internal monitoring only.
            </p>
          </div>

          <div className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-2xl p-6">
            <h2 className="font-display font-semibold text-xl mb-4">Interpretation Guide</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink/10">
                  <th className="text-left py-2">Metric</th>
                  <th className="text-left py-2">Good</th>
                  <th className="text-left py-2">Concerning</th>
                  <th className="text-left py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-ink/5">
                  <td className="py-2 font-medium">Demographic Parity</td>
                  <td className="py-2 text-green-600">less than 0.10</td>
                  <td className="py-2 text-red-600">greater than 0.20</td>
                  <td className="py-2">Review selection criteria</td>
                </tr>
                <tr className="border-b border-ink/5">
                  <td className="py-2 font-medium">Equalized Odds</td>
                  <td className="py-2 text-green-600">less than 0.10</td>
                  <td className="py-2 text-red-600">greater than 0.20</td>
                  <td className="py-2">Check for proxy variables</td>
                </tr>
                <tr>
                  <td className="py-2 font-medium">Accuracy</td>
                  <td className="py-2 text-green-600">greater than 0.80</td>
                  <td className="py-2 text-red-600">less than 0.60</td>
                  <td className="py-2">Improve model features</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'evaluate' && (
        <div className="max-w-3xl space-y-6">
          <div className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-2xl p-6">
            <h2 className="font-display font-semibold text-xl mb-4">Run Fairness Evaluation</h2>
            <p className="text-sm text-ink-soft mb-6">
              Enter comma-separated values. All arrays must be equal length. Use 0/1 for predictions and labels.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-ink-soft">Predictions (0/1)</label>
                <textarea
                  value={predictions}
                  onChange={(e) => setPredictions(e.target.value)}
                  placeholder="1,0,1,1,0,0,1,0,1,0"
                  className="w-full h-20 p-3 rounded-xl border border-ink/10 bg-white/50 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-ink-soft">Labels (0/1)</label>
                <textarea
                  value={labels}
                  onChange={(e) => setLabels(e.target.value)}
                  placeholder="1,0,1,0,0,0,1,0,1,0"
                  className="w-full h-20 p-3 rounded-xl border border-ink/10 bg-white/50 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-ink-soft">Protected Groups</label>
                <textarea
                  value={protectedGroups}
                  onChange={(e) => setProtectedGroups(e.target.value)}
                  placeholder="male,female,male,female,male,female,male,female,male,female"
                  className="w-full h-20 p-3 rounded-xl border border-ink/10 bg-white/50 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-ink-soft">Mitigation Method</label>
                <select
                  value={mitigation}
                  onChange={(e) => setMitigation(e.target.value)}
                  className="w-full p-3 rounded-xl border border-ink/10 bg-white/50 focus:outline-none focus:ring-2 focus:ring-accent/30"
                >
                  <option value="none">None (baseline only)</option>
                  <option value="threshold">Threshold adjustment (equalize positive rates)</option>
                  <option value="reweight">Reweighting (adjust near-boundary decisions)</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex gap-4">
              <button
                onClick={handleEvaluate}
                disabled={loading}
                className="bg-ink text-cream px-6 py-3 rounded-xl font-medium hover:opacity-90 transition disabled:opacity-50"
              >
                {loading ? 'Evaluating…' : 'Run Evaluation →'}
              </button>
              {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
            </div>
          </div>

          {metrics && (
            <div className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-2xl p-6">
              <h2 className="font-display font-semibold text-xl mb-4">Results</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <ResultCard label="Dem. Parity" baseline={metrics.baseline.demographic_parity_difference} mitigated={metrics.mitigation.demographic_parity_difference} lowerBetter />
                <ResultCard label="Eq. Odds" baseline={metrics.baseline.equalized_odds_difference} mitigated={metrics.mitigation.equalized_odds_difference} lowerBetter />
                <ResultCard label="FPR Diff" baseline={metrics.baseline.false_positive_rate_difference} mitigated={metrics.mitigation.false_positive_rate_difference} lowerBetter />
                <ResultCard label="Accuracy" baseline={metrics.baseline.accuracy} mitigated={metrics.mitigation.accuracy} higherBetter />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium text-sm mb-2">Group Positive Rates</h3>
                  <div className="space-y-1 text-sm">
                    {Object.entries(metrics.baseline.group_positive_rates).map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-ink-soft">{k}</span>
                        <span>{(v as number * 100).toFixed(1)}% to {(metrics.mitigation.group_positive_rates[k] * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="font-medium text-sm mb-2">Group TPR</h3>
                  <div className="space-y-1 text-sm">
                    {Object.entries(metrics.baseline.group_tpr).map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-ink-soft">{k}</span>
                        <span>{(v as number * 100).toFixed(1)}% to {(metrics.mitigation.group_tpr[k] * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 p-4 bg-accent/10 rounded-xl">
                <p className="text-sm text-ink">
                  Improvement: DP diff reduced by {metrics.improvement.dp_diff_reduction.toFixed(4)},
                  EO diff reduced by {metrics.improvement.eo_diff_reduction.toFixed(4)},
                  Accuracy change: {metrics.improvement.accuracy_change >= 0 ? '+' : ''}{metrics.improvement.accuracy_change.toFixed(4)}.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  )
}

function MetricBox({ title, desc, formula }: { title: string; desc: string; formula: string }) {
  return (
    <div className="bg-cream/50 rounded-xl p-4">
      <h3 className="font-medium text-ink mb-1">{title}</h3>
      <p className="text-xs text-ink-soft mb-2">{desc}</p>
      <code className="text-xs bg-ink/5 px-2 py-0.5 rounded">{formula}</code>
    </div>
  )
}

function ResultCard({ label, baseline, mitigated, lowerBetter, higherBetter }: any) {
  const improvement = lowerBetter ? baseline - mitigated : mitigated - baseline
  const better = improvement > 0
  return (
    <div className="bg-cream/50 rounded-xl p-4 text-center">
      <div className="text-xs text-ink-soft mb-1">{label}</div>
      <div className="text-2xl font-bold text-ink">{baseline.toFixed(3)} to {mitigated.toFixed(3)}</div>
      <div className={'text-xs mt-1 ' + (better ? 'text-green-600' : 'text-red-600')}>
        {improvement >= 0 ? 'down ' : 'up '} {Math.abs(improvement).toFixed(4)}
      </div>
    </div>
  )
}