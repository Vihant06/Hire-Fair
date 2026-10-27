import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center text-center px-6">
      <div className="font-mono text-xs tracking-[0.26em] uppercase text-ink-soft mb-6 flex items-center gap-4">
        <span className="w-7 h-px bg-accent" />
        Debiasing NLP for hiring
        <span className="w-7 h-px bg-accent" />
      </div>
      <h1 className="font-display font-semibold text-5xl md:text-7xl leading-none tracking-tight max-w-4xl">
        Fair models make <span className="text-accent">fair hires.</span>
      </h1>
      <p className="text-ink-soft text-lg max-w-xl mt-6">
        Audit, measure, and mitigate bias in your resume screening pipeline — before it shapes who gets hired.
      </p>
      <div className="flex gap-4 mt-10">
        <Link href="/app" className="bg-ink text-cream px-6 py-3 rounded-xl font-medium hover:opacity-90 transition">
          Open Dashboard →
        </Link>
        <Link href="/app/screening" className="border border-ink/20 px-6 py-3 rounded-xl font-medium hover:bg-ink/5 transition">
          Start Screening
        </Link>
      </div>
    </main>
  )
}