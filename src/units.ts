import type { Units } from './types'

export const KG_TO_LB = 2.20462

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export function kgToDisplay(kg: number, units: Units): number {
  const raw = units === 'lb' ? kg * KG_TO_LB : kg
  return round1(raw)
}

export function displayToKg(display: number, units: Units): number {
  if (units === 'lb') return display / KG_TO_LB
  return display
}

export function formatKg(kg: number, units: Units): string {
  return kgToDisplay(kg, units).toFixed(1)
}

