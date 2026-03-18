import { useState, useCallback, useEffect } from 'react'
import { Header } from '../components/Header'
import { LiftCard } from '../components/LiftCard'
import { SecondarySection } from '../components/SecondarySection'
import { ResultCard } from '../components/ResultCard'
import type { FormState, LiftInput, Units, DiagnosticResult } from '../types'
import { defaultFormState } from '../defaults'
import { runDiagnostic } from '../calculations'
import { trackEvent } from '../analytics'
import type { SavedAthleteScenario } from '../types'

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

function loadCoachMode(): boolean {
  try {
    return localStorage.getItem('ratio-lifts-coach-mode') === '1'
  } catch {
    /* ignore */
    return false
  }
}

function persistCoachMode(v: boolean) {
  try {
    localStorage.setItem('ratio-lifts-coach-mode', v ? '1' : '0')
  } catch {
    /* ignore */
  }
}

function loadCoachName(): string | undefined {
  try {
    const s = localStorage.getItem('ratio-lifts-coach-name')
    return s ? s : undefined
  } catch {
    /* ignore */
    return undefined
  }
}

function persistCoachName(name: string | undefined) {
  try {
    if (!name) localStorage.removeItem('ratio-lifts-coach-name')
    else localStorage.setItem('ratio-lifts-coach-name', name)
  } catch {
    /* ignore */
  }
}

const ATHLETES_KEY = 'ratio-lifts-saved-athletes-v1'

