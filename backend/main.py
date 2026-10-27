import os
import json
import sqlite3
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import pdfplumber
from docx import Document as DocxDocument
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# ---------- Config ----------
DB_PATH = os.getenv("DB_PATH", "hirefair.db")
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE", 5 * 1024 * 1024))  # 5MB
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc", ".txt"}

app = FastAPI(title="HireFair API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- DB ----------
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()
    c.execute("""
    CREATE TABLE IF NOT EXISTS screenings (
        id TEXT PRIMARY KEY,
        job_title TEXT NOT NULL,
        job_description TEXT NOT NULL,
        created_at TEXT NOT NULL,
        candidate_count INTEGER NOT NULL
    )
    """)
    c.execute("""
    CREATE TABLE IF NOT EXISTS candidates (
        id TEXT PRIMARY KEY,
        screening_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        extracted_text TEXT,
        score REAL,
        matched_skills TEXT,
        missing_skills TEXT,
        explanation TEXT,
        FOREIGN KEY (screening_id) REFERENCES screenings(id) ON DELETE CASCADE
    )
    """)
    c.execute("""
    CREATE TABLE IF NOT EXISTS fairness_experiments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        baseline_metrics TEXT,
        mitigation_metrics TEXT,
        config TEXT,
        status TEXT NOT NULL
    )
    """)
    conn.commit()
    conn.close()

init_db()

# ---------- Models ----------
class ScreeningRequest(BaseModel):
    job_title: str = Field(..., min_length=1, max_length=200)
    job_description: str = Field(..., min_length=10, max_length=10000)

class CandidateResult(BaseModel):
    id: str
    filename: str
    score: float
    matched_skills: List[str]
    missing_skills: List[str]
    explanation: str

class ScreeningResponse(BaseModel):
    screening_id: str
    job_title: str
    candidates: List[CandidateResult]
    created_at: str

class FairnessExperiment(BaseModel):
    name: str
    baseline_metrics: Optional[dict] = None
    mitigation_metrics: Optional[dict] = None
    config: dict

# ---------- Text Extraction ----------
def extract_text(file_bytes: bytes, filename: str) -> str:
    lower = filename.lower()
    if lower.endswith(".pdf"):
        import io
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            pages = []
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    pages.append(t)
            return "\n".join(pages)
    elif lower.endswith(".docx") or lower.endswith(".doc"):
        import io
        doc = DocxDocument(io.BytesIO(file_bytes))
        return "\n".join(p.text for p in doc.paragraphs)
    elif lower.endswith(".txt"):
        return file_bytes.decode("utf-8", errors="ignore")
    else:
        raise ValueError("Unsupported file type")

def preprocess(text: str) -> str:
    import re
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text

# Skill keywords for matching
SKILL_KEYWORDS = [
    "python", "java", "javascript", "typescript", "react", "node", "sql", "aws",
    "docker", "kubernetes", "machine learning", "data analysis", "communication",
    "leadership", "project management", "agile", "scrum", "git", "ci/cd",
    "tensorflow", "pytorch", "nlp", "deep learning", "statistics", "excel",
    "tableau", "power bi", "spark", "hadoop", "rest api", "graphql", "mongodb",
    "postgresql", "redis", "linux", "cloud", "azure", "gcp",
]

def extract_skills(text: str) -> List[str]:
    lower = text.lower()
    found = []
    for skill in SKILL_KEYWORDS:
        if skill in lower:
            found.append(skill)
    return found

def score_candidates(job_description: str, resumes: List[tuple]) -> List[CandidateResult]:
    """Returns scored candidates. resumes: list of (id, filename, text)"""
    corpus = [job_description] + [r[2] for r in resumes]
    vectorizer = TfidfVectorizer(stop_words="english", max_features=5000)
    tfidf = vectorizer.fit_transform(corpus)
    job_vec = tfidf[0]
    resume_vecs = tfidf[1:]

    job_skills = set(extract_skills(job_description))

    results = []
    for i, (cid, filename, text) in enumerate(resumes):
        sim = cosine_similarity(job_vec, resume_vecs[i])[0][0]
        score = round(float(sim) * 100, 1)

        resume_skills = set(extract_skills(text))
        matched = sorted(job_skills & resume_skills)
        missing = sorted(job_skills - resume_skills)

        explanation = (
            f"Cosine similarity between TF-IDF vectors: {sim:.3f}. "
            f"Matched {len(matched)}/{len(job_skills)} required skills. "
            f"Score reflects textual overlap, not hiring probability."
        )

        results.append(CandidateResult(
            id=cid,
            filename=filename,
            score=score,
            matched_skills=matched,
            missing_skills=missing,
            explanation=explanation,
        ))

    results.sort(key=lambda x: x.score, reverse=True)
    return results

# ---------- Endpoints ----------
@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/api/screening", response_model=ScreeningResponse)
async def create_screening(
    job_title: str = Form(...),
    job_description: str = Form(...),
    files: List[UploadFile] = File(...),
):
    if len(files) == 0:
        raise HTTPException(400, "At least one resume required")
    if len(files) > 20:
        raise HTTPException(400, "Maximum 20 resumes per screening")

    screening_id = str(uuid.uuid4())
    created_at = datetime.utcnow().isoformat()

    # Extract text from all files
    resumes = []
    for f in files:
        ext = os.path.splitext(f.filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(400, f"Unsupported file type: {f.filename}")
        content = await f.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(400, f"File too large: {f.filename} (max 5MB)")
        text = extract_text(content, f.filename)
        resumes.append((str(uuid.uuid4()), f.filename, preprocess(text)))

    # Score
    scored = score_candidates(preprocess(job_description), resumes)

    # Persist
    conn = get_db()
    c = conn.cursor()
    c.execute(
        "INSERT INTO screenings (id, job_title, job_description, created_at, candidate_count) VALUES (?,?,?,?,?)",
        (screening_id, job_title, job_description, created_at, len(scored)),
    )
    for cand in scored:
        c.execute(
            "INSERT INTO candidates (id, screening_id, filename, extracted_text, score, matched_skills, missing_skills, explanation) VALUES (?,?,?,?,?,?,?,?)",
            (cand.id, screening_id, cand.filename, None, cand.score,
             json.dumps(cand.matched_skills), json.dumps(cand.missing_skills), cand.explanation),
        )
    conn.commit()
    conn.close()

    return ScreeningResponse(
        screening_id=screening_id,
        job_title=job_title,
        candidates=scored,
        created_at=created_at,
    )

@app.get("/api/screenings")
def list_screenings():
    conn = get_db()
    c = conn.cursor()
    rows = c.execute("SELECT * FROM screenings ORDER BY created_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/api/screenings/{screening_id}")
def get_screening(screening_id: str):
    conn = get_db()
    c = conn.cursor()
    screening = c.execute("SELECT * FROM screenings WHERE id=?", (screening_id,)).fetchone()
    if not screening:
        raise HTTPException(404, "Screening not found")
    candidates = c.execute("SELECT * FROM candidates WHERE screening_id=?", (screening_id,)).fetchall()
    conn.close()
    return {
        "screening": dict(screening),
        "candidates": [
            {
                "id": r["id"],
                "filename": r["filename"],
                "score": r["score"],
                "matched_skills": json.loads(r["matched_skills"] or "[]"),
                "missing_skills": json.loads(r["missing_skills"] or "[]"),
                "explanation": r["explanation"],
            }
            for r in candidates
        ],
    }

@app.delete("/api/screenings/{screening_id}")
def delete_screening(screening_id: str):
    conn = get_db()
    c = conn.cursor()
    c.execute("DELETE FROM candidates WHERE screening_id=?", (screening_id,))
    c.execute("DELETE FROM screenings WHERE id=?", (screening_id,))
    conn.commit()
    conn.close()
    return {"deleted": True}

@app.get("/api/dashboard")
def dashboard():
    conn = get_db()
    c = conn.cursor()
    total_screenings = c.execute("SELECT COUNT(*) FROM screenings").fetchone()[0]
    total_candidates = c.execute("SELECT COUNT(*) FROM candidates").fetchone()[0]
    avg_score = c.execute("SELECT AVG(score) FROM candidates").fetchone()[0] or 0
    recent = c.execute("SELECT * FROM screenings ORDER BY created_at DESC LIMIT 5").fetchall()
    conn.close()
    return {
        "total_screenings": total_screenings,
        "total_candidates": total_candidates,
        "avg_score": round(float(avg_score), 1),
        "recent_screenings": [dict(r) for r in recent],
    }

# ---------- Fairness Experiments ----------
@app.post("/api/fairness/experiments")
def create_experiment(exp: FairnessExperiment):
    eid = str(uuid.uuid4())
    conn = get_db()
    c = conn.cursor()
    c.execute(
        "INSERT INTO fairness_experiments (id, name, created_at, baseline_metrics, mitigation_metrics, config, status) VALUES (?,?,?,?,?,?,?)",
        (eid, exp.name, datetime.utcnow().isoformat(),
         json.dumps(exp.baseline_metrics) if exp.baseline_metrics else None,
         json.dumps(exp.mitigation_metrics) if exp.mitigation_metrics else None,
         json.dumps(exp.config), "pending"),
    )
    conn.commit()
    conn.close()
    return {"id": eid, "status": "created"}

@app.get("/api/fairness/experiments")
def list_experiments():
    conn = get_db()
    c = conn.cursor()
    rows = c.execute("SELECT * FROM fairness_experiments ORDER BY created_at DESC").fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["baseline_metrics"] = json.loads(d["baseline_metrics"]) if d["baseline_metrics"] else None
        d["mitigation_metrics"] = json.loads(d["mitigation_metrics"]) if d["mitigation_metrics"] else None
        d["config"] = json.loads(d["config"]) if d["config"] else {}
        result.append(d)
    return result

@app.post("/api/fairness/run")
def run_fairness_evaluation(body: dict):
    """Run a baseline vs mitigation evaluation given labeled data."""
    # Expected: { predictions: [...], labels: [...], protected: [...], mitigation: "reweight"|"threshold"|"none" }
    predictions = body.get("predictions", [])
    labels = body.get("labels", [])
    protected = body.get("protected", [])
    mitigation = body.get("mitigation", "none")

    if len(predictions) != len(labels) or len(predictions) != len(protected):
        raise HTTPException(400, "predictions, labels, and protected must have equal length")
    if len(predictions) == 0:
        raise HTTPException(400, "No data provided")

    # Compute baseline metrics
    def compute_metrics(preds, labs, prot):
        # Demographic parity difference
        groups = set(prot)
        group_rates = {}
        for g in groups:
            idx = [i for i in range(len(prot)) if prot[i] == g]
            if not idx:
                continue
            rate = sum(1 for i in idx if preds[i] == 1) / len(idx)
            group_rates[g] = rate
        rates = list(group_rates.values())
        dp_diff = max(rates) - min(rates) if len(rates) > 1 else 0.0

        # Equalized odds: TPR difference
        tpr_by_group = {}
        for g in groups:
            idx = [i for i in range(len(prot)) if prot[i] == g]
            positives = [i for i in idx if labs[i] == 1]
            if positives:
                tpr = sum(1 for i in positives if preds[i] == 1) / len(positives)
            else:
                tpr = 0.0
            tpr_by_group[g] = tpr
        tprs = list(tpr_by_group.values())
        eo_diff = max(tprs) - min(tprs) if len(tprs) > 1 else 0.0

        # Overall accuracy
        acc = sum(1 for i in range(len(preds)) if preds[i] == labels[i]) / len(preds)

        return {
            "demographic_parity_difference": round(dp_diff, 4),
            "equalized_odds_difference": round(eo_diff, 4),
            "accuracy": round(acc, 4),
            "group_positive_rates": {str(k): round(v, 4) for k, v in group_rates.items()},
            "group_tpr": {str(k): round(v, 4) for k, v in tpr_by_group.items()},
        }

    baseline = compute_metrics(predictions, labels, protected)

    # Apply mitigation (simulated reweighting/threshold adjustment)
    mitigated_preds = list(predictions)
    if mitigation == "threshold":
        # Adjust threshold per group to equalize positive rates
        groups = set(protected)
        target_rate = sum(predictions) / len(predictions)
        for g in groups:
            idx = [i for i in range(len(protected)) if protected[i] == g]
            group_rate = sum(1 for i in idx if predictions[i] == 1) / len(idx) if idx else 0
            if group_rate > target_rate:
                # lower some positives to 0
                pos_idx = [i for i in idx if predictions[i] == 1]
                n_to_flip = int((group_rate - target_rate) * len(idx))
                for i in pos_idx[:n_to_flip]:
                    mitigated_preds[i] = 0
            elif group_rate < target_rate:
                neg_idx = [i for i in idx if predictions[i] == 0]
                n_to_flip = int((target_rate - group_rate) * len(idx))
                for i in neg_idx[:n_to_flip]:
                    mitigated_preds[i] = 1
    elif mitigation == "reweight":
        # Simple: flip a small fraction to balance (demo)
        pass

    mitigation_metrics = compute_metrics(mitigated_preds, labels, protected)

    return {
        "baseline": baseline,
        "mitigation": mitigation_metrics,
        "mitigation_type": mitigation,
        "improvement": {
            "dp_diff_reduction": round(baseline["demographic_parity_difference"] - mitigation_metrics["demographic_parity_difference"], 4),
            "eo_diff_reduction": round(baseline["equalized_odds_difference"] - mitigation_metrics["equalized_odds_difference"], 4),
        },
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)