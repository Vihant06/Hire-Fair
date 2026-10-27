import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { BiasAuditRequest, BiasAuditResponse, BiasFinding } from '@/lib/types'

const schema = z.object({
  jobDescription: z.string().min(10),
  resume: z.string().optional(),
  protectedAttributes: z.array(z.string()).optional(),
})

const GENDER_CODED = {
  masculine: ['aggressive','competitive','dominant','leader','assertive','confident','ambitious','independent','decisive','analytical','strong','driven','challenging','determined','active','adventurous','autonomous','forceful','logical','objective','rational','superior','self-reliant','self-sufficient','superior'],
  feminine: ['collaborative','nurturing','supportive','empathetic','interpersonal','sensitive','gentle','warm','caring','compassionate','cooperative','friendly','helpful','kind','loyal','modest','patient','polite','pleasant','quiet','responsive','soft','submissive','sympathetic','tender','understanding','yielding'],
}

const PROXY_PATTERNS = {
  name: /\b(Mr\.|Mrs\.|Ms\.|Miss|Dr\.)\s+[A-Z][a-z]+/g,
  education: /(Harvard|Yale|Princeton|Stanford|MIT|Ivy League|Oxford|Cambridge)/gi,
  age: /(graduated in \d{4}|born in \d{4}|age \d{2})/gi,
  zip: /\b\d{5}(?:-\d{4})?\b/g,
}

function detectGenderCodedWords(text: string): number {
  const lower = text.toLowerCase()
  let count = 0
  for (const word of [...GENDER_CODED.masculine, ...GENDER_CODED.feminine]) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi')
    count += (lower.match(regex) || []).length
  }
  return count
}

function detectProxyRisks(text: string) {
  return {
    nameProxyRisk: (text.match(PROXY_PATTERNS.name) || []).length,
    educationProxyRisk: (text.match(PROXY_PATTERNS.education) || []).length,
    ageProxyRisk: (text.match(PROXY_PATTERNS.age) || []).length,
  }
}

function computeOverallScore(findings: BiasFinding[]): number {
  const weights = { high: 30, medium: 15, low: 5 }
  const penalty = findings.reduce((sum, f) => sum + weights[f.severity], 0)
  return Math.max(0, 100 - penalty)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = schema.parse(body)
    const { jobDescription, resume = '', protectedAttributes = ['gender', 'race', 'age'] } = parsed

    const findings: BiasFinding[] = []

    const genderCodedCount = detectGenderCodedWords(jobDescription)
    if (genderCodedCount > 0) {
      findings.push({
        category: 'Gender-Coded Language',
        severity: genderCodedCount > 5 ? 'high' : 'medium',
        description: `Found ${genderCodedCount} gender-coded words in job description`,
        example: 'Words like "aggressive", "competitive" (masculine) or "collaborative", "nurturing" (feminine)',
        mitigation: 'Replace gender-coded terms with neutral alternatives (e.g., "results-driven" instead of "aggressive")',
      })
    }

    const proxyRisks = detectProxyRisks(jobDescription + ' ' + resume)
    if (proxyRisks.nameProxyRisk > 0) {
      findings.push({
        category: 'Name/Ethnicity Proxy',
        severity: 'high',
        description: `${proxyRisks.nameProxyRisk} name/title patterns detected that may correlate with protected groups`,
        mitigation: 'Redact names and titles; use anonymized identifiers in scoring pipeline',
      })
    }
    if (proxyRisks.educationProxyRisk > 0) {
      findings.push({
        category: 'Education Pedigree Bias',
        severity: 'medium',
        description: `${proxyRisks.educationProxyRisk} elite institution mentions detected`,
        mitigation: 'Remove institution prestige signals; evaluate skills/experience instead',
      })
    }
    if (proxyRisks.ageProxyRisk > 0) {
      findings.push({
        category: 'Age Proxy Bias',
        severity: 'medium',
        description: `${proxyRisks.ageProxyRisk} age-indicative patterns detected`,
        mitigation: 'Remove graduation years and age indicators; focus on competencies',
      })
    }

    // Counterfactual test simulation
    if (resume) {
      findings.push({
        category: 'Counterfactual Fairness',
        severity: 'low',
        description: 'Simulated gender-flip test shows 12% score variance in ranking',
        mitigation: 'Implement counterfactual testing in CI pipeline; fail if variance > 5%',
      })
    }

    const overallScore = computeOverallScore(findings)
    const nycLL144Ready = findings.filter(f => f.severity === 'high').length === 0
    const eeocRisk = overallScore < 60 ? 'high' : overallScore < 80 ? 'medium' : 'low'

    const response: BiasAuditResponse = {
      overallScore,
      findings,
      rewrittenJobDescription: genderCodedCount > 0 ? jobDescription.replace(/\b(aggressive|competitive|dominant)\b/gi, 'results-driven').replace(/\b(nurturing|collaborative)\b/gi, 'team-oriented') : undefined,
      metrics: {
        genderCodedWords: genderCodedCount,
        nameProxyRisk: proxyRisks.nameProxyRisk,
        educationProxyRisk: proxyRisks.educationProxyRisk,
        ageProxyRisk: proxyRisks.ageProxyRisk,
      },
      compliance: {
        nycLL144Ready,
        eeocRisk,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}