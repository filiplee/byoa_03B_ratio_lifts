import { useState, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Header } from '../components/Header'
import { LiftCard } from '../components/LiftCard'
import { ResultCard } from '../components/ResultCard'
import type { FormState, Experience, LiftInput, Units, DiagnosticResult } from '../types'
import { defaultFormState } from '../defaults'
import { runDiagnostic } from '../calculations'
import { trackEvent } from '../analytics'
import { displayToKg, kgToDisplay } from '../units'
import { Seo } from '../components/Seo'
import { SecondarySection } from '../components/SecondarySection'

const STRENGTH_LEVEL_CHOICES: { value: Experience; hint: string }[] = [
  { value: 'Beginner', hint: '0–6 months' },
  { value: 'Intermediate', hint: '6 months–2 years' },
  { value: 'Advanced', hint: '2+ years' },
]
const FREQUENCY_OPTIONS: FormState['training_frequency'][] = ['1-2', '3-4', '5+']
const GENDER_OPTIONS: { value: FormState['gender']; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]

function loadPersistedUnits(): Units {
  try {
    const s = localStorage.getItem('ratio-lifts-units')
    if (s === 'kg' || s === 'lb') return s
  } catch {
    /* ignore */
  }
  return 'kg'
}

function persistUnits(units: Units) {
  try {
    localStorage.setItem('ratio-lifts-units', units)
  } catch {
    /* ignore */
  }
}

const SHARE_PARAM = 's'

