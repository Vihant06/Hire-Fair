import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getFairnessExperiments, getFairnessExperiment, createFairnessExperiment, deleteFairnessExperiment } from '@/lib/db'

function computeMetrics(predictions: number[], labels: number[], protectedGroups: string[]) {
  if (predictions.length !== labels.length || predictions.length !== protectedGroups.length) {
    throw new Error('All arrays must have equal length')
  }
  if (predictions.length === 0) {
    throw new Error('No data provided')
  }

  const groups = [...new Set(protectedGroups)]

  const groupRates: Record<string, number> = {}
  for (const g of groups) {
    const idx = protectedGroups.map((pg, i) => pg === g ? i : -1).filter(i => i >= 0)
    const rate = idx.length > 0 ? idx.filter(i => predictions[i] === 1).length / idx.length : 0
    groupRates[g] = rate
  }
  const rates = Object.values(groupRates)
  const dpDiff = rates.length > 1 ? Math.max(...rates) - Math.min(...rates) : 0

  const groupTPR: Record<string, number> = {}
  for (const g of groups) {
    const idx = protectedGroups.map((pg, i) => pg === g ? i : -1).filter(i => i >= 0)
    const positives = idx.filter(i => labels[i] === 1)
    const tpr = positives.length > 0 ? positives.filter(i => predictions[i] === 1).length / positives.length : 0
    groupTPR[g] = tpr
  }
  const tprs = Object.values(groupTPR)
  const eoDiff = tprs.length > 1 ? Math.max(...tprs) - Math.min(...tprs) : 0

  const accuracy = predictions.filter((p, i) => p === labels[i]).length / predictions.length

  const groupFPR: Record<string, number> = {}
  for (const g of groups) {
    const idx = protectedGroups.map((pg, i) => pg === g ? i : -1).filter(i => i >= 0)
    const negatives = idx.filter(i => labels[i] === 0)
    const fpr = negatives.length > 0 ? negatives.filter(i => predictions[i] === 1).length / negatives.length : 0
    groupFPR[g] = fpr
  }
  const fprs = Object.values(groupFPR)
  const fprDiff = fprs.length > 1 ? Math.max(...fprs) - Math.min(...fprs) : 0

  const round4 = (n: number) => Math.round(n * 10000) / 10000

  return {
    demographic_parity_difference: round4(dpDiff),
    equalized_odds_difference: round4(eoDiff),
    false_positive_rate_difference: round4(fprDiff),
    accuracy: round4(accuracy),
    group_positive_rates: Object.fromEntries(Object.entries(groupRates).map(([k, v]) => [k, round4(v)])),
    group_tpr: Object.fromEntries(Object.entries(groupTPR).map(([k, v]) => [k, round4(v)])),
    group_fpr: Object.fromEntries(Object.entries(groupFPR).map(([k, v]) => [k, round4(v)])),
  }
}