function loadSavedAthletes(): SavedAthleteScenario[] {
  try {
    const raw = localStorage.getItem(ATHLETES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SavedAthleteScenario[]
    return Array.isArray(parsed) ? parsed.slice(0, 10) : []
  } catch {
    /* ignore */
    return []
  }
}

function persistSavedAthletes(rows: SavedAthleteScenario[]) {
  try {
    localStorage.setItem(ATHLETES_KEY, JSON.stringify(rows.slice(0, 10)))
  } catch {
    /* ignore */
  }
}

export default function FormApp() {
  const [form, setForm] = useState<FormState>(() => ({
    ...defaultFormState,
    units: loadPersistedUnits(),
    coach_mode: loadCoachMode(),
    coach_name: loadCoachName(),
  }))
  const [result, setResult] = useState<DiagnosticResult | null>(null)
  const [savedAthletes, setSavedAthletes] = useState<SavedAthleteScenario[]>(() => loadSavedAthletes())

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

  const setCoachMode = useCallback(
    (next: boolean) => {
      updateForm({ coach_mode: next })
      persistCoachMode(next)
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

  const handleSelectAthlete = useCallback(
    (id: string) => {
      const row = savedAthletes.find((a) => a.id === id)
      if (!row) return
      setForm(row.form)
      setResult(row.result)
      trackEvent('coach_load_athlete')
    },
    [savedAthletes],
  )

  const handleSaveScenario = useCallback(() => {
    if (!result) return
    const primary = result.flags.find((f) => !f.id.startsWith('typical_'))?.label ?? null
    const row: SavedAthleteScenario = {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      athleteName: form.athlete_name ?? 'Unnamed',
      savedAt: new Date().toISOString(),
      primaryImbalance: primary,
      form,
      result,
    }
    const next = [row, ...savedAthletes].slice(0, 10)
    setSavedAthletes(next)
    persistSavedAthletes(next)
    trackEvent('coach_save_athlete')
  }, [form, result, savedAthletes])

  const handleGenerate = () => {
    trackEvent('form_complete')
    const diagnostic = runDiagnostic(form.lifts, {
      bodyweight: form.bodyweight,
      experience: form.experience,
      injury: form.injury,
      injury_notes: form.injury_notes,
    })
    setResult(diagnostic)
  }

  useEffect(() => {
    trackEvent('form_start')
  }, [])

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

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Header
        units={form.units}
        onUnitsChange={setUnits}
        coachMode={!!form.coach_mode}
        onCoachModeChange={setCoachMode}
        savedAthletes={savedAthletes.map((a) => ({
          id: a.id,
          label: `${a.athleteName || 'Unnamed'} · ${new Date(a.savedAt).toLocaleDateString()}${
            a.primaryImbalance ? ` · ${a.primaryImbalance}` : ''
          }`,
        }))}
        onSelectAthlete={handleSelectAthlete}
      />

      <main className={`mx-auto px-6 pb-28 pt-6 ${result ? 'max-w-4xl' : 'max-w-lg'}`}>
        {/* Hero: tight, one screen max */}
        <header className="mb-8 text-center">
          <h1 className="font-display text-[clamp(2.5rem,6vw,4rem)] leading-[0.95] tracking-[0.02em] text-[#f5f2ec]">
            FIND YOUR
            <br />
            <span className="text-[#e8c547]">WEAK LINK</span>
          </h1>
          <p className="mt-3 text-[#a8a8a8] text-base sm:text-lg">
            Enter your lifts. Get your diagnosis. Know exactly what to fix.
          </p>
        </header>

        {/* Lifts first */}
        <div className="mb-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
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

        {/* Profile: bodyweight, experience, frequency */}
        <div className="mb-8 grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="bodyweight" className="mb-1 block text-xs font-medium text-[#a8a8a8]">
              Bodyweight (optional)
            </label>
            <input
              id="bodyweight"
              type="number"
              inputMode="decimal"
              min={0}
              step={0.5}
              placeholder="—"
              value={form.bodyweight ?? ''}
              onChange={(e) =>
                updateForm({ bodyweight: e.target.value === '' ? undefined : Number(e.target.value) })
              }
              className="w-full rounded-none border border-[#2a2a2a] bg-[#1c1c1c] px-4 py-3 font-light text-[#f5f2ec] placeholder:text-[#555] focus:border-[#e8c547] focus:outline-none focus:ring-2 focus:ring-[#e8c547]/30"
            />
            <p className="mt-1.5 text-[11px] text-[#555]">
              Unlocks your strength percentiles and full radar breakdown.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#a8a8a8]">Experience</label>
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

        {form.coach_mode && (
          <div className="mb-8 rounded-none border border-[#2a2a2a] bg-[#1c1c1c] p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="coachName" className="mb-1 block text-xs font-medium text-[#a8a8a8]">
                  Coach name
                </label>
                <input
                  id="coachName"
                  type="text"
                  placeholder="e.g. Coach Lee"
                  value={form.coach_name ?? ''}
                  onChange={(e) => {
                    const next = e.target.value || undefined
                    updateForm({ coach_name: next })
                    persistCoachName(next)
                  }}
                  className="w-full rounded-none border border-[#2a2a2a] bg-[#111111] px-4 py-3 font-light text-[#f5f2ec] placeholder:text-[#555] focus:border-[#e8c547] focus:outline-none focus:ring-2 focus:ring-[#e8c547]/30"
                />
              </div>
              <div>
                <label htmlFor="athleteName" className="mb-1 block text-xs font-medium text-[#a8a8a8]">
                  Athlete name
                </label>
                <input
                  id="athleteName"
                  type="text"
                  placeholder="e.g. Alex P."
                  value={form.athlete_name ?? ''}
                  onChange={(e) => updateForm({ athlete_name: e.target.value || undefined })}
                  className="w-full rounded-none border border-[#2a2a2a] bg-[#111111] px-4 py-3 font-light text-[#f5f2ec] placeholder:text-[#555] focus:border-[#e8c547] focus:outline-none focus:ring-2 focus:ring-[#e8c547]/30"
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-[#555]">Included in PDF export.</p>
          </div>
        )}

        <div className="mb-8">
          <SecondarySection form={form} onChange={updateForm} />
        </div>

        {/* Generate: one click, no gate */}
        <div className="mb-8">
          <button
            type="button"
            onClick={result ? () => setResult(null) : handleGenerate}
            disabled={!hasEnoughLifts && !result}
            className="w-full rounded-none bg-[#e8c547] px-4 py-3 font-medium text-[#0a0a0a] hover:bg-[#f5d76a] disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#e8c547]/50 focus:ring-offset-2 focus:ring-offset-[#0a0a0a]"
          >
            {result ? 'Start over' : 'Find my weak link'}
          </button>
          <p className="mt-2 text-center text-xs text-[#555]">
            For information only — not medical advice. Use your head.
          </p>
        </div>

        {result && (
          <div className="mb-8">
            <ResultCard
              form={form}
              result={result}
              coachMode={!!form.coach_mode}
              onSaveScenario={handleSaveScenario}
            />
            {result.oneRMs.length < 2 && (
              <p className="mt-4 text-sm text-[#a8a8a8]">Add another lift to get ratio diagnostics.</p>
            )}
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-10 border-t border-[#2a2a2a] bg-[rgba(10,10,10,0.9)] px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-lg flex-col gap-3">
          {hasEnoughLifts && (
            <button
              type="button"
              onClick={result ? () => setResult(null) : handleGenerate}
              className="w-full rounded-none bg-[#e8c547] px-4 py-3 font-medium text-[#0a0a0a] hover:bg-[#f5d76a] focus:outline-none focus:ring-2 focus:ring-[#e8c547]/50 focus:ring-offset-2 focus:ring-offset-[#0a0a0a]"
            >
              {result ? 'Start over' : 'Find my weak link'}
            </button>
          )}
          {!hasEnoughLifts && (
            <p className="text-center text-xs text-[#555]">
              Fill in at least one lift above to generate your report.
            </p>
          )}
        </div>
      </footer>
    </div>
  )
}