function base64UrlEncode(plain: string): string {
  const bytes = new TextEncoder().encode(plain)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlDecode(encoded: string): string {
  const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '==='.slice((b64.length + 3) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

type SharedPayloadV1 = {
  v: 1
  units: Units
  bodyweight?: number
  gender?: FormState['gender']
  experience: Experience
  training_frequency: FormState['training_frequency']
  primary_goal: FormState['primary_goal']
  equipment: string[]
  injury: boolean
  injury_notes?: string
  lifts: FormState['lifts']
}

function getSharePayloadFromUrl(): SharedPayloadV1 | null {
  try {
    const params = new URLSearchParams(window.location.search)
    const encoded = params.get(SHARE_PARAM)
    if (!encoded) return null
    const decodedJson = base64UrlDecode(encoded)
    const payload = JSON.parse(decodedJson) as SharedPayloadV1
    if (!payload || payload.v !== 1) return null
    return payload
  } catch {
    return null
  }
}

function buildFormFromSharePayload(payload: SharedPayloadV1): FormState {
  return {
    ...defaultFormState,
    units: payload.units,
    bodyweight: payload.bodyweight,
    gender: payload.gender ?? 'prefer_not_to_say',
    experience: payload.experience ?? 'Intermediate',
    training_frequency: payload.training_frequency,
    primary_goal: payload.primary_goal,
    lifts: payload.lifts,
    equipment: payload.equipment,
    injury: payload.injury,
    injury_notes: payload.injury_notes,
  }
}

export default function FormApp({ onRetestReportGenerated }: { onRetestReportGenerated?: () => void }) {
  const [form, setForm] = useState<FormState>(() => {
    const payload = getSharePayloadFromUrl()
    if (payload) return buildFormFromSharePayload(payload)
    return { ...defaultFormState, units: loadPersistedUnits() }
  })
  const [result, setResult] = useState<DiagnosticResult | null>(() => {
    const payload = getSharePayloadFromUrl()
    if (!payload) return null
    const nextForm = buildFormFromSharePayload(payload)
    if (typeof nextForm.bodyweight !== 'number' || nextForm.bodyweight <= 0) return null
    return runDiagnostic(nextForm.lifts, {
      bodyweight: nextForm.bodyweight,
      gender: nextForm.gender,
      experience: nextForm.experience,
      injury: nextForm.injury,
      injury_notes: nextForm.injury_notes,
      equipment: nextForm.equipment,
      training_frequency: nextForm.training_frequency,
    })
  })
  const [isGenerating, setIsGenerating] = useState(false)

  const updateForm = useCallback((patch: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }, [])

  const setUnits = useCallback(
    (units: Units) => {
      updateForm({ units })
      persistUnits(units)
    },
    [updateForm],
  )

  const setLift = useCallback((index: number, lift: LiftInput) => {
    setForm((prev) => {
      const next = [...prev.lifts]
      next[index] = lift
      return { ...prev, lifts: next }
    })
  }, [])

  const handleRetest = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setResult(null)
    setForm({ ...defaultFormState, units: loadPersistedUnits() })
    try {
      const url = new URL(window.location.href)
      if (url.searchParams.has(SHARE_PARAM)) {
        url.searchParams.delete(SHARE_PARAM)
        window.history.replaceState({}, '', url.toString())
      }
    } catch {
      /* ignore */
    }
  }, [])

  const handleSaveScenario = useCallback(async () => {
    if (!result) return
    const payload: SharedPayloadV1 = {
      v: 1,
      units: form.units,
      bodyweight: form.bodyweight,
      gender: form.gender,
      experience: form.experience,
      training_frequency: form.training_frequency,
      primary_goal: form.primary_goal,
      equipment: form.equipment,
      injury: form.injury,
      injury_notes: form.injury_notes,
      lifts: form.lifts,
    }

    const encoded = base64UrlEncode(JSON.stringify(payload))

    const url = new URL(window.location.href)
    url.searchParams.set(SHARE_PARAM, encoded)
    // Persist the share link without triggering a full reload.
    window.history.replaceState({}, '', url.toString())

    // Clipboard is best-effort; the UI will show a toast either way.
    await navigator.clipboard.writeText(url.toString())
  }, [form, result])

  const handleGenerate = () => {
    if (isGenerating) return
    if (form.experience == null) return
    if (typeof form.bodyweight !== 'number' || form.bodyweight <= 0) return
    const hasEnoughLiftsNow = form.lifts.some(
      (l) =>
        (l.method === 'one_rm' && l.one_rm != null && l.one_rm > 0) ||
        (l.method === 'weight_reps' &&
          l.weight != null &&
          l.weight > 0 &&
          l.reps != null &&
          l.reps >= 1 &&
          l.reps <= 20),
    )
    if (!hasEnoughLiftsNow) return
    onRetestReportGenerated?.()
    setIsGenerating(true)
    trackEvent('form_complete')
    const startedAt = Date.now()
    const diagnostic = runDiagnostic(form.lifts, {
      bodyweight: form.bodyweight,
      gender: form.gender,
      experience: form.experience,
      injury: form.injury,
      injury_notes: form.injury_notes,
      equipment: form.equipment,
      training_frequency: form.training_frequency,
    })
    const elapsed = Date.now() - startedAt
    const remaining = Math.max(0, 300 - elapsed)
    window.setTimeout(() => {
      setResult(diagnostic)
      setIsGenerating(false)
    }, remaining)
  }

  useEffect(() => {
    trackEvent('form_start')
  }, [])

  useEffect(() => {
    if (!result) return
    document.getElementById('results-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [result])

  const hasEnoughLifts = form.lifts.some(
    (l) =>
      (l.method === 'one_rm' && l.one_rm != null && l.one_rm > 0) ||
      (l.method === 'weight_reps' &&
        l.weight != null &&
        l.weight > 0 &&
        l.reps != null &&
        l.reps >= 1 &&
        l.reps <= 20),
  )
  const hasBodyweight = typeof form.bodyweight === 'number' && form.bodyweight > 0
  const hasExperience = form.experience != null
  const canGenerate = hasBodyweight && hasEnoughLifts && hasExperience

  return (
    <>
      <Seo
        config={{
          title: 'Ratio Lifts — Strength Report',
          description:
            'Enter your body weight and lift numbers to find your weak-link ratios and get tailored accessory work. Free during beta.',
          canonicalUrl: 'https://myliftsucks.com/',
          ogImageUrl: 'https://myliftsucks.com/og-image.png',
        }}
      />
      <div className="min-h-screen bg-[#0a0a0a]">
      <Header
        units={form.units}
        onUnitsChange={setUnits}
      />

      <main className={`mx-auto px-6 pb-28 pt-[73px] ${result ? 'max-w-4xl' : 'max-w-lg'}`}>
        {/* Hero: tight, one screen max */}
        <header className="mb-8 text-center">
          <h1 className="font-display text-[clamp(2.5rem,6vw,4rem)] leading-[0.95] tracking-[0.02em] text-[#f5f2ec]">
            FIND YOUR
            <br />
            <span
              className="italic text-[#e8c547]"
              style={{ fontFamily: '"DM Serif Display", serif', fontStyle: 'italic' }}
            >
              Weak Link
            </span>
          </h1>
          <p className="mt-3 text-lg font-normal text-[#a8a8a8] sm:text-xl">
            {"You're not training wrong. You're training blind."}
          </p>
          <p className="mt-2 text-base font-normal text-[#a8a8a8] sm:text-lg">
            Enter your numbers below — takes under 60 seconds.
          </p>
        </header>

        {/* Strength level — required first (sets percentile baseline) */}
        <div className="mb-8 rounded-none border border-[#2a2a2a] bg-[#1c1c1c] p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-[#a8a8a8]">Strength level</p>
          <p className="mt-1 text-sm font-medium text-[#e8e5df]">How long have you been training?</p>
          <p className="mt-1 text-[11px] text-[#555]">This determines your percentile baseline.</p>
          <div className="mt-4 space-y-3" role="radiogroup" aria-label="Strength level">
            {STRENGTH_LEVEL_CHOICES.map(({ value, hint }) => (
              <label
                key={value}
                className={`flex cursor-pointer items-start gap-3 rounded-none border px-4 py-3 text-left transition-colors ${
                  form.experience === value
                    ? 'border-[#5eead4] bg-[#0f1f1c]'
                    : 'border-[#2a2a2a] bg-[#111111] hover:border-[#3a3a3a]'
                }`}
              >
                <input
                  type="radio"
                  name="strength-level"
                  value={value}
                  checked={form.experience === value}
                  onChange={() => updateForm({ experience: value })}
                  className="mt-1 h-4 w-4 border-[#2a2a2a] bg-[#1c1c1c] text-[#5eead4] focus:ring-[#5eead4]"
                />
                <span>
                  <span className="block text-sm font-medium text-[#f5f2ec]">{value}</span>
                  <span className="block text-xs text-[#888]">({hint})</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Bodyweight (required) */}
        <div className="mb-8">
          <label htmlFor="bodyweight" className="mb-1 block text-xs font-medium text-[#a8a8a8]">
            Body Weight
          </label>
          <input
            id="bodyweight"
            type="number"
            inputMode="decimal"
            min={0}
            step={0.5}
            placeholder="—"
            required
            value={form.bodyweight == null ? '' : kgToDisplay(form.bodyweight, form.units)}
            onChange={(e) =>
              updateForm({
                bodyweight:
                  e.target.value === '' ? undefined : displayToKg(Number(e.target.value), form.units),
              })
            }
            className="w-full rounded-none border border-[#2a2a2a] bg-[#1c1c1c] px-4 py-3 font-light text-[#f5f2ec] placeholder:text-[#555] focus:border-[#e8c547] focus:outline-none focus:ring-2 focus:ring-[#e8c547]/30"
          />
          <p className="mt-1.5 text-[11px] text-[#555]">Required for experience-adjusted strength percentiles.</p>
        </div>

        {/* Gender — used for van den Hoek / Kilgore reference tables */}
        <div className="mb-8">
          <p className="mb-2 text-xs font-medium text-[#a8a8a8]">Gender</p>
          <div className="flex flex-wrap gap-4">
            {GENDER_OPTIONS.map(({ value, label }) => (
              <label
                key={value}
                className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[#a8a8a8]"
              >
                <input
                  type="radio"
                  name="gender"
                  value={value}
                  checked={form.gender === value}
                  onChange={() => updateForm({ gender: value })}
                  className="h-4 w-4 border-[#2a2a2a] bg-[#1c1c1c] text-[#e8c547] focus:ring-[#e8c547]"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-[#555]">
            Used to place you in the right weight-class norms. “Prefer not to say” uses male reference curves.
          </p>
        </div>

        {/* Lifts (2x2 on tablet+) */}
        <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-2">
          {form.lifts.slice(0, 4).map((lift, i) => (
            <LiftCard
              key={lift.id}
              lift={lift}
              units={form.units}
              bodyweight={form.bodyweight}
              onChange={(l) => setLift(i, l)}
              hint="Enter best working set, not warmup."
            />
          ))}
        </div>

        <div className="mb-8">
          <SecondarySection form={form} onChange={updateForm} />
        </div>

        <div className="mb-8">
          <label className="mb-2 block text-xs font-medium text-[#a8a8a8]">
            Training frequency (per week)
          </label>
          <div className="flex gap-2">
            {FREQUENCY_OPTIONS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => updateForm({ training_frequency: f })}
                className={`flex-1 rounded-none py-3 text-sm font-medium ${
                  form.training_frequency === f
                    ? 'bg-[#e8c547] text-[#0a0a0a]'
                    : 'bg-[#1c1c1c] text-[#a8a8a8] border border-[#2a2a2a] hover:bg-[#2e2e2e]'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Generate */}
        {!result && (
          <div className="mb-8">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || !canGenerate}
              className="w-full rounded-none bg-[#e8c547] px-4 py-3 font-medium text-[#0a0a0a] hover:bg-[#f5d76a] disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#e8c547]/50 focus:ring-offset-2 focus:ring-offset-[#0a0a0a]"
            >
              {isGenerating ? 'Analyzing…' : 'Find my weak link'}
            </button>
            {!hasExperience && hasEnoughLifts && hasBodyweight && (
              <p className="mt-2 text-center text-xs text-[#e8c547]">Select your strength level above to continue.</p>
            )}
            <p className="mt-2 text-center text-xs text-[#555]">
              For information only — not medical advice. Use your head.
            </p>
          </div>
        )}

        {result && (
          <div className="mb-8">
            <button
              type="button"
              onClick={() => setResult(null)}
              className="mb-4 text-left text-xs font-light text-[#a8a8a8] underline hover:text-[#e8c547]"
            >
              Start over
            </button>
            <ResultCard
              form={form}
              result={result}
              onSaveScenario={handleSaveScenario}
              onRetest={handleRetest}
            />
          </div>
        )}
      </main>

      {/* Footer: matches /why design reference */}
      <footer className="flex items-center justify-between border-t border-[#2a2a2a] bg-[#0a0a0a] px-10 py-8 text-[0.75rem] tracking-[0.06em] text-[#555]">
        <span>© {new Date().getFullYear()} Ratio Lifts. All rights reserved.</span>
        <nav className="flex gap-8">
          <Link to="/privacy" className="text-[#555] no-underline hover:text-[#e8c547]">
            Privacy
          </Link>
          <Link to="/terms" className="text-[#555] no-underline hover:text-[#e8c547]">
            Terms
          </Link>
          <a href="mailto:hello@myliftsucks.com" className="text-[#555] no-underline hover:text-[#e8c547]">
            Contact
          </a>
        </nav>
      </footer>
      </div>
    </>
  )
}