function applyMitigation(predictions: number[], labels: number[], protectedGroups: string[], method: string) {
  const mitigated = [...predictions]
  const groups = [...new Set(protectedGroups)]

  if (method === 'threshold') {
    const overallRate = predictions.filter(p => p === 1).length / predictions.length
    for (const g of groups) {
      const idx = protectedGroups.map((pg, i) => pg === g ? i : -1).filter(i => i >= 0)
      const groupRate = idx.filter(i => predictions[i] === 1).length / idx.length
      if (groupRate > overallRate) {
        const posIdx = idx.filter(i => predictions[i] === 1)
        const nToFlip = Math.round((groupRate - overallRate) * idx.length)
        for (const i of posIdx.slice(0, nToFlip)) {
          mitigated[i] = 0
        }
      } else if (groupRate < overallRate) {
        const negIdx = idx.filter(i => predictions[i] === 0)
        const nToFlip = Math.round((overallRate - groupRate) * idx.length)
        for (const i of negIdx.slice(0, nToFlip)) {
          mitigated[i] = 1
        }
      }
    }
  } else if (method === 'reweight') {
    const overallRate = predictions.filter(p => p === 1).length / predictions.length
    for (const g of groups) {
      const idx = protectedGroups.map((pg, i) => pg === g ? i : -1).filter(i => i >= 0)
      const groupRate = idx.filter(i => predictions[i] === 1).length / idx.length
      if (Math.abs(groupRate - overallRate) > 0.1) {
        const posIdx = idx.filter(i => predictions[i] === 1)
        const nToFlip = Math.round(Math.abs(groupRate - overallRate) * idx.length * 0.5)
        if (groupRate > overallRate) {
          for (const i of posIdx.slice(0, nToFlip)) mitigated[i] = 0
        } else {
          const negIdx = idx.filter(i => predictions[i] === 0)
          for (const i of negIdx.slice(0, nToFlip)) mitigated[i] = 1
        }
      }
    }
  }

  return mitigated
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Debiasing experiment creation
    if (body.name && body.baseline_predictions) {
      const baselinePreds = body.baseline_predictions
      const baselineLabels = body.baseline_labels
      const baselineProtected = body.baseline_protected
      const mitigationPreds = body.mitigation_predictions || baselinePreds
      const mitigationLabels = body.mitigation_labels || baselineLabels
      const mitigationProtected = body.mitigation_protected || baselineProtected
      const mitigationMethod = body.mitigation_method || 'threshold'

      const baseline = computeMetrics(baselinePreds, baselineLabels, baselineProtected)
      const mitigatedPreds = applyMitigation(baselinePreds, baselineLabels, baselineProtected, mitigationMethod)
      const mitigated = computeMetrics(mitigationPreds.length ? mitigationPreds : mitigatedPreds, mitigationLabels, mitigationProtected)

      const improvement = {
        dp_diff_reduction: Math.round((baseline.demographic_parity_difference - mitigated.demographic_parity_difference) * 10000) / 10000,
        eo_diff_reduction: Math.round((baseline.equalized_odds_difference - mitigated.equalized_odds_difference) * 10000) / 10000,
        fpr_diff_reduction: Math.round((baseline.false_positive_rate_difference - mitigated.false_positive_rate_difference) * 10000) / 10000,
        accuracy_change: Math.round((mitigated.accuracy - baseline.accuracy) * 10000) / 10000,
      }

      const exp = {
        id: randomUUID(),
        name: body.name,
        created_at: new Date().toISOString(),
        baseline_metrics: baseline,
        mitigation_metrics: mitigated,
        config: body.config || {},
        status: 'completed',
        mitigation_method: mitigationMethod,
        improvement,
      }
      createFairnessExperiment(exp)
      return NextResponse.json(exp)
    }

    // Fairness evaluation
    const { predictions, labels, protected_groups, mitigation = 'none' } = body
    if (!predictions || !labels || !protected_groups) {
      return NextResponse.json({ error: 'predictions, labels, and protected_groups required' }, { status: 400 })
    }
    const baseline = computeMetrics(predictions, labels, protected_groups)
    const mitigatedPreds = applyMitigation(predictions, labels, protected_groups, mitigation)
    const mitigated = computeMetrics(mitigatedPreds, labels, protected_groups)

    return NextResponse.json({
      baseline,
      mitigation: mitigated,
      mitigation_type: mitigation,
      improvement: {
        dp_diff_reduction: Math.round((baseline.demographic_parity_difference - mitigated.demographic_parity_difference) * 10000) / 10000,
        eo_diff_reduction: Math.round((baseline.equalized_odds_difference - mitigated.equalized_odds_difference) * 10000) / 10000,
        fpr_diff_reduction: Math.round((baseline.false_positive_rate_difference - mitigated.false_positive_rate_difference) * 10000) / 10000,
        accuracy_change: Math.round((mitigated.accuracy - baseline.accuracy) * 10000) / 10000,
      }
    })
  } catch (e: any) {
    console.error('Fairness evaluation error:', e)
    return NextResponse.json({ error: e.message || 'Evaluation failed' }, { status: 400 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (id) {
    const exp = getFairnessExperiment(id)
    if (!exp) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json(exp)
  }

  const experiments = getFairnessExperiments()
  return NextResponse.json(experiments)
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'ID required' }, { status: 400 })
  }
  deleteFairnessExperiment(id)
  return NextResponse.json({ deleted: true })
}