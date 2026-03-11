import { useState } from 'react'
import type { FormState, PrimaryGoal } from '../types'

const GOALS: PrimaryGoal[] = ['Strength', 'Hypertrophy', 'Power', 'Rehab']
const EQUIPMENT_OPTIONS = ['Barbell', 'Dumbbells', 'Kettlebell', 'Bands', 'Cable', 'Bodyweight']

interface SecondarySectionProps {
  form: FormState
  onChange: (patch: Partial<FormState>) => void
}

export function SecondarySection({ form, onChange }: SecondarySectionProps) {
  const [open, setOpen] = useState(false)

  const toggleEquipment = (item: string) => {
    const next = form.equipment.includes(item)
      ? form.equipment.filter((e) => e !== item)
      : [...form.equipment, item]
    onChange({ equipment: next })
  }

  return (
    <div className="rounded-xl border border-slate-500/50 bg-slate-600/50">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-medium text-white"
      >
        <span>Primary goal, injury & equipment</span>
        <span className="text-slate-400">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="border-t border-slate-500/50 px-5 pb-5 pt-3">
          <div className="mb-5">
            <label className="mb-2 block text-xs font-medium text-slate-300">Primary goal</label>
            <div className="flex flex-wrap gap-2">
              {GOALS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => onChange({ primary_goal: g })}
                  className={`rounded-lg px-3 py-2 text-sm font-medium ${form.primary_goal === g ? 'bg-teal-600/80 text-white' : 'bg-slate-500/50 text-slate-200 hover:bg-slate-500/70'}`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-5">
            <label className="mb-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.injury}
                onChange={(e) => onChange({ injury: e.target.checked })}
                className="rounded border-slate-500 bg-slate-600 text-teal-500 focus:ring-teal-500/50"
              />
              <span className="text-sm text-slate-200">I have an injury or limitation</span>
            </label>
            {form.injury && (
              <input
                type="text"
                placeholder="Brief description (optional)"
                value={form.injury_notes ?? ''}
                onChange={(e) => onChange({ injury_notes: e.target.value || undefined })}
                className="mt-2 w-full rounded-lg border border-slate-500/50 bg-slate-700/50 px-3 py-2 text-sm font-light text-white placeholder:text-slate-400 focus:border-teal-500/50 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              />
            )}
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-slate-300">Equipment available</label>
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT_OPTIONS.map((e) => (
                <label key={e} className="flex items-center gap-1.5 rounded-lg bg-slate-500/50 px-3 py-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={form.equipment.includes(e)}
                    onChange={() => toggleEquipment(e)}
                    className="rounded border-slate-500 bg-slate-600 text-teal-500 focus:ring-teal-500/50"
                  />
                  {e}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
