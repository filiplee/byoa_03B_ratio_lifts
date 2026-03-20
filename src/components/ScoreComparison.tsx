// Comparison block shown for retests; no persistent write needed for UI correctness.

interface ScoreComparisonProps {
  previousScore: number
  previousBand: string
  previousWeakLift: string
  currentScore: number
  currentBand: string
  currentWeakLift: string
}

export function ScoreComparison({
  previousScore,
  previousBand,
  previousWeakLift,
  currentScore,
  currentBand,
  currentWeakLift,
}: ScoreComparisonProps) {
  const delta = currentScore - previousScore
  const absDelta = Math.abs(delta)
  const isImprovement = delta > 0
  const isResolvedWeakLink = currentWeakLift !== previousWeakLift

  const deltaColor = delta > 0 ? 'text-[#6fce8c]' : delta < 0 ? 'text-[#e07a5f]' : 'text-[#a8a8a8]'
  const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→'
  const deltaText =
    delta > 0
      ? `+${absDelta} points ${arrow}`
      : delta < 0
        ? `-${absDelta} points ${arrow}`
        : `0 points ${arrow}`

  const message = (() => {
    if (isImprovement) {
      if (isResolvedWeakLink) {
        return `${previousWeakLift} is no longer your weak link. Nice work.`
      }
      return `You moved up ${delta} points. ${currentWeakLift} is still your weak link — keep pushing.`
    }
    return `Your score hasn't moved yet. These things take time — make sure you're hitting ${previousWeakLift} consistently.`
  })()

  return (
    <section className="mb-6 rounded-none border border-[#2a2a2a] bg-[#111111] p-4">
      <p className="text-sm font-medium text-[#f5f2ec]">
        Last time: {previousScore}th percentile — {previousBand}
      </p>
      <p className="mt-1 text-sm font-medium text-[#f5f2ec]">
        Now: {currentScore}th percentile — {currentBand}
      </p>
      <p className={`mt-2 text-sm font-semibold ${deltaColor}`}>
        Change: {deltaText}
      </p>
      <p className="mt-2 text-sm text-[#a8a8a8]">{message}</p>
    </section>
  )
}

