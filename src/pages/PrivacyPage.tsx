import { Link } from 'react-router-dom'

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f5f2ec] px-6 pb-16 pt-28">
      {/* Minimal nav */}
      <nav className="mb-10">
        <Link to="/" className="text-sm font-medium text-[#e8c547] no-underline">
          ← Back to Ratio Lifts
        </Link>
      </nav>

      <main className="mx-auto max-w-3xl">
        <h1 className="mb-4 font-display text-[2.4rem] tracking-[0.02em]">Privacy Policy</h1>
        <p className="mb-6 text-sm text-[#a8a8a8]">
          Last updated: {new Date().toLocaleDateString()}
        </p>

        <div className="space-y-4 text-sm leading-[1.8] text-[#e8e5df]">
          <p>
            Ratio Lifts collects email addresses only to send a one-time reminder for users to retest their
            strength ratio progress. We do not sell your data and we do not share your email with third parties.
          </p>
          <p>
            <strong>What we collect</strong>: your email address when you submit the “Get reminder” form.
          </p>
          <p>
            <strong>Why we collect it</strong>: to send you a single reminder message. You can stop receiving
            messages at any time by replying to the reminder email.
          </p>
          <p>
            <strong>Data retention</strong>: we retain reminder submissions only as long as needed to deliver the
            one-time email, then remove the address.
          </p>
          <p>
            <strong>Your rights</strong> (GDPR/UK GDPR): you may request access, correction, deletion, or
            objection to processing of your personal data.
          </p>
          <p>
            <strong>Contact</strong>: if you have questions about this policy, contact us via the email address
            shown in the app footer.
          </p>
        </div>

        <div className="mt-8 rounded-none border border-[#2a2a2a] bg-[#1c1c1c] p-5 text-xs text-[#a8a8a8]">
          Note: This site provides an informational strength assessment tool and is not medical advice.
        </div>
      </main>
    </div>
  )
}

