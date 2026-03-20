import { useState, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Header } from '../components/Header'
import { LiftCard } from '../components/LiftCard'
import { ResultCard } from '../components/ResultCard'
import type { FormState, LiftInput, Units, DiagnosticResult } from '../types'
import { defaultFormState } from '../defaults'
import { runDiagnostic } from '../calculations'
import { trackEvent } from '../analytics'
import { displayToKg, kgToDisplay } from '../units'
import { Seo } from '../components/Seo'

const EXPERIENCE_OPTIONS: FormState['experience'][] = ['Beginner', 'Intermediate', 'Advanced']
const FREQUENCY_OPTIONS: FormState['training_frequency'][] = ['1-2', '3-4', '5+']

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
  experience: FormState['experience']
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
    experience: payload.experience,
    training_frequency: payload.training_frequency,
    primary_goal: payload.primary_goal,
    lifts: payload.lifts,
    equipment: payload.equipment,
    injury: payload.injury,
    injury_notes: payload.injury_notes,
    coach_mode: false,
    athlete_name: undefined,
    coach_name: undefined,
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
  const canGenerate = hasBodyweight && hasEnoughLifts

  const GOALS: FormState['primary_goal'][] = ['Strength', 'Hypertrophy', 'Power', 'Rehab']

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
          <p className="mt-3 text-[#a8a8a8] text-base sm:text-lg">
            Enter your lifts. Get your diagnosis. Know exactly what to fix.
          </p>
        </header>

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
          <p className="mt-1.5 text-[11px] text-[#555]">Unlocks your strength percentile and full radar breakdown.</p>
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
              hint={i === 0 ? 'Enter best working set, not warmup.' : undefined}
            />
          ))}
        </div>

        {/* Primary goal (inline row) */}
        <div className="mb-8">
          <p className="mb-2 text-xs font-medium text-[#a8a8a8]">Primary Goal</p>
          <div className="flex flex-wrap gap-2">
            {GOALS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => updateForm({ primary_goal: g })}
                className={`rounded-none px-3 py-2 text-sm font-medium ${
                  form.primary_goal === g
                    ? 'bg-[#e8c547] text-[#0a0a0a]'
                    : 'bg-[#111111] text-[#a8a8a8] border border-[#2a2a2a] hover:bg-[#2e2e2e]'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-[#555]">
            Your goal affects the ideal ratios and accessory recommendations.
          </p>
        </div>

        <div className="mb-8">
          <label className="mb-1 block text-xs font-medium text-[#a8a8a8]">Experience Level</label>
          <select
            value={form.experience}
            onChange={(e) => updateForm({ experience: e.target.value as FormState['experience'] })}
            className="w-full rounded-none border border-[#2a2a2a] bg-[#1c1c1c] px-4 py-3 font-light text-[#f5f2ec] focus:border-[#e8c547] focus:outline-none focus:ring-2 focus:ring-[#e8c547]/30"
          >
            {EXPERIENCE_OPTIONS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
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

        {/* Equipment available */}
        <div className="mb-8">
          <label className="mb-2 block text-xs font-medium text-[#a8a8a8]">Equipment Available</label>
          <div className="flex flex-wrap gap-2">
            {['Barbell', 'Dumbbells', 'Kettlebell', 'Bands', 'Cable', 'Bodyweight'].map((e) => (
              <label
                key={e}
                className="flex items-center gap-1.5 rounded-none bg-[#111111] border border-[#2a2a2a] px-3 py-2 text-sm text-[#a8a8a8]"
              >
                <input
                  type="checkbox"
                  checked={form.equipment.includes(e)}
                  onChange={() => {
                    const next = form.equipment.includes(e) ? form.equipment.filter((x) => x !== e) : [...form.equipment, e]
                    updateForm({ equipment: next })
                  }}
                  className="rounded-none border-[#2a2a2a] bg-[#111111] text-[#e8c547] focus:ring-[#e8c547]/50"
                />
                {e}
              </label>
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
              coachMode={!!form.coach_mode}
              onSaveScenario={handleSaveScenario}
            />
          </div>
        )}
      </main>

      {/* Footer: matches /why design reference */}
      <footer className="flex items-center justify-between border-t border-[#2a2a2a] bg-[#0a0a0a] px-10 py-8 text-[0.75rem] tracking-[0.06em] text-[#555]">
        <span>© 2025 Ratio Lifts. All rights reserved.</span>
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

