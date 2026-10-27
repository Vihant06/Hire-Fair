# HireFair

Debiasing NLP/ATS system for automated resume screening. Full-stack MVP built with Next.js 14, TypeScript, Tailwind CSS. Deploys to Vercel.

## Features

- **Dashboard** — persisted screening metrics and recent activity
- **Resume Screening** — upload PDF/DOCX/TXT, TF-IDF cosine similarity scoring with skill matching
- **Fairness Audit** — demographic parity, equalized odds, FPR metrics with baseline vs mitigation
- **Debiasing Experiments** — record baseline vs mitigation results, threshold adjustment and reweighting

## Installation

```bash
cd hirefair-app
npm install
```

## Development

```bash
npm run dev
```

Open http://localhost:3000.

## Build

```bash
npm run build
npm run start
```

## Persistence

Data stored in `hirefair-data.json` (configurable via `DB_PATH` env var). File-based JSON, no native dependencies.

## API Documentation

### `POST /api/screening`
Upload resumes and job description. Returns scored candidates.

### `GET /api/dashboard`
Returns aggregate metrics from persisted screenings.

### `POST /api/fairness`
Evaluate fairness. Body: `{ predictions, labels, protected_groups, mitigation }`.

### `GET /api/fairness`
List saved experiments (or `?id=...` for single).

### `DELETE /api/fairness?id=...`
Delete experiment.

## Deployment (Vercel)

1. Push to GitHub
2. Import in Vercel dashboard
3. Vercel auto-detects Next.js
4. Set `DB_PATH` env var if needed (default: `hirefair-data.json` in project root)

## Notes

- Scores are similarity scores, not hiring probabilities
- HireFair does not infer protected characteristics
- NYC Local Law 144 requires independent third-party audit annually