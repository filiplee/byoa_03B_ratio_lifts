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
  const [showDisclaimer, setShowDisclaimer] = useState(false)
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
    if (!showDisclaimer) {
      setShowDisclaimer(true)
      return
    }
    trackEvent('form_complete')
    const diagnostic = runDiagnostic(form.lifts, {
      bodyweight: form.bodyweight,
      experience: form.experience,
      injury: form.injury,
      injury_notes: form.injury_notes,
    })
    setResult(diagnostic)
    setShowDisclaimer(false)
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
    <div className="min-h-screen bg-slate-700">
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

      <main className={`mx-auto px-6 pb-28 pt-8 ${result ? 'max-w-4xl' : 'max-w-lg'}`}>
        <div className="mb-8 text-center">
          <p className="text-xl font-semibold text-white">
            Find out exactly what&apos;s holding your lifts back.
          </p>
          <p className="mt-2 font-light text-slate-200">
            Enter your numbers. Get a personalised strength diagnosis and accessory prescription in under 60 seconds.
          </p>
        </div>

        {form.coach_mode && (
          <div className="mb-8 rounded-xl border border-slate-500/50 bg-slate-600/50 p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="coachName" className="mb-1 block text-xs font-medium text-slate-300">
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
                  className="w-full rounded-lg border border-slate-500/50 bg-slate-700/50 px-4 py-3 font-light text-white placeholder:text-slate-400 focus:border-teal-500/50 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                />
              </div>
              <div>
                <label htmlFor="athleteName" className="mb-1 block text-xs font-medium text-slate-300">
                  Athlete name
                </label>
                <input
                  id="athleteName"
                  type="text"
                  placeholder="e.g. Alex P."
                  value={form.athlete_name ?? ''}
                  onChange={(e) => updateForm({ athlete_name: e.target.value || undefined })}
                  className="w-full rounded-lg border border-slate-500/50 bg-slate-700/50 px-4 py-3 font-light text-white placeholder:text-slate-400 focus:border-teal-500/50 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-400">Included in PDF export.</p>
          </div>
        )}

        <div className="mb-8 grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="bodyweight" className="mb-1 block text-xs font-medium text-slate-300">
              Bodyweight (optional)
            </label>
            <p className="mb-2 text-[11px] text-slate-400">
              Enter this to unlock percentile rankings in your report.
            </p>
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
              className="w-full rounded-lg border border-slate-500/50 bg-slate-600/50 px-4 py-3 font-light text-white placeholder:text-slate-400 focus:border-teal-500/50 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Experience</label>
            <select
              value={form.experience}
              onChange={(e) => updateForm({ experience: e.target.value as FormState['experience'] })}
              className="w-full rounded-lg border border-slate-500/50 bg-slate-600/50 px-4 py-3 font-light text-white focus:border-teal-500/50 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
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
          <label className="mb-2 block text-xs font-medium text-slate-300">
            Training frequency (per week)
          </label>
          <div className="flex gap-2">
            {FREQUENCY_OPTIONS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => updateForm({ training_frequency: f })}
                className={`flex-1 rounded-lg py-3 text-sm font-medium ${
                  form.training_frequency === f
                    ? 'bg-teal-600/80 text-white'
                    : 'bg-slate-600/50 text-slate-200 ring-1 ring-slate-500/50 hover:bg-slate-600'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

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

        <div className="mb-8">
          <SecondarySection form={form} onChange={updateForm} />
        </div>

        {showDisclaimer && (
          <div className="mb-8 rounded-lg border border-slate-500/50 bg-slate-600/50 p-5 text-sm">
            <p className="font-medium text-white">Before we generate your report</p>
            <p className="mt-2 font-light text-slate-200">
              This report is for informational use only and is not medical advice. If you have injuries or health
              concerns, consult a professional.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleGenerate}
                className="rounded-lg bg-teal-600/80 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600"
              >
                Generate report
              </button>
              <button
                type="button"
                onClick={() => setShowDisclaimer(false)}
                className="rounded-lg border border-slate-500/50 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600/50"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {result && (
          <div className="mb-8">
            <ResultCard
              form={form}
              result={result}
              coachMode={!!form.coach_mode}
              onSaveScenario={handleSaveScenario}
            />
            {result.oneRMs.length < 2 && (
              <p className="mt-4 text-sm text-slate-300">Add another lift to get ratio diagnostics.</p>
            )}
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-10 border-t border-slate-600 bg-slate-700/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-lg flex-col gap-3">
          {!showDisclaimer && hasEnoughLifts && (
            <button
              type="button"
              onClick={() => (hasEnoughLifts ? setShowDisclaimer(true) : null)}
              className="w-full rounded-lg bg-teal-600/80 px-4 py-3 font-medium text-white hover:bg-teal-600 disabled:opacity-50 disabled:hover:bg-teal-600/80 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:ring-offset-2 focus:ring-offset-slate-700"
            >
              {result ? 'Start over' : 'Generate report'}
            </button>
          )}
          {!hasEnoughLifts && (
            <p className="text-center text-xs text-slate-400">
              Fill in at least one lift above to generate your report.
            </p>
          )}
        </div>
      </footer>
    </div>
  )
}

