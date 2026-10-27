'use client'
import { useState, useEffect } from 'react'

export default function DebiasingPage() {
  const [experiments, setExperiments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const [form, setForm] = useState({
    name: '',
    baseline_predictions: '',
    baseline_labels: '',
    baseline_protected: '',
    mitigation_predictions: '',
    mitigation_labels: '',
    mitigation_protected: '',
    mitigation_method: 'threshold',
    config: {
      description: '',
      notes: ''
    }
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

  async function handleCreate() {
    if (!form.name) {
      alert('Experiment name required')
      return
    }

    setCreating(true)
    try {
      const res = await fetch('/api/fairness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          config: form.config,
          baseline_predictions: form.baseline_predictions.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)),
          baseline_labels: form.baseline_labels.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)),
          baseline_protected: form.baseline_protected.split(',').map(s => s.trim()).filter(s => s),
          mitigation_predictions: form.mitigation_predictions.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)),
          mitigation_labels: form.mitigation_labels.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)),
          mitigation_protected: form.mitigation_protected.split(',').map(s => s.trim()).filter(s => s),
          mitigation_method: form.mitigation_method,
        })
      })
      if (!res.ok) throw new Error('Failed to create')
      loadExperiments()
      resetForm()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setCreating(false)
    }
  }

  function resetForm() {
    setForm({
      name: '',
      baseline_predictions: '',
      baseline_labels: '',
      baseline_protected: '',
      mitigation_predictions: '',
      mitigation_labels: '',
      mitigation_protected: '',
      mitigation_method: 'threshold',
      config: { description: '', notes: '' }
    })
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <h1 className="font-display font-semibold text-3xl mb-8">Debiasing Experiments</h1>

      {/* Create Experiment */}
      <div className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-2xl p-6 mb-8">
        <h2 className="font-display font-semibold text-xl mb-4">Create New Experiment</h2>
        <p className="text-sm text-ink-soft mb-6">
          Record baseline vs mitigation results for fairness experiments. All arrays must be comma-separated and equal length.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-2 text-ink-soft">Experiment Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({...form, name: e.target.value})}
              placeholder="e.g. Screening v1.2 - Gender Debiasing"
              className="w-full p-3 rounded-xl border border-ink/10 bg-white/50 focus:outline-none focus:ring-2 focus:ring-accent/30 text-sm"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-2 text-ink-soft">Description</label>
            <textarea
              value={form.config.description}
              onChange={(e) => setForm({...form, config: {...form.config, description: e.target.value}})}
              placeholder="What model, dataset, and hypothesis are you testing?"
              className="w-full h-20 p-3 rounded-xl border border-ink/10 bg-white/50 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="font-medium mb-3 text-ink-soft border-b border-ink/10 pb-2">Baseline Model</h3>
            <InputArea label="Predictions (0/1)" value={form.baseline_predictions} onChange={(v: string) => setForm({...form, baseline_predictions: v})} placeholder="1,0,1,1,0,0..." />
            <InputArea label="Labels (0/1)" value={form.baseline_labels} onChange={(v: string) => setForm({...form, baseline_labels: v})} placeholder="1,0,1,0,0,0..." />
            <InputArea label="Protected Groups" value={form.baseline_protected} onChange={(v: string) => setForm({...form, baseline_protected: v})} placeholder="male,female,male,female..." />
          </div>
          <div>
            <h3 className="font-medium mb-3 text-ink-soft border-b border-ink/10 pb-2">Mitigated Model</h3>
            <select
              value={form.mitigation_method}
              onChange={(e) => setForm({...form, mitigation_method: e.target.value})}
              className="w-full p-3 rounded-xl border border-ink/10 bg-white/50 focus:outline-none focus:ring-2 focus:ring-accent/30 mb-3"
            >
              <option value="threshold">Threshold adjustment</option>
              <option value="reweight">Reweighting</option>
              <option value="none">None (compare separate runs)</option>
            </select>
            <InputArea label="Predictions (0/1)" value={form.mitigation_predictions} onChange={(v: string) => setForm({...form, mitigation_predictions: v})} placeholder="1,0,1,1,0,0..." />
            <InputArea label="Labels (0/1)" value={form.mitigation_labels} onChange={(v: string) => setForm({...form, mitigation_labels: v})} placeholder="1,0,1,0,0,0..." />
            <InputArea label="Protected Groups" value={form.mitigation_protected} onChange={(v: string) => setForm({...form, mitigation_protected: v})} placeholder="male,female,male,female..." />
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={creating}
          className="bg-ink text-cream px-6 py-3 rounded-xl font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {creating ? 'Saving…' : 'Save Experiment →'}
        </button>
      </div>

      {/* Experiment List */}
      <div className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-2xl p-6">
        <h2 className="font-display font-semibold text-xl mb-4">Saved Experiments</h2>
        {loading ? (
          <p className="text-ink-soft">Loading…</p>
        ) : experiments.length === 0 ? (
          <p className="text-ink-soft text-sm">No experiments yet. Create one above to start tracking debiasing results.</p>
        ) : (
          <div className="space-y-4">
            {experiments.map((exp: any) => (
              <div key={exp.id} className="border border-ink/10 rounded-xl p-4 hover:bg-ink/5 transition">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-ink">{exp.name}</h3>
                    <p className="text-xs text-ink-soft mt-1">{exp.config?.description || 'No description'}</p>
                    <p className="text-xs text-ink/50 mt-1">Created: {new Date(exp.created_at).toLocaleString()}</p>
                  </div>
                  <div className="text-right text-sm">
                    {exp.baseline_metrics && exp.mitigation_metrics && (
                      <div className="space-y-1">
                        <div className="flex gap-4">
                          <span className="text-ink-soft">DP: {exp.baseline_metrics.demographic_parity_difference?.toFixed(4)} → {exp.mitigation_metrics.demographic_parity_difference?.toFixed(4)}</span>
                          <span className="text-ink-soft">EO: {exp.baseline_metrics.equalized_odds_difference?.toFixed(4)} → {exp.mitigation_metrics.equalized_odds_difference?.toFixed(4)}</span>
                        </div>
                        <span className="text-green-600">
                          ΔDP: {exp.improvement?.dp_diff_reduction?.toFixed(4)} | ΔEO: {exp.improvement?.eo_diff_reduction?.toFixed(4)}
                        </span>
                      </div>
                    )}
                    {exp.status === 'pending' && <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full">Pending</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

function InputArea({ label, value, onChange, placeholder }: any) {
  return (
    <div className="space-y-2 mb-4">
      <label className="block text-xs font-medium mb-1 text-ink-soft">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-16 p-2 rounded-lg border border-ink/10 bg-white/50 font-mono text-xs resize-none focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
    </div>
  )
}