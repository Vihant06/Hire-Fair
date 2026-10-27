import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getScreenings, getScreening, getCandidates, createScreening, deleteScreening } from '@/lib/db'
import { parsePdf, parseDocx, parseTxt } from '@/lib/parse'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'text/plain']

const SKILL_KEYWORDS = [
  'python', 'java', 'javascript', 'typescript', 'react', 'node', 'sql', 'aws',
  'docker', 'kubernetes', 'machine learning', 'data analysis', 'communication',
  'leadership', 'project management', 'agile', 'scrum', 'git', 'ci/cd',
  'tensorflow', 'pytorch', 'nlp', 'deep learning', 'statistics', 'excel',
  'tableau', 'power bi', 'spark', 'hadoop', 'rest api', 'graphql', 'mongodb',
  'postgresql', 'redis', 'linux', 'cloud', 'azure', 'gcp',
]

function preprocess(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function extractSkills(text: string): string[] {
  const lower = text.toLowerCase()
  return SKILL_KEYWORDS.filter(skill => lower.includes(skill))
}

function scoreCandidates(jobDescription: string, resumes: Array<{id: string, filename: string, text: string}>) {
  const jobTerms = new Set(preprocess(jobDescription).split(' ').filter(w => w.length > 2))

  return resumes.map(({id, filename, text}) => {
    const resumeTerms = new Set(preprocess(text).split(' ').filter(w => w.length > 2))
    const intersection = [...jobTerms].filter(t => resumeTerms.has(t)).length
    const union = new Set([...jobTerms, ...resumeTerms]).size
    const jaccard = union > 0 ? intersection / union : 0

    const jobSkills = new Set(extractSkills(jobDescription))
    const resumeSkills = new Set(extractSkills(text))
    const matched = [...jobSkills].filter(s => resumeSkills.has(s))
    const missing = [...jobSkills].filter(s => !resumeSkills.has(s))

    const skillScore = jobSkills.size > 0 ? matched.length / jobSkills.size : 0
    const finalScore = Math.round((0.6 * jaccard + 0.4 * skillScore) * 100)

    return {
      id,
      filename,
      score: finalScore,
      matched_skills: matched,
      missing_skills: missing,
      explanation: `Jaccard similarity: ${(jaccard * 100).toFixed(1)}%. Skill overlap: ${matched.length}/${jobSkills.size} required skills matched. This score reflects textual and skill overlap, not hiring probability.`
    }
  }).sort((a, b) => b.score - a.score)
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const jobTitle = formData.get('job_title') as string
    const jobDescription = formData.get('job_description') as string
    const files = formData.getAll('files') as File[]

    if (!jobTitle || !jobDescription) {
      return NextResponse.json({ error: 'Job title and description required' }, { status: 400 })
    }
    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'At least one resume required' }, { status: 400 })
    }
    if (files.length > 20) {
      return NextResponse.json({ error: 'Maximum 20 resumes per screening' }, { status: 400 })
    }

    const screeningId = randomUUID()
    const createdAt = new Date().toISOString()

    const resumes = []
    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json({ error: `Unsupported file type: ${file.name}` }, { status: 400 })
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: `File too large: ${file.name} (max 5MB)` }, { status: 400 })
      }

      const buffer = Buffer.from(await file.arrayBuffer())
      let text = ''
      if (file.type === 'application/pdf') {
        text = await parsePdf(buffer)
      } else if (file.type.includes('word') || file.type === 'application/msword') {
        text = await parseDocx(buffer)
      } else {
        text = parseTxt(buffer)
      }

      if (!text || text.trim().length < 10) {
        return NextResponse.json({ error: `Could not extract text from: ${file.name}` }, { status: 400 })
      }

      resumes.push({
        id: randomUUID(),
        filename: file.name,
        text: preprocess(text)
      })
    }

    const scored = scoreCandidates(jobDescription, resumes)

    const screening = {
      id: screeningId,
      job_title: jobTitle,
      job_description: jobDescription,
      created_at: createdAt,
      candidate_count: scored.length
    }

    const candidates = scored.map((c: any) => ({
      id: c.id,
      screening_id: screeningId,
      filename: c.filename,
      extracted_text: null,
      score: c.score,
      matched_skills: c.matched_skills,
      missing_skills: c.missing_skills,
      explanation: c.explanation
    }))

    createScreening(screening, candidates)

    return NextResponse.json({
      screening_id: screeningId,
      job_title: jobTitle,
      candidates: scored,
      created_at: createdAt
    })
  } catch (e: any) {
    console.error('Screening error:', e)
    return NextResponse.json({ error: 'Screening failed' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (id) {
    const screening = getScreening(id)
    if (!screening) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const candidates = getCandidates(id)
    return NextResponse.json({
      screening,
      candidates: candidates.map((c: any) => ({
        ...c,
        matched_skills: c.matched_skills || [],
        missing_skills: c.missing_skills || []
      }))
    })
  }

  const screenings = getScreenings()
  return NextResponse.json(screenings)
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'ID required' }, { status: 400 })
  }

  deleteScreening(id)
  return NextResponse.json({ deleted: true })
}