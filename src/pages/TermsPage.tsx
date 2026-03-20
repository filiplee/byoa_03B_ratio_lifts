import { Link } from 'react-router-dom'

export function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f5f2ec] px-6 pb-16 pt-28">
      {/* Minimal nav */}
      <nav className="mb-10">
        <Link to="/" className="text-sm font-medium text-[#e8c547] no-underline">
          ← Back to Ratio Lifts
        </Link>
      </nav>

      <main className="mx-auto max-w-3xl">
        <h1 className="mb-4 font-display text-[2.4rem] tracking-[0.02em]">Terms of Use</h1>
        <p className="mb-6 text-sm text-[#a8a8a8]">Please read these terms carefully before using the site.</p>

        <div className="space-y-4 text-sm leading-[1.8] text-[#e8e5df]">
          <p>
            Ratio Lifts (“the Tool”) provides an informational strength ratio analysis based on user-entered
            lift data. The Tool is intended for general educational purposes.
          </p>
          <p>
            <strong>No medical advice</strong>: the Tool does not diagnose conditions, provide treatment, or
            substitute for professional medical or training guidance.
          </p>
          <p>
            <strong>Your responsibility</strong>: you are responsible for how you apply any information from the
            Tool. Stop exercising and seek professional advice if you experience pain or discomfort.
          </p>
          <p>
            <strong>Accuracy</strong>: calculations are estimates based on the inputs you provide (e.g., 1RM via
            the Epley formula). Results may vary in real-world practice.
          </p>
          <p>
            <strong>Changes</strong>: we may update the Tool or these terms from time to time.
          </p>
        </div>

        <div className="mt-8 rounded-none border border-[#2a2a2a] bg-[#1c1c1c] p-5 text-xs text-[#a8a8a8]">
          By using the Tool, you agree to these terms.
        </div>
      </main>
    </div>
  )
}

