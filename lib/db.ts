import { resolve } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'

const DB_PATH = process.env.DB_PATH || resolve(process.cwd(), 'hirefair-data.json')

interface Screening {
  id: string
  job_title: string
  job_description: string
  created_at: string
  candidate_count: number
}

interface Candidate {
  id: string
  screening_id: string
  filename: string
  extracted_text: string | null
  score: number
  matched_skills: string[]
  missing_skills: string[]
  explanation: string
}

interface FairnessExperiment {
  id: string
  name: string
  created_at: string
  baseline_metrics: any
  mitigation_metrics: any
  config: any
  status: string
}

interface DataStore {
  screenings: Screening[]
  candidates: Candidate[]
  fairness_experiments: FairnessExperiment[]
}

function loadData(): DataStore {
  try {
    if (existsSync(DB_PATH)) {
      const raw = readFileSync(DB_PATH, 'utf-8')
      return JSON.parse(raw)
    }
  } catch (e) {
    console.error('Failed to load data:', e)
  }
  return { screenings: [], candidates: [], fairness_experiments: [] }
}

function saveData(data: DataStore) {
  try {
    writeFileSync(DB_PATH, JSON.stringify(data, null, 2))
  } catch (e) {
    console.error('Failed to save data:', e)
  }
}

let data = loadData()

export function getScreenings() {
  return [...data.screenings].sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function getScreening(id: string) {
  return data.screenings.find(s => s.id === id)
}

export function getCandidates(screeningId: string) {
  return data.candidates
    .filter(c => c.screening_id === screeningId)
    .sort((a, b) => b.score - a.score)
}

export function createScreening(screening: Screening, candidates: Candidate[]) {
  data.screenings.push(screening)
  data.candidates.push(...candidates)
  saveData(data)
}

export function deleteScreening(id: string) {
  data.screenings = data.screenings.filter(s => s.id !== id)
  data.candidates = data.candidates.filter(c => c.screening_id !== id)
  saveData(data)
}

export function getDashboard() {
  const totalScreenings = data.screenings.length
  const totalCandidates = data.candidates.length
  const avgScore = totalCandidates > 0
    ? data.candidates.reduce((sum, c) => sum + c.score, 0) / totalCandidates
    : 0
  const recent = getScreenings().slice(0, 5)
  return {
    total_screenings: totalScreenings,
    total_candidates: totalCandidates,
    avg_score: Math.round(avgScore * 10) / 10,
    recent_screenings: recent
  }
}

export function getFairnessExperiments() {
  return [...data.fairness_experiments].sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function getFairnessExperiment(id: string) {
  return data.fairness_experiments.find(e => e.id === id)
}

export function createFairnessExperiment(exp: FairnessExperiment) {
  data.fairness_experiments.push(exp)
  saveData(data)
}

export function deleteFairnessExperiment(id: string) {
  data.fairness_experiments = data.fairness_experiments.filter(e => e.id !== id)
  saveData(data)
}