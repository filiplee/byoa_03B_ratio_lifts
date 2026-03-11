import { useState, useCallback, useEffect } from 'react'
import { Header } from './components/Header'
import { LiftCard } from './components/LiftCard'
import { SecondarySection } from './components/SecondarySection'
import { ResultCard } from './components/ResultCard'
import type { FormState, LiftInput, Units, DiagnosticResult } from './types'
import { defaultFormState } from './defaults'
import { runDiagnostic } from './calculations'
import { trackEvent } from './analytics'

const EXPERIENCE_OPTIONS: FormState['experience'][] = ['Beginner', 'Intermediate', 'Advanced']
const FREQUENCY_OPTIONS: FormState['training_frequency'][] = ['1-2', '3-4', '5+']

function loadPersistedUnits(): Units {
  try {
    const s = localStorage.getItem('ratio-lifts-units')
    if (s === 'kg' || s === 'lb') return s
  } catch {}
  return 'kg'
}

function persistUnits(units: Units) {
  try {
    localStorage.setItem('ratio-lifts-units', units)
  } catch {}
}

export default function App() {
  const [form, setForm] = useState<FormState>(() => ({
    ...defaultFormState,
    units: loadPersistedUnits(),
  }))
  const [result, setResult] = useState<DiagnosticResult | null>(null)
  const [showDisclaimer, setShowDisclaimer] = useState(false)

  const updateForm = useCallback((patch: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }, [])

  const setUnits = useCallback((units: Units) => {
    updateForm({ units })
    persistUnits(units)
  }, [updateForm])

  const setLift = useCallback(
    (index: number, lift: LiftInput) => {
      setForm((prev) => {
        const next = [...prev.lifts]
        next[index] = lift
        return { ...prev, lifts: next }
      })
    },
    []
  )

  const handleGenerate = useCallback(() => {
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
  }, [form.lifts, form.units, showDisclaimer])

  useEffect(() => {
    trackEvent('form_start')
  }, [])

  const hasEnoughLifts = form.lifts.some(
    (l) =>
      (l.method === 'one_rm' && l.one_rm != null && l.one_rm > 0) ||
      (l.method === 'weight_reps' && l.weight != null && l.weight > 0 && l.reps != null && l.reps >= 1 && l.reps <= 20)
  )
  return (
    <div className="min-h-screen bg-slate-700">
      <Header units={form.units} onUnitsChange={setUnits} />

      <main className={`mx-auto px-6 pb-28 pt-8 ${result ? 'max-w-4xl' : 'max-w-lg'}`}>
        <p className="mb-8 text-center font-light text-slate-200">
          Enter your lifts, get estimated 1RMs and ratio diagnostics with tailored accessory suggestions.
        </p>
        <div className="mb-8 grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="bodyweight" className="mb-1 block text-xs font-medium text-slate-300">
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
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-8">
          <label className="mb-2 block text-xs font-medium text-slate-300">Training frequency (per week)</label>
          <div className="flex gap-2">
            {FREQUENCY_OPTIONS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => updateForm({ training_frequency: f })}
                className={`flex-1 rounded-lg py-3 text-sm font-medium ${form.training_frequency === f ? 'bg-teal-600/80 text-white' : 'bg-slate-600/50 text-slate-200 ring-1 ring-slate-500/50 hover:bg-slate-600'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-8 space-y-5">
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
              This report is for informational use only and is not medical advice. If you have injuries or health concerns, consult a professional.
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
            <ResultCard form={form} result={result} />
            {result.oneRMs.length < 2 && (
              <p className="mt-4 text-sm text-slate-300">
                Add another lift to get ratio diagnostics.
              </p>
            )}
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-10 border-t border-slate-600 bg-slate-700/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-lg flex-col gap-3">
          {!showDisclaimer && (
            <button
              type="button"
              onClick={() => (hasEnoughLifts ? setShowDisclaimer(true) : null)}
              disabled={!hasEnoughLifts}
              className="w-full rounded-lg bg-teal-600/80 px-4 py-3 font-medium text-white hover:bg-teal-600 disabled:opacity-50 disabled:hover:bg-teal-600/80 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:ring-offset-2 focus:ring-offset-slate-700"
            >
              Generate report
            </button>
          )}
          {!hasEnoughLifts && (
            <p className="text-center text-xs text-slate-400">Enter at least one lift to continue.</p>
          )}
          <button
            type="button"
            className="text-sm font-light text-slate-400 underline hover:text-teal-300"
            onClick={() => {}}
          >
            Save scenario (optional)
          </button>
        </div>
      </footer>
    </div>
  )
}
