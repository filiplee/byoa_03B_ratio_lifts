import type { Units } from '../types'

interface HeaderProps {
  units: Units
  onUnitsChange: (u: Units) => void
}

export function Header({ units, onUnitsChange }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-600 bg-slate-700/95 px-6 py-4 backdrop-blur">
      <h1 className="text-lg font-medium text-white">Ratio Lifts</h1>
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
    </header>
  )
}
