'use client'
import { useState, useEffect } from 'react'

export default function DebiasingPage() {
  const [experiments, setExperiments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  // Guided workflow form state
  const [form, setForm] = useState({
    name: '',
    description: '',
    mitigation_method: 'threshold', // 'threshold' | 'reweight'
    // Preset evaluation data or custom csv string
    predictions: '1,0,1,1,0,0,1,1,0,1,0,1',
    labels: '1,0,1,0,0,0,1,1,0,1,0,0',
    protected_groups: 'Group A,Group A,Group A,Group A,Group A,Group A,Group B,Group B,Group B,Group B,Group B,Group B',
  })

  useEffect(() => {
    loadExperiments()
  }, [])

  async function loadExperiments() {
    try {
      const res = await fetch('/api/fairness')
      if (res.ok) {
        const data = await res.json()
        setExperiments(data)
      }
    } catch (e) {
      console.error('Failed to load experiments:', e)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateExperiment() {
    if (!form.name.trim()) {
      setError('Please provide an experiment name.')
      return
    }

    const preds = form.predictions.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
    const labs = form.labels.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
    const prot = form.protected_groups.split(',').map(s => s.trim()).filter(s => s)

    if (preds.length === 0 || labs.length === 0 || prot.length === 0) {
      setError('Prediction, label, and group arrays cannot be empty.')
      return
    }
    if (preds.length !== labs.length || preds.length !== prot.length) {
      setError('All data arrays must have equal length.')
      return
    }

    setCreating(true)
    setError('')
    try {
      const res = await fetch('/api/fairness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          baseline_predictions: preds,
          baseline_labels: labs,
          baseline_protected: prot,
          mitigation_method: form.mitigation_method,
          config: {
            description: form.description || 'Guided mitigation experiment',
          }
        })
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to create experiment')
      }

      await loadExperiments()
      setForm({
        name: '',
        description: '',
        mitigation_method: 'threshold',
        predictions: '1,0,1,1,0,0,1,1,0,1,0,1',
        labels: '1,0,1,0,0,0,1,1,0,1,0,0',
        protected_groups: 'Group A,Group A,Group A,Group A,Group A,Group A,Group B,Group B,Group B,Group B,Group B,Group B',
      })
    } catch (e: any) {
      setError(e.message || 'Failed to create experiment')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this experiment?')) return
    try {
      const res = await fetch(`/api/fairness?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        loadExperiments()
      }
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-8">
        <span className="font-mono text-xs uppercase tracking-wider text-accent bg-accent/10 px-3 py-1 rounded-full">
          Algorithmic Debiasing
        </span>
        <h1 className="font-display font-semibold text-3xl mt-3">Mitigation & Debiasing Experiments</h1>
        <p className="text-ink-soft mt-1">
          Test supported bias mitigation strategies (threshold adjustment and reweighting) to reduce disparate impact while preserving model accuracy.
        </p>
      </div>

      {/* Guided Create Experiment Card */}
      <div className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-sm mb-12">
        <h2 className="font-display font-semibold text-xl mb-2">Create New Mitigation Experiment</h2>
        <p className="text-sm text-ink-soft mb-6">
          Configure a debiasing run. HireFair computes baseline fairness metrics, applies the selected mitigation algorithm, and records a comparison summary.
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1">Experiment Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Engineering Candidate Screening v1.2"
              className="w-full p-3 rounded-xl border border-ink/10 bg-white/50 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1">Mitigation Strategy *</label>
            <select
              value={form.mitigation_method}
              onChange={(e) => setForm({ ...form, mitigation_method: e.target.value })}
              className="w-full p-3 rounded-xl border border-ink/10 bg-white/50 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              <option value="threshold">Threshold Adjustment (Post-processing)</option>
              <option value="reweight">Training-Data Reweighting (Pre-processing)</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-ink-soft mb-1">Description & Notes</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="e.g. Adjusted decision threshold to balance positive rates between Group A and Group B."
              className="w-full p-3 rounded-xl border border-ink/10 bg-white/50 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
        </div>

        {/* Data Inputs */}
        <div className="border-t border-ink/10 pt-6 mb-6">
          <h3 className="font-medium text-sm text-ink mb-2">Evaluation Dataset (Comma-Separated)</h3>
          <p className="text-xs text-ink-soft mb-4">
            Provide aligned arrays for model predictions (0/1), ground-truth labels (0/1), and protected group names.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Predictions (0 or 1)</label>
              <input
                type="text"
                value={form.predictions}
                onChange={(e) => setForm({ ...form, predictions: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-ink/10 bg-white/50 font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Ground-Truth Labels (0 or 1)</label>
              <input
                type="text"
                value={form.labels}
                onChange={(e) => setForm({ ...form, labels: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-ink/10 bg-white/50 font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Protected Group Labels</label>
              <input
                type="text"
                value={form.protected_groups}
                onChange={(e) => setForm({ ...form, protected_groups: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-ink/10 bg-white/50 font-mono text-xs"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleCreateExperiment}
            disabled={creating}
            className="bg-ink text-cream px-6 py-3 rounded-xl font-medium text-sm hover:opacity-90 transition shadow-sm disabled:opacity-50"
          >
            {creating ? 'Executing Mitigation & Saving…' : 'Run Mitigation Experiment →'}
          </button>
        </div>
      </div>

      {/* Saved Experiments Section */}
      <div className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-sm">
        <h2 className="font-display font-semibold text-xl mb-4">Saved Mitigation Experiments</h2>

        {loading ? (
          <p className="text-ink-soft text-sm">Loading experiments…</p>
        ) : experiments.length === 0 ? (
          <p className="text-ink-soft text-sm">No debiasing experiments recorded yet. Run your first experiment above.</p>
        ) : (
          <div className="space-y-6">
            {experiments.map((exp: any) => {
              const base = exp.baseline_metrics || {}
              const mit = exp.mitigation_metrics || {}
              const imp = exp.improvement || {}

              return (
                <div key={exp.id} className="border border-ink/10 rounded-2xl p-6 bg-cream/20 shadow-sm space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-display font-semibold text-lg text-ink">{exp.name}</h3>
                        <span className="text-xs font-mono uppercase bg-accent/10 text-accent px-2.5 py-0.5 rounded-full">
                          {exp.mitigation_method || 'threshold'}
                        </span>
                      </div>
                      <p className="text-xs text-ink-soft mt-1">{exp.config?.description || 'No description provided.'}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-ink-soft font-mono">
                        {new Date(exp.created_at).toLocaleString()}
                      </span>
                      <button
                        onClick={() => handleDelete(exp.id)}
                        className="text-xs text-red-600 hover:text-red-800 font-medium px-3 py-1 rounded-lg border border-red-200 bg-white/50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Metrics Comparison Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t border-ink/10">
                    <MetricDiff
                      label="Demographic Parity Diff"
                      baseline={base.demographic_parity_difference}
                      mitigated={mit.demographic_parity_difference}
                      reduction={imp.dp_diff_reduction}
                      lowerBetter
                    />
                    <MetricDiff
                      label="Equalized Odds Diff"
                      baseline={base.equalized_odds_difference}
                      mitigated={mit.equalized_odds_difference}
                      reduction={imp.eo_diff_reduction}
                      lowerBetter
                    />
                    <MetricDiff
                      label="False Positive Rate Diff"
                      baseline={base.false_positive_rate_difference}
                      mitigated={mit.false_positive_rate_difference}
                      reduction={imp.fpr_diff_reduction}
                      lowerBetter
                    />
                    <MetricDiff
                      label="Model Accuracy"
                      baseline={base.accuracy}
                      mitigated={mit.accuracy}
                      reduction={imp.accuracy_change}
                      isAccuracy
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}

function MetricDiff({ label, baseline, mitigated, reduction, lowerBetter, isAccuracy }: any) {
  if (baseline === undefined || mitigated === undefined) return null

  const diff = mitigated - baseline
  const improved = isAccuracy ? diff >= 0 : diff < 0

  return (
    <div className="bg-white/60 rounded-xl p-4 border border-ink/5">
      <div className="text-xs text-ink-soft mb-1">{label}</div>
      <div className="text-lg font-bold font-display text-ink flex items-baseline gap-2">
        <span>{baseline.toFixed(3)}</span>
        <span className="text-xs text-ink-soft font-normal">→</span>
        <span>{mitigated.toFixed(3)}</span>
      </div>
      <div className={'text-xs mt-1 font-medium ' + (improved ? 'text-green-700' : 'text-amber-700')}>
        {isAccuracy ? (diff >= 0 ? `+${(diff * 100).toFixed(1)}% accuracy` : `${(diff * 100).toFixed(1)}% accuracy`) : (diff <= 0 ? `Reduced by ${Math.abs(diff).toFixed(3)}` : `Increased by ${Math.abs(diff).toFixed(3)}`)}
      </div>
    </div>
  )
}