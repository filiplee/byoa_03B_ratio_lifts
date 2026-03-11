/**
 * Renders a distribution curve (bell curve) with the lifter's percentile position marked.
 * Uses synthetic normal distribution for visualization when no external dataset exists.
 */

interface PercentileCurveProps {
  liftName: string
  ratioBW: number
  percentile: number
  typicalRatio: number
  className?: string
}

// Generate points for a bell curve (normal distribution) around typical ratio
function bellCurvePoints(
  typical: number,
  stdDev: number,
  width: number,
  height: number,
  bins: number = 30
): string {
  const min = Math.max(0.3, typical - 2.5 * stdDev)
  const max = typical + 2.5 * stdDev
  const step = (max - min) / bins
  const points: { x: number; y: number }[] = []

  for (let i = 0; i <= bins; i++) {
    const x = min + i * step
    const z = (x - typical) / stdDev
    const y = Math.exp(-0.5 * z * z)
    points.push({
      x: (i / bins) * width,
      y: height - (y / 1.2) * (height - 8),
    })
  }

  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ')
  return `${d} L ${width} ${height} L 0 ${height} Z`
}

export function PercentileCurve({
  liftName,
  ratioBW,
  percentile,
  typicalRatio,
  className = '',
}: PercentileCurveProps) {
  const width = 160
  const height = 56
  const stdDev = typicalRatio * 0.35
  const min = Math.max(0.3, typicalRatio - 2.5 * stdDev)
  const max = typicalRatio + 2.5 * stdDev
  const range = max - min || 0.1
  const xPos = Math.max(0, Math.min(1, (ratioBW - min) / range)) * width

  const pathD = bellCurvePoints(typicalRatio, stdDev, width, height)

  // Green = higher percentile, amber = circa 50th, red = lower percentile
  const color =
    percentile >= 60 ? '#5eead4' : percentile >= 40 ? '#fcd34d' : '#f87171'

  const gradId = `grad-${liftName.replace(/\s/g, '-')}`
  return (
    <div className={`${className}`}>
      <p className="mb-0.5 text-xs font-medium text-slate-200">{liftName}</p>
      <svg
        width={width}
        height={height}
        className="overflow-visible"
        aria-hidden
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5eead4" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#5eead4" stopOpacity={0} />
          </linearGradient>
        </defs>
        <path
          d={pathD}
          fill={`url(#${gradId})`}
          stroke="#5eead4"
          strokeWidth={1}
          strokeOpacity={0.5}
        />
        <line
          x1={xPos}
          y1={0}
          x2={xPos}
          y2={height}
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
        />
        <circle cx={xPos} cy={height - 4} r={5} fill={color} stroke="#334155" strokeWidth={1.5} />
      </svg>
      <p className="mt-0.5 text-[10px] text-slate-400">
        {ratioBW.toFixed(2)}× BW · {percentile}th percentile
      </p>
    </div>
  )
}
