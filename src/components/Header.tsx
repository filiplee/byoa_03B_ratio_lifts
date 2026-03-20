import { Link } from 'react-router-dom'
import type { Units } from '../types'

interface HeaderProps {
  units: Units
  onUnitsChange: (u: Units) => void
}

export function Header({
  units,
  onUnitsChange,
}: HeaderProps) {
  return (
    <header className="fixed top-0 z-10 w-full flex items-center justify-between border-b border-[#2a2a2a] bg-[rgba(10,10,10,0.85)] px-6 py-4 backdrop-blur-[12px]">
      <div className="flex items-center gap-6">
        <Link to="/" className="font-display text-[1.6rem] tracking-[0.08em] text-[#f5f2ec] no-underline">
          <span className="text-[#f5f2ec]">MY</span> <span className="text-[#e8c547]">LIFT SUCKS</span>
        </Link>
        <Link
          to="/why"
          className="border-none bg-[#e8c547] px-[1.4rem] py-[0.6rem] text-[0.8rem] font-medium tracking-[0.12em] text-[#0a0a0a] transition-transform transition-colors duration-200 uppercase hover:translate-y-[-1px] no-underline"
        >
          HOW IT WORKS →
        </Link>
      </div>
      <div className="flex items-center gap-3">
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
