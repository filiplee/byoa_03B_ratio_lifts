import { Link } from 'react-router-dom'
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
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[#2a2a2a] bg-[rgba(10,10,10,0.85)] px-6 py-4 backdrop-blur-[12px]">
      <div className="flex items-center gap-6">
        <Link to="/" className="font-display text-xl tracking-[0.08em] text-[#f5f2ec] no-underline">
          <span className="text-[#f5f2ec]">RATIO</span> <span className="text-[#e8c547]">LIFTS</span>
        </Link>
        <Link to="/why" className="text-sm font-medium text-[#a8a8a8] hover:text-[#e8c547] no-underline">
          How It Works
        </Link>
      </div>
      <div className="flex items-center gap-3">
        {coachMode && savedAthletes && savedAthletes.length > 0 && onSelectAthlete && (
          <select
            className="hidden max-w-[220px] rounded-none border border-[#2a2a2a] bg-[#1c1c1c] px-3 py-2 text-sm font-light text-[#f5f2ec] focus:border-[#e8c547] focus:outline-none focus:ring-2 focus:ring-[#e8c547]/30 sm:block"
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
          className={`rounded-none px-3 py-2 text-sm font-medium transition ${
            coachMode ? 'bg-[#e8c547] text-[#0a0a0a]' : 'bg-[#1c1c1c] text-[#a8a8a8] border border-[#2a2a2a] hover:bg-[#2e2e2e]'
          }`}
          aria-pressed={coachMode}
        >
          Coach mode
        </button>

        <div className="flex rounded-none border border-[#2a2a2a] bg-[#1c1c1c] p-0.5">
          <button
            type="button"
            onClick={() => onUnitsChange('kg')}
            className={`px-3 py-1.5 text-sm font-medium transition ${units === 'kg' ? 'bg-[#e8c547] text-[#0a0a0a]' : 'text-[#a8a8a8] hover:bg-[#2e2e2e]'}`}
            aria-pressed={units === 'kg'}
          >
            kg
          </button>
          <button
            type="button"
            onClick={() => onUnitsChange('lb')}
            className={`px-3 py-1.5 text-sm font-medium transition ${units === 'lb' ? 'bg-[#e8c547] text-[#0a0a0a]' : 'text-[#a8a8a8] hover:bg-[#2e2e2e]'}`}
            aria-pressed={units === 'lb'}
          >
            lb
          </button>
        </div>
      </div>
    </header>
  )
}
