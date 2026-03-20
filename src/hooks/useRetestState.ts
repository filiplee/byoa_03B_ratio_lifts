import { useEffect, useState } from 'react'
import type { StrengthBand } from '../types'

export const RETEST_STORAGE_KEY = 'mls_retest'
export const RETEST_UPDATE_EVENT = 'mls_retest:updated'

export interface RetestRecord {
  email?: string
  capturedAt?: number // Unix timestamp ms
  targetRetestAt?: number // capturedAt + 56 days

  // Current-capture values (stored for the initial captured state).
  heroScore?: number
  weakLift?: string
  band?: string

  // Baseline (previous) score for the retest comparison block.
  previousScore?: number
  previousRawPercentile?: number
  previousBand?: string
  previousWeakLift?: string | null
  previousLiftPercentiles?: Record<string, number>

  dismissed?: boolean

  // When set, retest banner should no longer show (one-time retention loop).
  bannerConsumedAt?: number

  // When set, score comparison should no longer show (one-time comparison block).
  scoreComparisonConsumedAt?: number
}

export type RetestState =
  | { status: 'none' }
  | {
      status: 'captured'
      email: string
      capturedAt: number
      heroScore: number
      weakLift: string
      band: string
    }
  | { status: 'dismissed' }
  | {
      status: 'ready'
      daysSince: number
      previousScore: number
      previousWeakLift: string
    }

const MS_PER_DAY = 24 * 60 * 60 * 1000
const RETEST_DAYS_READY = 50 // Spec: ready after 50+ days.
const RETEST_DAYS_TARGET = 56 // Spec: target is 8 weeks (56 days).

function safeParseJson(s: string | null): unknown {
  if (!s) return null
  try {
    return JSON.parse(s) as unknown
  } catch {
    return null
  }
}

export function readRetestRecord(): RetestRecord | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(RETEST_STORAGE_KEY)
    const parsed = safeParseJson(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as RetestRecord
  } catch {
    return null
  }
}

export function writeRetestRecord(next: RetestRecord | { dismissed: true }): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(RETEST_STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  emitRetestUpdate()
}

export function updateRetestRecord(patch: Partial<RetestRecord> | ((prev: RetestRecord | null) => RetestRecord | null)): void {
  const prev = readRetestRecord()
  const next = typeof patch === 'function' ? patch(prev) : ({ ...(prev ?? {}), ...patch } as RetestRecord)
  if (!next) return
  writeRetestRecord(next)
}

export function emitRetestUpdate(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(RETEST_UPDATE_EVENT))
}

export function getBandFromHeroScore(score: number): StrengthBand {
  if (score <= 20) return 'Getting Started'
  if (score <= 40) return 'Developing'
  if (score <= 60) return 'Intermediate'
  if (score <= 75) return 'Solid'
  if (score <= 90) return 'Advanced'
  return 'Elite'
}

export function computeDaysSince(capturedAt?: number): number | null {
  if (capturedAt == null || !Number.isFinite(capturedAt)) return null
  return Math.floor((Date.now() - capturedAt) / MS_PER_DAY)
}

export function computeTargetRetestAt(capturedAt: number): number {
  return capturedAt + RETEST_DAYS_TARGET * MS_PER_DAY
}

export function useRetestState(): RetestState {
  const [retestState, setRetestState] = useState<RetestState>(() => {
    const record = readRetestRecord()
    if (!record) return { status: 'none' } as RetestState
    if (record.dismissed) return { status: 'dismissed' } as RetestState

    const daysSince = computeDaysSince(record.capturedAt)
    if (daysSince == null) return { status: 'none' } as RetestState
    if (daysSince < RETEST_DAYS_READY) {
      const email = typeof record.email === 'string' ? record.email : null
      const capturedAt = typeof record.capturedAt === 'number' ? record.capturedAt : null
      const heroScore =
        typeof record.heroScore === 'number'
          ? record.heroScore
          : typeof record.previousScore === 'number'
            ? record.previousScore
            : null
      const weakLift =
        typeof record.weakLift === 'string'
          ? record.weakLift
          : typeof record.previousWeakLift === 'string'
            ? record.previousWeakLift
            : null
      const band =
        typeof record.band === 'string'
          ? record.band
          : typeof record.previousBand === 'string'
            ? record.previousBand
            : null

      if (email == null || capturedAt == null || heroScore == null || weakLift == null || band == null) {
        return { status: 'none' } as RetestState
      }

      return { status: 'captured', email, capturedAt, heroScore, weakLift, band }
    }

    // One-time banner: once a user has generated the retest report, we stop prompting.
    if (record.bannerConsumedAt) return { status: 'none' } as RetestState

    const previousScore = typeof record.previousScore === 'number' ? record.previousScore : null
    const previousWeakLift = typeof record.previousWeakLift === 'string' ? record.previousWeakLift : null
    if (previousScore == null || previousWeakLift == null || previousWeakLift.trim().length === 0) {
      return { status: 'none' } as RetestState
    }

    return {
      status: 'ready',
      daysSince,
      previousScore,
      previousWeakLift,
    }
  })

  useEffect(() => {
    const onUpdate = () => {
      const record = readRetestRecord()
      if (!record) return setRetestState({ status: 'none' })
      if (record.dismissed) return setRetestState({ status: 'dismissed' })

      const daysSince = computeDaysSince(record.capturedAt)
      if (daysSince == null) return setRetestState({ status: 'none' })
      if (daysSince < RETEST_DAYS_READY) {
        const email = typeof record.email === 'string' ? record.email : null
        const capturedAt = typeof record.capturedAt === 'number' ? record.capturedAt : null
        const heroScore =
          typeof record.heroScore === 'number'
            ? record.heroScore
            : typeof record.previousScore === 'number'
              ? record.previousScore
              : null
        const weakLift =
          typeof record.weakLift === 'string'
            ? record.weakLift
            : typeof record.previousWeakLift === 'string'
              ? record.previousWeakLift
              : null
        const band =
          typeof record.band === 'string'
            ? record.band
            : typeof record.previousBand === 'string'
              ? record.previousBand
              : null

        if (email == null || capturedAt == null || heroScore == null || weakLift == null || band == null) {
          return setRetestState({ status: 'none' })
        }

        return setRetestState({ status: 'captured', email, capturedAt, heroScore, weakLift, band })
      }
      if (record.bannerConsumedAt) return setRetestState({ status: 'none' })

      const previousScore = typeof record.previousScore === 'number' ? record.previousScore : null
      const previousWeakLift = typeof record.previousWeakLift === 'string' ? record.previousWeakLift : null
      if (previousScore == null || previousWeakLift == null || previousWeakLift.trim().length === 0) return setRetestState({ status: 'none' })

      setRetestState({
        status: 'ready',
        daysSince,
        previousScore,
        previousWeakLift,
      })
    }

    window.addEventListener(RETEST_UPDATE_EVENT, onUpdate)
    return () => window.removeEventListener(RETEST_UPDATE_EVENT, onUpdate)
  }, [])

  return retestState
}

