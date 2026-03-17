import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

const keyframes = `
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(30px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes barGrow {
  from { width: 0; }
  to   { width: var(--target-w); }
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}
@keyframes ticker {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
`

function handleSignup(email: string) {
  // Placeholder: wire this up to your signup system
  void email
}

export function LandingPage() {
  const [email, setEmail] = useState('')
  const [submittedFrom, setSubmittedFrom] = useState<'hero' | 'final' | null>(null)
  const heroInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>('[data-reveal]')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('opacity-100', 'translate-y-0')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12 },
    )

    elements.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [])

  const onSubmit = (from: 'hero' | 'final') => {
    if (!email || !email.includes('@')) {
      if (from === 'hero') {
        heroInputRef.current?.focus()
      }
      return
    }
    handleSignup(email)
    setSubmittedFrom(from)
    setEmail('')
    window.setTimeout(() => setSubmittedFrom(null), 3500)
  }

  return (
    <div
      className="min-h-screen bg-[#0a0a0a] text-[#f5f2ec]"
      style={{ fontFamily: '"DM Sans", sans-serif' }}
    >
      <style>{keyframes}</style>

      {/* NAV */}
      <nav className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-[#2a2a2a] bg-[rgba(10,10,10,0.85)] px-10 py-[1.2rem] backdrop-blur-[12px]">
        <a
          href="#top"
          className="text-[1.6rem] tracking-[0.08em] text-[#e8c547] no-underline"
          style={{ fontFamily: '"Bebas Neue", sans-serif' }}
        >
          <span className="text-[#f5f2ec]">RATIO</span> LIFTS
        </a>
        <button
          type="button"
          onClick={() => heroInputRef.current?.focus()}
          className="border-none bg-[#e8c547] px-[1.4rem] py-[0.6rem] text-[0.8rem] font-medium tracking-[0.12em] text-[#0a0a0a] transition-transform transition-colors duration-200 uppercase hover:translate-y-[-1px] hover:bg-[#f5d76a]"
        >
          Join Waitlist
        </button>
      </nav>

      {/* TICKER */}
      <div
        aria-hidden="true"
        className="mt-[57px] overflow-hidden bg-[#e8c547] py-[0.45rem] text-[#0a0a0a]"
      >
        <div
          className="flex whitespace-nowrap"
          style={{ animation: 'ticker 22s linear infinite' }}
        >
          {[
            'DIAGNOSE YOUR WEAKNESSES',
            '✦',
            'FIX YOUR RATIOS',
            '✦',
            'UNLOCK YOUR LIFTS',
            '✦',
            'TRAIN SMARTER',
            '✦',
            'DIAGNOSE YOUR WEAKNESSES',
            '✦',
            'FIX YOUR RATIOS',
            '✦',
            'UNLOCK YOUR LIFTS',
            '✦',
            'TRAIN SMARTER',
            '✦',
          ].map((text, idx) => (
            <span
              // eslint-disable-next-line react/no-array-index-key
              key={idx}
              className={`px-12 text-[0.85rem] tracking-[0.15em] ${
                text === '✦' ? 'opacity-40' : ''
              }`}
              style={{ fontFamily: '"Bebas Neue", sans-serif' }}
            >
              {text}
            </span>
          ))}
        </div>
      </div>

      {/* HERO */}
      <section className="relative grid min-h-[100vh] grid-cols-1 gap-16 px-10 pb-24 pt-32 lg:grid-cols-2">
        <div className="max-w-[620px]">
          <div
            className="mb-[1.4rem] flex items-center gap-[0.6rem] text-[0.72rem] font-medium uppercase tracking-[0.2em] text-[#e8c547]"
            style={{ animation: 'fadeUp 0.7s 0.1s ease both' }}
          >
            <span className="inline-block h-px w-6 bg-[#e8c547]" />
            Strength Intelligence
          </div>
          <h1
            className="text-[clamp(4rem,8vw,7.5rem)] leading-[0.92] tracking-[0.02em] text-[#f5f2ec]"
            style={{ animation: 'fadeUp 0.7s 0.2s ease both', fontFamily: '"Bebas Neue", sans-serif' }}
          >
            Train what&apos;s
            <br />
            <span className="text-[#e8c547]" style={{ fontFamily: '"DM Serif Display", serif', fontStyle: 'italic' }}>
              actually
            </span>
            <br />
            holding
            <br />
            you back.
          </h1>
          <p
            className="mt-8 max-w-[480px] text-[1.1rem] leading-[1.7] text-[#a8a8a8]"
            style={{ animation: 'fadeUp 0.7s 0.35s ease both' }}
          >
            Most lifters train hard — but <strong className="font-medium text-[#f5f2ec]">train wrong</strong>. Ratio
            Lifts analyses your strength proportions across key lifts and prescribes the exact accessory work to close
            your weakest gaps.
          </p>
          <div className="mt-8 flex max-w-[460px]" style={{ animation: 'fadeUp 0.7s 0.5s ease both' }}>
            <input
              ref={heroInputRef}
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 border border-r-0 border-[#2e2e2e] bg-[#1c1c1c] px-4 py-3 text-[0.9rem] text-[#f5f2ec] outline-none placeholder:text-[#555] focus:border-[#e8c547]"
            />
            <button
              type="button"
              onClick={() => onSubmit('hero')}
              className="whitespace-nowrap border-none bg-[#e8c547] px-7 py-3 text-[0.8rem] font-medium tracking-[0.12em] text-[#0a0a0a] transition-transform transition-colors duration-150 uppercase hover:scale-[1.02] hover:bg-[#f5d76a]"
            >
              {submittedFrom === 'hero' ? "✓ You're on the list!" : 'Get Early Access'}
            </button>
          </div>
          <p
            className="mt-3 text-[0.72rem] tracking-[0.05em] text-[#555]"
            style={{ animation: 'fadeUp 0.7s 0.6s ease both' }}
          >
            <span
              className="mr-1 inline-block h-[5px] w-[5px] rounded-full bg-[#e8c547] align-middle"
              style={{ animation: 'pulse 2s ease infinite' }}
            />
            Free during beta — no credit card required
          </p>
        </div>

        <div className="relative hidden lg:block" style={{ animation: 'fadeUp 0.7s 0.4s ease both' }}>
          <div className="relative border border-[#2a2a2a] bg-[#111111] p-8">
            <div className="absolute -top-2 left-6 bg-[#0a0a0a] px-[0.6rem] py-0.5 text-[0.62rem] font-medium tracking-[0.18em] text-[#e8c547]">
              YOUR STRENGTH PROFILE
            </div>
            <div
              className="absolute -top-4 -right-4 rotate-3 bg-[#c94f2a] px-3 py-2 text-[0.75rem] tracking-[0.12em] text-white"
              style={{ fontFamily: '"Bebas Neue", sans-serif' }}
            >
              WEAK LINK
            </div>
            <div
              className="mb-7 text-[1rem] tracking-[0.1em] text-[#555]"
              style={{ fontFamily: '"Bebas Neue", sans-serif' }}
            >
              YOUR LIFTS — BENCHMARKS
            </div>

            {[
              { label: 'Back Squat', value: '105 kg — 98%', color: '#6fce8c', width: '92%', delay: '0.8s' },
              { label: 'Bench Press', value: '82 kg — 68%', color: '#e8c547', width: '68%', delay: '1.0s' },
              { label: 'Romanian Deadlift', value: '58 kg — 41%', color: '#c94f2a', width: '41%', delay: '1.2s' },
              { label: 'Overhead Press', value: '60 kg — 78%', color: '#82c4d4', width: '78%', delay: '1.4s' },
              { label: 'Hip Thrust', value: '88 kg — 55%', color: '#a89fe8', width: '55%', delay: '1.6s' },
            ].map((row) => (
              <div key={row.label} className="mb-3">
                <div className="mb-1.5 flex justify-between text-[0.75rem] tracking-[0.08em] text-[#a8a8a8]">
                  <span className="font-medium uppercase text-[#a8a8a8]">{row.label}</span>
                  <span className="font-medium text-[#f5f2ec]">{row.value}</span>
                </div>
                <div className="h-[6px] overflow-hidden bg-[#1c1c1c]">
                  <div
                    className="h-full"
                    style={{
                      background: row.color,
                      width: row.width,
                      animation: `barGrow 1.4s cubic-bezier(0.16,1,0.3,1) both`,
                      animationDelay: row.delay,
                    }}
                  />
                </div>
              </div>
            ))}

            <div className="mt-7 border-l-2 border-[#c94f2a] bg-[rgba(201,79,42,0.1)] px-4 py-3 text-[0.8rem] leading-[1.6] text-[#a8a8a8]">
              <strong className="text-[#c94f2a]">
                ⚠ Weak link identified:
              </strong>{' '}
              Your Romanian Deadlift is your limiting factor. Strengthening your posterior chain will directly unlock
              your squat and deadlift ceiling.
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="border-y border-[#2a2a2a] bg-[#111111] px-10 py-28">
        <div className="mx-auto grid max-w-[1200px] gap-16 lg:grid-cols-2">
          <div
            data-reveal
            className="opacity-0 translate-y-6 transition-all duration-700 ease-out"
          >
            <div className="mb-4 flex items-center gap-[0.6rem] text-[0.68rem] font-medium uppercase tracking-[0.22em] text-[#e8c547]">
              <span className="inline-block h-px w-5 bg-[#e8c547]" />
              The Problem
            </div>
            <h2
              className="text-[clamp(2.8rem,5vw,5rem)] leading-[0.95] tracking-[0.02em]"
              style={{ fontFamily: '"Bebas Neue", sans-serif' }}
            >
              You&apos;re not
              <br />
              training{' '}
              <span style={{ fontFamily: '"DM Serif Display", serif', fontStyle: 'italic' }} className="text-[#e8c547]">
                wrong.
              </span>
              <br />
              You&apos;re training
              <br />
              <span style={{ fontFamily: '"DM Serif Display", serif', fontStyle: 'italic' }} className="text-[#e8c547]">
                blind.
              </span>
            </h2>
            <p className="mt-6 max-w-[560px] text-[1rem] leading-[1.75] text-[#a8a8a8]">
              More sets, more weight, more programmes — but you keep plateauing. The issue isn&apos;t effort. It&apos;s
              that no one has ever shown you{' '}
              <span style={{ fontFamily: '"DM Serif Display", serif', fontStyle: 'italic' }}>
                which specific muscle groups are disproportionately weak
              </span>{' '}
              relative to your strongest lifts. Until now.
            </p>
          </div>

          <div
            data-reveal
            className="opacity-0 translate-y-6 transition-all duration-700 ease-out"
          >
            <div className="mt-12 grid gap-[1.5px] bg-[#2a2a2a] sm:mt-0 sm:grid-cols-2">
              {[
                {
                  num: '73%',
                  desc: "of lifters plateau due to muscular imbalances they aren't aware of",
                },
                {
                  num: '2×',
                  desc: 'faster strength gains when training specifically addresses weak ratios',
                },
                {
                  num: '8wks',
                  desc: 'average time for lifters to see a meaningful strength jump after targeted accessory work',
                },
                {
                  num: '0',
                  desc: 'apps until now that diagnose and prescribe based on your actual ratio data',
                },
              ].map((stat) => (
                <div key={stat.num} className="bg-[#111111] px-6 py-8">
                  <div className="font-[&quot;Bebas Neue&quot;,theme(fontFamily.sans)] text-[3.2rem] leading-none text-[#f5f2ec]">
                    {stat.num.replace(/(\\d+)(.*)/, '$1')}
                    <span className="text-[#e8c547]">
                      {stat.num.replace(/(\\d+)(.*)/, '$2')}
                    </span>
                  </div>
                  <div className="mt-2 text-[0.78rem] leading-[1.5] text-[#a8a8a8]">
                    {stat.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="px-10 py-28">
        <div className="how mx-auto max-w-[1200px]">
          <div
            data-reveal
            className="mb-16 opacity-0 translate-y-6 transition-all duration-700 ease-out"
          >
            <div className="mb-4 flex items-center gap-[0.6rem] text-[0.68rem] font-medium uppercase tracking-[0.22em] text-[#e8c547]">
              <span className="inline-block h-px w-5 bg-[#e8c547]" />
              How It Works
            </div>
            <h2
              className="text-[clamp(2.8rem,5vw,5rem)] leading-[0.95] tracking-[0.02em]"
              style={{ fontFamily: '"Bebas Neue", sans-serif' }}
            >
              From numbers
              <br />
              to{' '}
              <span style={{ fontFamily: '"DM Serif Display", serif', fontStyle: 'italic' }} className="text-[#e8c547]">
                gains
              </span>{' '}
              in
              <br />
              three steps.
            </h2>
          </div>
          <div className="grid gap-[1.5px] bg-[#2a2a2a] md:grid-cols-3">
            {[
              {
                num: '01',
                icon: '📊',
                title: 'Log Your Lifts',
                body: 'Enter your current working weights across your key compound movements. Squat, hinge, press, pull — the foundations of every strong body. Takes under two minutes.',
              },
              {
                num: '02',
                icon: '🔬',
                title: 'Get Your Diagnosis',
                body: "Ratio Lifts compares your numbers against evidence-based strength ratio benchmarks. You'll see exactly which movements are lagging — and precisely why they're limiting your overall progress.",
              },
              {
                num: '03',
                icon: '🎯',
                title: 'Follow Your Prescription',
                body: 'Receive a targeted accessory programme built around your specific gaps. Not generic workouts — a direct response to your data. Train purposefully, and watch your main lifts follow.',
              },
            ].map((step) => (
              <div
                key={step.num}
                data-reveal
                className="relative bg-[#0a0a0a] px-8 py-10 opacity-0 translate-y-6 transition-all duration-700 ease-out hover:bg-[#111111]"
              >
                <div
                  className="mb-4 text-[5rem] leading-none text-[#2a2a2a] transition-colors duration-200"
                  style={{ fontFamily: '"Bebas Neue", sans-serif' }}
                >
                  {step.num}
                </div>
                <div className="absolute right-8 top-8 text-[1.4rem] opacity-25">
                  {step.icon}
                </div>
                <div
                  className="mb-2 text-[1.5rem] tracking-[0.06em] text-[#f5f2ec]"
                  style={{ fontFamily: '"Bebas Neue", sans-serif' }}
                >
                  {step.title}
                </div>
                <div className="text-[0.87rem] leading-[1.7] text-[#a8a8a8]">
                  {step.body}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RATIO EXPLAINER */}
      <section className="border-y border-[#2a2a2a] bg-[#111111] px-10 py-28">
        <div className="mx-auto grid max-w-[1200px] gap-16 lg:grid-cols-[1fr,1.2fr]">
          <div
            data-reveal
            className="opacity-0 translate-y-6 transition-all duration-700 ease-out"
          >
            <div className="mb-4 flex items-center gap-[0.6rem] text-[0.68rem] font-medium uppercase tracking-[0.22em] text-[#e8c547]">
              <span className="inline-block h-px w-5 bg-[#e8c547]" />
              The Science
            </div>
            <h2
              className="text-[clamp(2.8rem,5vw,5rem)] leading-[0.95] tracking-[0.02em]"
              style={{ fontFamily: '"Bebas Neue", sans-serif' }}
            >
              Strength
              <br />
              isn&apos;t just
              <br />
              <span style={{ fontFamily: '"DM Serif Display", serif', fontStyle: 'italic' }} className="text-[#e8c547]">
                numbers.
              </span>
              <br />
              It&apos;s ratios.
            </h2>
            <p className="mt-6 max-w-[560px] text-[1rem] leading-[1.75] text-[#a8a8a8]">
              Elite coaches have known for decades that the{' '}
              <span style={{ fontFamily: '"DM Serif Display", serif', fontStyle: 'italic' }}>relationship</span> between
              lifts matters more than the lifts themselves. A squat that far outpaces your hip hinge is a ticking clock
              for injury and plateau. Ratio Lifts makes this invisible data visible for the first time.
            </p>
            <p className="mt-4 max-w-[560px] text-[1rem] leading-[1.75] text-[#a8a8a8]">
              We map your lifts against peer-reviewed ratio targets — then tell you exactly which accessory exercises
              will bring you into balance and unlock your next level of strength.
            </p>
          </div>

          <div
            data-reveal
            className="opacity-0 translate-y-6 transition-all duration-700 ease-out"
          >
            <div className="overflow-hidden border border-[#2a2a2a] bg-[#0a0a0a]">
              <div className="grid grid-cols-3 gap-0 border-b border-[#2a2a2a] bg-[#1c1c1c] px-5 py-3 text-[0.65rem] font-medium uppercase tracking-[0.15em] text-[#555]">
                <span>Movement</span>
                <span>Ideal Ratio</span>
                <span>Your Status</span>
              </div>
              {[
                { lift: 'Back Squat', ideal: 'Baseline', status: 'Strong', badge: 'good' },
                { lift: 'Deadlift', ideal: '1.2× Squat', status: 'On Track', badge: 'good' },
                { lift: 'RDL', ideal: '0.8× Squat', status: 'Fix This', badge: 'fix' },
                { lift: 'Bench Press', ideal: '0.75× Squat', status: 'Close', badge: 'warn' },
                { lift: 'Overhead Press', ideal: '0.65× Bench', status: 'Strong', badge: 'good' },
                { lift: 'Hip Thrust', ideal: '1.5× Squat', status: 'Close', badge: 'warn' },
              ].map((row) => (
                <div
                  key={row.lift}
                  className="grid grid-cols-3 items-center border-b border-[#2a2a2a] px-5 py-4 text-[0.85rem] transition-colors duration-200 last:border-b-0 hover:bg-[#1c1c1c]"
                >
                  <span className="font-medium text-[#f5f2ec]">{row.lift}</span>
                  <span className="text-[#a8a8a8]">{row.ideal}</span>
                  <span>
                    <span
                      className={`inline-block px-2 py-1 text-[0.65rem] font-medium uppercase tracking-[0.1em] ${
                        row.badge === 'good'
                          ? 'bg-[rgba(111,206,140,0.15)] text-[#6fce8c]'
                          : row.badge === 'warn'
                            ? 'bg-[rgba(232,197,71,0.15)] text-[#e8c547]'
                            : 'bg-[rgba(201,79,42,0.2)] text-[#e8856a]'
                      }`}
                    >
                      {row.status}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="px-10 py-28">
        <div className="mx-auto max-w-[1200px]">
          <div
            data-reveal
            className="mb-16 opacity-0 translate-y-6 transition-all duration-700 ease-out"
          >
            <div className="mb-4 flex items-center gap-[0.6rem] text-[0.68rem] font-medium uppercase tracking-[0.22em] text-[#e8c547]">
              <span className="inline-block h-px w-5 bg-[#e8c547]" />
              Why Ratio Lifts
            </div>
            <h2
              className="text-[clamp(2.8rem,5vw,5rem)] leading-[0.95] tracking-[0.02em]"
              style={{ fontFamily: '"Bebas Neue", sans-serif' }}
            >
              Every session.
              <br />
              <span style={{ fontFamily: '"DM Serif Display", serif', fontStyle: 'italic' }} className="text-[#e8c547]">
                On purpose.
              </span>
            </h2>
          </div>
          <div className="grid gap-[1.5px] bg-[#2a2a2a] md:grid-cols-2">
            {[
              {
                icon: '⚡',
                title: 'Break Plateaus Faster',
                body: 'Stop adding weight to lifts that are already strong. Target the true bottleneck and watch your compound lifts jump as a result — often within weeks.',
              },
              {
                icon: '🛡️',
                title: 'Train Injury-Free',
                body: "Muscular imbalances are the leading cause of overuse injuries. Ratio Lifts identifies dangerous gaps before they become problems, so you stay in the gym, not out of it.",
              },
              {
                icon: '🎯',
                title: 'Know Exactly What to Do',
                body: 'No more second-guessing accessory choices. Your prescription is generated from your data — the right exercises, rep ranges, and priorities built for you specifically.',
              },
              {
                icon: '📈',
                title: 'Track Real Progress',
                body: 'Watch your strength profile transform over time. Visual ratio tracking keeps you motivated and shows you exactly how each training block is reshaping your weaknesses into strengths.',
              },
            ].map((benefit) => (
              <div
                key={benefit.title}
                data-reveal
                className="relative overflow-hidden bg-[#0a0a0a] px-10 py-12 opacity-0 translate-y-6 transition-all duration-700 ease-out"
              >
                <div className="mb-4 text-[2rem]">{benefit.icon}</div>
                <div
                  className="mb-2 text-[1.6rem] tracking-[0.04em] text-[#f5f2ec]"
                  style={{ fontFamily: '"Bebas Neue", sans-serif' }}
                >
                  {benefit.title}
                </div>
                {benefit.title === 'Break Plateaus Faster' && (
                  <div className="text-[0.87rem] leading-[1.75] text-[#a8a8a8]">
                    Stop adding weight to lifts that are already strong.{' '}
                    <strong className="font-medium text-[#f5f2ec]">Target the true bottleneck</strong> and watch your
                    compound lifts jump as a result — often within weeks.
                  </div>
                )}
                {benefit.title === 'Train Injury-Free' && (
                  <div className="text-[0.87rem] leading-[1.75] text-[#a8a8a8]">
                    Muscular imbalances are the leading cause of overuse injuries.{' '}
                    <strong className="font-medium text-[#f5f2ec]">Ratio Lifts identifies dangerous gaps</strong> before
                    they become problems, so you stay in the gym, not out of it.
                  </div>
                )}
                {benefit.title === 'Know Exactly What to Do' && (
                  <div className="text-[0.87rem] leading-[1.75] text-[#a8a8a8]">
                    No more second-guessing accessory choices.{' '}
                    <strong className="font-medium text-[#f5f2ec]">
                      Your prescription is generated from your data
                    </strong>{' '}
                    — the right exercises, rep ranges, and priorities built for you specifically.
                  </div>
                )}
                {benefit.title === 'Track Real Progress' && (
                  <div className="text-[0.87rem] leading-[1.75] text-[#a8a8a8]">
                    Watch your strength profile transform over time.{' '}
                    <strong className="font-medium text-[#f5f2ec]">Visual ratio tracking</strong> keeps you motivated and
                    shows you exactly how each training block is reshaping your weaknesses into strengths.
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AUDIENCE */}
      <section className="border-y border-[#2a2a2a] bg-[#111111] px-10 py-28">
        <div className="mx-auto max-w-[1200px]">
          <div
            data-reveal
            className="mb-14 opacity-0 translate-y-6 transition-all duration-700 ease-out"
          >
            <div className="mb-4 flex items-center gap-[0.6rem] text-[0.68rem] font-medium uppercase tracking-[0.22em] text-[#e8c547]">
              <span className="inline-block h-px w-5 bg-[#e8c547]" />
              Who It&apos;s For
            </div>
            <h2
              className="text-[clamp(2.8rem,5vw,5rem)] leading-[0.95] tracking-[0.02em]"
              style={{ fontFamily: '"Bebas Neue", sans-serif' }}
            >
              Built for every
              <br />
              lifter at every
              <br />
              <span style={{ fontFamily: '"DM Serif Display", serif', fontStyle: 'italic' }} className="text-[#e8c547]">
                level.
              </span>
            </h2>
          </div>
          <div className="grid gap-[1.5px] bg-[#2a2a2a] md:grid-cols-4">
            {[
              {
                icon: '🏋️',
                title: 'The Plateau Fighter',
                body: "You've been stuck at the same numbers for months. You know something's off. Ratio Lifts will show you what — and fix it.",
              },
              {
                icon: '🔰',
                title: 'The Smart Beginner',
                body: "Start with balance built in. Learn the relationships between lifts from day one, so you never develop the bad habits that hold intermediate lifters back.",
              },
              {
                icon: '🏆',
                title: 'The Serious Lifter',
                body: 'Every percentage point counts. Ratio Lifts gives you the same analytical edge that sports scientists give elite athletes — now in your pocket.',
              },
              {
                icon: '📋',
                title: 'The Coach',
                body: "Stop eyeballing your clients' weak points. Get objective data on their ratio gaps and prescribe accessories with confidence and precision.",
              },
            ].map((persona) => (
              <div
                key={persona.title}
                data-reveal
                className="bg-[#111111] px-6 py-8 opacity-0 translate-y-6 transition-all duration-700 ease-out"
              >
                <div className="mb-3 text-[2.2rem]">{persona.icon}</div>
                <div
                  className="mb-2 text-[1.2rem] tracking-[0.06em] text-[#e8c547]"
                  style={{ fontFamily: '"Bebas Neue", sans-serif' }}
                >
                  {persona.title}
                </div>
                <div className="text-[0.82rem] leading-[1.65] text-[#a8a8a8]">
                  {persona.body}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="px-10 py-28">
        <div className="mx-auto max-w-[1200px]">
          <div
            data-reveal
            className="opacity-0 translate-y-6 transition-all duration-700 ease-out"
          >
            <div className="mb-4 flex items-center gap-[0.6rem] text-[0.68rem] font-medium uppercase tracking-[0.22em] text-[#e8c547]">
              <span className="inline-block h-px w-5 bg-[#e8c547]" />
              Early Feedback
            </div>
            <h2
              className="text-[clamp(2.8rem,5vw,5rem)] leading-[0.95] tracking-[0.02em]"
              style={{ fontFamily: '"Bebas Neue", sans-serif' }}
            >
              What beta
              <br />
              testers <span className="font-[&quot;DM Serif Display&quot;,theme(fontFamily.serif)] italic text-[#e8c547]">say.</span>
            </h2>
          </div>
          <div className="mt-14 grid gap-[1.5px] bg-[#2a2a2a] md:grid-cols-3">
            {[
              {
                quote:
                  "I'd been stuck at the same squat for nine months. One week after following the RDL prescription, everything unlocked. I added 10kg in a month.",
                attr: 'James T. — Recreational Lifter, 3 yrs training',
              },
              {
                quote:
                  'I thought I was training smart. Turns out my posterior chain was embarrassingly underdeveloped relative to my quads. This app made it obvious in 30 seconds.',
                attr: 'Sarah K. — Fitness Enthusiast, 5 yrs training',
              },
              {
                quote:
                  "I use this with all my online coaching clients now. The ratio framework gives both of us a shared language for what to prioritise. It's become essential.",
                attr: 'Marcus L. — Online Strength Coach',
              },
            ].map((proof, index) => (
              <div
                key={proof.attr}
                data-reveal
                className="bg-[#0a0a0a] px-8 py-10 opacity-0 translate-y-6 transition-all duration-700 ease-out"
                style={{ transitionDelay: `${index * 80}ms` }}
              >
                <div className="mb-4 text-[0.9rem] tracking-[0.1em] text-[#e8c547]">★★★★★</div>
                <div
                  className="mb-5 text-[1.05rem] italic leading-[1.6] text-[#f5f2ec]"
                  style={{ fontFamily: '"DM Serif Display", serif' }}
                >
                  “{proof.quote}”
                </div>
                <div className="text-[0.75rem] uppercase tracking-[0.1em] text-[#555]">
                  <strong className="font-medium text-[#a8a8a8]">
                    {proof.attr.split(' — ')[0]}
                  </strong>{' '}
                  — {proof.attr.split(' — ')[1]}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative overflow-hidden bg-[#e8c547] px-10 py-28 text-center">
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[18vw] tracking-[0.05em] text-black/10"
          style={{ fontFamily: '"Bebas Neue", sans-serif' }}
        >
          RATIO LIFTS
        </div>
        <div className="relative z-10">
          <div className="mb-4 flex items-center justify-center gap-[0.6rem] text-[0.68rem] font-medium uppercase tracking-[0.22em] text-black/50">
            <span className="inline-block h-px w-5 bg-black/30" />
            Join the Waitlist
          </div>
          <h2
            className="mx-auto mb-3 max-w-[700px] text-[clamp(3rem,6vw,6rem)] leading-[0.95] tracking-[0.02em] text-[#0a0a0a]"
            style={{ fontFamily: '"Bebas Neue", sans-serif' }}
          >
            Stop guessing.
            <br />
            Start{' '}
            <span style={{ fontFamily: '"DM Serif Display", serif', fontStyle: 'italic' }} className="text-[#111111]">
              lifting
            </span>
            <br />
            with data.
          </h2>
          <p className="mx-auto mb-10 max-w-[460px] text-[1rem] text-black/65">
            Join the waitlist for free early access. Be first to know when Ratio Lifts launches — and get a founding
            member discount.
          </p>
          <div className="mx-auto flex max-w-[460px]">
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 border border-r-0 border-black/20 bg-black/10 px-4 py-3 text-[0.9rem] text-[#0a0a0a] outline-none placeholder:text-black/40"
            />
            <button
              type="button"
              onClick={() => onSubmit('final')}
              className="whitespace-nowrap border-none bg-[#0a0a0a] px-7 py-3 text-[0.8rem] font-medium tracking-[0.12em] text-[#e8c547] transition-colors duration-200 uppercase hover:bg-[#111111]"
            >
              {submittedFrom === 'final' ? "✓ You're on the list!" : 'Get Early Access'}
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="flex items-center justify-between border-t border-[#2a2a2a] bg-[#0a0a0a] px-10 py-8 text-[0.75rem] tracking-[0.06em] text-[#555]">
        <div>© 2025 Ratio Lifts. All rights reserved.</div>
        <div className="flex gap-8">
          <a href="#" className="text-[#555] no-underline hover:text-[#e8c547]">
            Privacy
          </a>
          <a href="#" className="text-[#555] no-underline hover:text-[#e8c547]">
            Terms
          </a>
          <a href="#" className="text-[#555] no-underline hover:text-[#e8c547]">
            Contact
          </a>
        </div>
      </footer>

      {/* Optional link into the main app */}
      <div className="fixed bottom-4 right-4 z-40">
        <Link
          to="/app"
          className="rounded-full bg-[#111111]/80 px-5 py-2 text-xs font-medium uppercase tracking-[0.14em] text-[#f5f2ec] backdrop-blur hover:bg-[#111111]"
        >
          Open Strength Tool
        </Link>
      </div>
    </div>
  )
}

export default LandingPage

