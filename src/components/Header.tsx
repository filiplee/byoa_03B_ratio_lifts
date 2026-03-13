import type { Units } from '../types'

interface HeaderProps {
  units: Units
  onUnitsChange: (u: Units) => void
  coachMode: boolean
  onCoachModeChange: (next: boolean) => void
  savedAthletes?: { id: string; label: string }[]
  onSelectAthlete?: (id: string) => void
}

export function Header({
  units,
  onUnitsChange,
  coachMode,
  onCoachModeChange,
  savedAthletes,
  onSelectAthlete,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-600 bg-slate-700/95 px-6 py-4 backdrop-blur">
      <h1 className="text-lg font-medium text-white">Ratio Lifts</h1>
      <div className="flex items-center gap-3">
        {coachMode && savedAthletes && savedAthletes.length > 0 && onSelectAthlete && (
          <select
            className="hidden max-w-[220px] rounded-lg border border-slate-500/50 bg-slate-600/50 px-3 py-2 text-sm font-light text-white focus:border-teal-500/50 focus:outline-none focus:ring-2 focus:ring-teal-500/30 sm:block"
            defaultValue=""
            onChange={(e) => (e.target.value ? onSelectAthlete(e.target.value) : null)}
          >
            <option value="" disabled>
              Load athlete…
            </option>
            {savedAthletes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        )}

        <button
          type="button"
          onClick={() => onCoachModeChange(!coachMode)}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
            coachMode ? 'bg-teal-600/80 text-white' : 'bg-slate-600/50 text-slate-200 ring-1 ring-slate-500/50 hover:bg-slate-600'
          }`}
          aria-pressed={coachMode}
        >
          Coach mode
        </button>

        <div className="flex rounded-lg border border-slate-500/50 bg-slate-600/50 p-0.5">
          <button
            type="button"
            onClick={() => onUnitsChange('kg')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${units === 'kg' ? 'bg-teal-600/80 text-white' : 'text-slate-300 hover:bg-slate-600'}`}
            aria-pressed={units === 'kg'}
          >
            kg
          </button>
          <button
            type="button"
            onClick={() => onUnitsChange('lb')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${units === 'lb' ? 'bg-teal-600/80 text-white' : 'text-slate-300 hover:bg-slate-600'}`}
            aria-pressed={units === 'lb'}
          >
            lb
          </button>
        </div>
      </div>
    </header>
  )
}
