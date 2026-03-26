import { jsPDF } from 'jspdf'
import type { FormState, DiagnosticResult } from './types'
import { IDEAL_RATIOS, getIdealRangeForGoal, getHeadlineDiagnosis } from './calculations'
import { formatKg } from './units'

const DISCLAIMER =
  'Informational only — not medical advice. Consult a professional for injuries.'

// Layout constants — grid-based for precise alignment
const MARGIN = 16
const PAGE_W = 210
const PAGE_H = 297
const CONTENT_W = PAGE_W - 2 * MARGIN
const LABEL_W = 46
const BAR_W = 96
const GUTTER = 4

const FONT = { tiny: 7, small: 8, normal: 9, section: 10 }
const LINE_H = 4
const BAR_H = 3.5
const SECTION_GAP = 6
const RADIUS = 2.5
// Padding inside panels so text never touches borders
const PAD = 5
const LINE_HEIGHT_TINY = 3.2
const LINE_HEIGHT_SMALL = 3.5
const LINE_HEIGHT_NORMAL = 4

// Rainy mood palette — slate gray, white text, muted teal accents
const PALETTE = {
  ink: { r: 255, g: 255, b: 255 },
  muted: { r: 203, g: 213, b: 225 },
  barBg: { r: 71, g: 85, b: 105 },
  barFill: { r: 94, g: 234, b: 212 },
  // Typical-range overlay — intentionally NOT grey to avoid ambiguity with barBg.
  barTypical: { r: 165, g: 180, b: 252 }, // indigo-300
  accent: { r: 94, g: 234, b: 212 },
  warn: { r: 252, g: 211, b: 77 },
  idealMarker: { r: 255, g: 255, b: 255 }, // bright white so narrow line is obvious
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary)
}

let fontsReady: Promise<boolean> | null = null
/** Returns true if custom fonts loaded, false if fell back to system font. */
async function ensurePdfFonts(doc: jsPDF): Promise<boolean> {
  if (!fontsReady) {
    fontsReady = (async () => {
      try {
        const [regularRes, semiBoldRes] = await Promise.all([
          fetch('/fonts/extras/ttf/Inter-Regular.ttf'),
          fetch('/fonts/extras/ttf/Inter-SemiBold.ttf'),
        ])
        if (!regularRes.ok) {
          console.warn(
            '[Ratio Lifts] PDF font failed to load: Inter-Regular.ttf',
            regularRes.status,
            regularRes.statusText
          )
          return false
        }
        if (!semiBoldRes.ok) {
          console.warn(
            '[Ratio Lifts] PDF font failed to load: Inter-SemiBold.ttf',
            semiBoldRes.status,
            semiBoldRes.statusText
          )
          return false
        }
        const [regular, semiBold] = await Promise.all([
          regularRes.arrayBuffer(),
          semiBoldRes.arrayBuffer(),
        ])
        doc.addFileToVFS('Inter-Regular.ttf', arrayBufferToBase64(regular))
        doc.addFileToVFS('Inter-SemiBold.ttf', arrayBufferToBase64(semiBold))
        doc.addFont('Inter-Regular.ttf', 'Inter', 'normal')
        doc.addFont('Inter-SemiBold.ttf', 'Inter', 'bold')
        return true
      } catch (err) {
        console.warn(
          '[Ratio Lifts] PDF font fetch failed, using system font:',
          err instanceof Error ? err.message : err
        )
        return false
      }
    })()
  }
  return fontsReady
}

/** Set by ensurePdfFonts; used so PDF can fall back to Helvetica if font fetch fails. */
let pdfFontName: 'Inter' | 'Helvetica' = 'Helvetica'

function setInk(doc: jsPDF) {
  doc.setTextColor(PALETTE.ink.r, PALETTE.ink.g, PALETTE.ink.b)
}
function setMuted(doc: jsPDF) {
  doc.setTextColor(PALETTE.muted.r, PALETTE.muted.g, PALETTE.muted.b)
}

function setAccent(doc: jsPDF) {
  doc.setTextColor(PALETTE.accent.r, PALETTE.accent.g, PALETTE.accent.b)
}

function divider(doc: jsPDF, y: number) {
  doc.setDrawColor(100, 116, 139)
  doc.setLineWidth(0.2)
  doc.line(MARGIN, y, MARGIN + CONTENT_W, y)
}

function paintBackground(doc: jsPDF) {
  // Slate gray background
  doc.setFillColor(51, 65, 85)
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F')
  setInk(doc)
}

function newPage(doc: jsPDF) {
  doc.addPage()
  paintBackground(doc)
}

function ensureSpace(doc: jsPDF, y: number, neededH: number) {
  const bottom = PAGE_H - MARGIN
  if (y + neededH <= bottom) return y
  newPage(doc)
  return MARGIN
}

function sectionHeader(doc: jsPDF, title: string, y: number) {
  doc.setFontSize(FONT.section)
  doc.setFont(pdfFontName, 'bold')
  setInk(doc)
  doc.text(title, MARGIN, y)
  divider(doc, y + 1.5)
}

function actionLine(doc: jsPDF, text: string, y: number): number {
  const x = MARGIN
  doc.setFont(pdfFontName, 'bold')
  doc.setFontSize(FONT.small)
  const labelStr = 'Action: '
  const labelWidth = doc.getTextWidth(labelStr)
  const bodyWidth = CONTENT_W - 2 * PAD - labelWidth
  const lines = doc.splitTextToSize(text, bodyWidth)
  const blockH = lines.length * LINE_HEIGHT_SMALL
  const boxH = Math.max(10, 2 * PAD + blockH)
  y = ensureSpace(doc, y, boxH + 2)

  doc.setDrawColor(PALETTE.accent.r, PALETTE.accent.g, PALETTE.accent.b)
  doc.setLineWidth(0.25)
  doc.roundedRect(x, y, CONTENT_W, boxH, RADIUS, RADIUS, 'S')

  const contentTop = y + (boxH - blockH) / 2
  const opts = { baseline: 'top' as const }

  setAccent(doc)
  doc.text(labelStr, x + PAD, contentTop, opts)

  doc.setFont(pdfFontName, 'normal')
  doc.setFontSize(FONT.small)
  setMuted(doc)
  doc.text(lines[0]!, x + PAD + labelWidth, contentTop, opts)
  if (lines.length > 1) {
    doc.text(lines.slice(1), x + PAD + labelWidth, contentTop + LINE_HEIGHT_SMALL, opts)
  }
  setInk(doc)
  return y + boxH + 4
}

/** Coach-specific PDF header/notes: planned for a later phase (see ResultCard callout). */
export function generateReportPDF(
  form: FormState,
  result: DiagnosticResult,
  options?: { initials?: string }
): void {
  ;(async () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const customFontsLoaded = await ensurePdfFonts(doc)
    pdfFontName = customFontsLoaded ? 'Inter' : 'Helvetica'
    if (!customFontsLoaded) {
      alert(
        'PDF export could not load custom fonts. The report was generated using the system font. You can try again or save as is.'
      )
    }
  let y = MARGIN

  paintBackground(doc)

  // ─── Header ─────────────────────────────────────────────────────────────
  doc.setFontSize(FONT.section + 2)
  doc.setFont(pdfFontName, 'bold')
  doc.text('Ratio Lifts', MARGIN, y)
  y += LINE_H

  doc.setFontSize(FONT.tiny)
  setMuted(doc)
  doc.setFont(pdfFontName, 'normal')
  doc.text(
    `${new Date().toLocaleDateString()}${options?.initials ? ` · ${options.initials}` : ''}  ·  ${form.units}  ·  Strength: ${form.experience ?? '—'}  ·  ${result.confidence} confidence`,
    MARGIN,
    y
  )
  y += LINE_H + 3

  // ─── Hero score panel ──────────────────────────────────────────────────
  const heroX = MARGIN
  const heroW = CONTENT_W
  const heroY = y

  const ordinalSuffix = (n: number) => {
    const abs = Math.abs(Math.round(n))
    const mod100 = abs % 100
    if (mod100 >= 11 && mod100 <= 13) return 'th'
    const mod10 = abs % 10
    if (mod10 === 1) return 'st'
    if (mod10 === 2) return 'nd'
    if (mod10 === 3) return 'rd'
    return 'th'
  }

  const hero = result.heroScore
  const expUpper = form.experience != null ? `${form.experience.toUpperCase()} STANDARDS` : 'YOUR STANDARDS'
  const heroTitle = `${hero.displayedScore}${ordinalSuffix(hero.displayedScore)} percentile (${expUpper})`
  const weakLiftWord = (() => {
    const w = hero.weakestLift
    if (!w) return 'your weak link'
    if (w === 'Bench Press') return 'bench'
    if (w === 'Squat') return 'squat'
    if (w === 'Deadlift') return 'deadlift'
    if (w === 'Overhead Press') return 'OHP'
    return w.toLowerCase()
  })()

  const heroLines: string[] = []
  heroLines.push(`Band: ${hero.band} — balance-adjusted cohort placement.`)
  if (result.secondaryPercentile != null) {
    heroLines.push(
      `Projected vs next standard: ${result.secondaryPercentile.percentile}${ordinalSuffix(result.secondaryPercentile.percentile)} percentile (${result.secondaryPercentile.standardsLabel}).`
    )
  }
  if (form.gender === 'prefer_not_to_say') {
    heroLines.push('Note: Tables use male reference until Male or Female is selected in the app.')
  }
  if (hero.penaltyPoints > 0 && hero.weakestLift) {
    const climb = Math.min(100, hero.displayedScore + hero.penaltyPoints)
    heroLines.push(
      `Gap across lifts costing ~${hero.penaltyPoints} balance points (${weakLiftWord}). Fix it and climb toward ${climb}${ordinalSuffix(climb)} percentile.`
    )
  }
  if (result.oneLineDiagnosis) {
    heroLines.push(result.oneLineDiagnosis)
  }

  const lps = result.liftPercentiles ?? []
  for (const lp of lps) {
    const liftLabel = lp.id === 'press' ? 'OHP (Kilgore anchor)' : lp.name
    heroLines.push(`${liftLabel}: ${lp.ratioBW.toFixed(2)}× BW · ${lp.percentile}${ordinalSuffix(lp.percentile)} pct · ${lp.band}`)
  }

  const heroTextW = heroW - 2 * PAD
  const wrappedHeroTitle = doc.splitTextToSize(heroTitle, heroTextW)
  const titleBlockH = wrappedHeroTitle.length * LINE_HEIGHT_SMALL + 1 + LINE_HEIGHT_SMALL + 1
  let bodyH = 0
  for (const line of heroLines) {
    const wrapped = doc.splitTextToSize(line, heroTextW)
    bodyH += wrapped.length * LINE_HEIGHT_TINY + 0.8
  }
  const heroH = Math.max(72, PAD * 2 + titleBlockH + bodyH + 6)

  const heroFillY = heroY
  doc.setFillColor(71, 85, 105) // slate-600
  doc.roundedRect(heroX, heroFillY, heroW, heroH, RADIUS, RADIUS, 'F')
  doc.setDrawColor(PALETTE.accent.r, PALETTE.accent.g, PALETTE.accent.b)
  doc.setLineWidth(0.25)
  doc.roundedRect(heroX, heroFillY, heroW, heroH, RADIUS, RADIUS, 'S')

  let ty = heroY + PAD + 1
  doc.setFont(pdfFontName, 'bold')
  doc.setFontSize(FONT.small + 1)
  setInk(doc)
  doc.text(wrappedHeroTitle, heroX + PAD, ty, { baseline: 'top' })
  ty += wrappedHeroTitle.length * LINE_HEIGHT_SMALL + 1

  doc.setFont(pdfFontName, 'bold')
  doc.setFontSize(FONT.small)
  setAccent(doc)
  doc.text(hero.band, heroX + PAD, ty, { baseline: 'top' })
  ty += LINE_HEIGHT_SMALL + 1

  doc.setFont(pdfFontName, 'normal')
  doc.setFontSize(FONT.tiny)
  setMuted(doc)

  for (const line of heroLines) {
    const wrapped = doc.splitTextToSize(line, heroTextW)
    doc.text(wrapped, heroX + PAD, ty, { baseline: 'top' })
    ty += wrapped.length * LINE_HEIGHT_TINY + 0.8
  }

  y = heroY + heroH + 4

  // ─── Header insight box (Key takeaway) — matches Action panel typography ─
  const insightX = MARGIN
  const insightW = CONTENT_W
  const insightY = y
  const diagWrapW = insightW - 2 * PAD
  doc.setFont(pdfFontName, 'normal')
  doc.setFontSize(FONT.small)
  const headline = getHeadlineDiagnosis(result.oneRMs, result.flags, form.units)
  const diag = doc.splitTextToSize(headline, diagWrapW)
  const titleH = LINE_HEIGHT_SMALL   // same scale as Action label
  const insightBodyH = Math.max(1, diag.length) * LINE_HEIGHT_SMALL
  const insightContentH = titleH + 1.5 + insightBodyH
  const insightH = Math.max(20, 2 * PAD + insightContentH)
  doc.setFillColor(71, 85, 105) // slate-600
  doc.roundedRect(insightX, insightY, insightW, insightH, RADIUS, RADIUS, 'F')
  doc.setDrawColor(PALETTE.accent.r, PALETTE.accent.g, PALETTE.accent.b)
  doc.setLineWidth(0.25)
  doc.roundedRect(insightX, insightY, insightW, insightH, RADIUS, RADIUS, 'S')

  const insightContentTop = insightY + (insightH - insightContentH) / 2
  const opts = { baseline: 'top' as const }

  doc.setFont(pdfFontName, 'bold')
  doc.setFontSize(FONT.small)
  setInk(doc)
  doc.text('Key takeaway', insightX + PAD, insightContentTop, opts)

  doc.setFont(pdfFontName, 'normal')
  doc.setFontSize(FONT.small)
  doc.text(diag, insightX + PAD, insightContentTop + titleH + 1.5, opts)

  const focus = result.accessories?.[0]?.forImbalance
  const hasAccessories = (result.accessories?.length ?? 0) > 0
  const mainAction = !hasAccessories
    ? 'No ratio gap to target — keep balanced training and retest in 6 weeks.'
    : focus != null
      ? `Prioritise ${focus.toLowerCase()} for 6 weeks.`
      : 'Prioritise the accessory work below for 6 weeks.'
  y = insightY + insightH + 6
  y = actionLine(doc, mainAction, y)
  y += SECTION_GAP - 2

  // ─── Methodology (compact) ──────────────────────────────────────────────
  y = ensureSpace(doc, y, 22)
  doc.setFont(pdfFontName, 'normal')
  doc.setFontSize(FONT.tiny)
  setMuted(doc)
  const methodLines = doc.splitTextToSize(
    'Strength standards: van den Hoek et al. (2024) IPF drug-tested ratios (squat, bench, deadlift); overhead press uses Kilgore (2023) coaching anchors (not scaled by experience). Beginner/Intermediate scale SBD Advanced anchors by 0.60/0.80. https://doi.org/10.1016/j.jsams.2024.07.005',
    CONTENT_W
  )
  doc.text(methodLines, MARGIN, y)
  y += methodLines.length * LINE_HEIGHT_TINY + SECTION_GAP

  // ─── 1RM snapshot (simple grid) ─────────────────────────────────────────
  y = ensureSpace(doc, y, 50)
  sectionHeader(doc, '1RM snapshot', y)
  y += LINE_H + 2

  // Compact context line (kept minimal, coaching-first)
  doc.setFont(pdfFontName, 'normal')
  doc.setFontSize(FONT.tiny)
  setMuted(doc)
  const metaParts = [
    `Strength level: ${form.experience ?? '—'}`,
    `Goal: ${form.primary_goal}`,
    form.bodyweight != null ? `BW: ${formatKg(form.bodyweight, form.units)} ${form.units}` : null,
    // Training frequency is no longer user-selectable in the form; PDF keeps the old default.
    'Frequency: 3-4/wk',
  ].filter(Boolean) as string[]
  doc.text(metaParts.join('  ·  '), MARGIN, y)
  y += LINE_H + 2

  const gridCols = 2
  const cellW = (CONTENT_W - GUTTER) / gridCols
  const cellH = 18
  const cellPad = 4
  const oneRMs = [...result.oneRMs]
  const cells = Math.max(2, Math.min(4, oneRMs.length || 0))
  const rows = Math.ceil(cells / gridCols)
  const cellTextW = cellW - 2 * cellPad
  const baseTop = { baseline: 'top' as const }

  for (let i = 0; i < cells; i++) {
    const row = Math.floor(i / gridCols)
    const col = i % gridCols
    const x = MARGIN + col * (cellW + GUTTER)
    const yy = y + row * (cellH + GUTTER)

    doc.setFillColor(PALETTE.barBg.r, PALETTE.barBg.g, PALETTE.barBg.b)
    doc.roundedRect(x, yy, cellW, cellH, RADIUS, RADIUS, 'F')

    doc.setDrawColor(100, 116, 139)
    doc.setLineWidth(0.2)
    doc.roundedRect(x, yy, cellW, cellH, RADIUS, RADIUS, 'S')

    const lift = oneRMs[i]
    if (!lift) {
      doc.setFont(pdfFontName, 'normal')
      doc.setFontSize(FONT.tiny)
      setMuted(doc)
      const placeholderLines = doc.splitTextToSize('Add another lift to fill this slot', cellTextW)
      const phH = placeholderLines.length * LINE_HEIGHT_TINY
      const contentTop = yy + (cellH - phH) / 2
      doc.text(placeholderLines, x + cellPad, contentTop, baseTop)
      continue
    }

    const labelLines = doc.splitTextToSize(lift.name, cellTextW)
    const labelH = labelLines.length * LINE_HEIGHT_TINY
    const valueH = LINE_HEIGHT_NORMAL
    const suffixH = LINE_HEIGHT_SMALL
    const blockH = labelH + 1 + valueH + 0.5 + suffixH
    const contentTop = yy + (cellH - blockH) / 2

    doc.setFont(pdfFontName, 'normal')
    doc.setFontSize(FONT.tiny)
    setMuted(doc)
    doc.text(labelLines, x + cellPad, contentTop, baseTop)

    doc.setFont(pdfFontName, 'bold')
    doc.setFontSize(FONT.section + 2)
    setAccent(doc)
    const valueStr = formatKg(lift.oneRM, form.units)
    doc.text(valueStr, x + cellPad, contentTop + labelH + 1, baseTop)

    doc.setFont(pdfFontName, 'normal')
    doc.setFontSize(FONT.small)
    setMuted(doc)
    const suffix = lift.method === 'user_provided' ? 'provided' : 'estimated'
    const suffixStr = `${form.units} · ${suffix}`
    doc.text(suffixStr, x + cellPad, contentTop + labelH + 1 + valueH + 0.5, baseTop)
  }

  y += rows * (cellH + GUTTER) - GUTTER
  y += 5
  y = actionLine(doc, 'Use these as baselines. Retest every 6 weeks.', y)
  y += SECTION_GAP - 2

  // ─── Ratios with bar + typical range + action ───────────────────────────
  const CROSS_BODY_IDS = ['squat_to_bench', 'deadlift_to_bench', 'squat_to_press', 'deadlift_to_press']
  if (result.ratios.length > 0) {
    y = ensureSpace(doc, y, 55)
    sectionHeader(doc, 'Ratios (balance)', y)
    y += LINE_H + 2

    // Minimal key (functional, not decorative)
    // Color key: teal (you), indigo (typical band), grey (scale/background)
    doc.setFont(pdfFontName, 'normal')
    doc.setFontSize(FONT.tiny)
    setMuted(doc)
    const sw = 3.5
    const sh = 2.2
    const gap = 2
    let lx = MARGIN
    const ly = y - 2.1
    doc.setFillColor(PALETTE.barFill.r, PALETTE.barFill.g, PALETTE.barFill.b)
    doc.rect(lx, ly, sw, sh, 'F')
    doc.text('You', lx + sw + 1.2, y)
    lx += sw + 1.2 + doc.getTextWidth('You') + gap
    doc.setFillColor(PALETTE.barTypical.r, PALETTE.barTypical.g, PALETTE.barTypical.b)
    doc.rect(lx, ly, sw, sh, 'F')
    doc.text('Typical range', lx + sw + 1.2, y)
    lx += sw + 1.2 + doc.getTextWidth('Typical range') + gap
    // Ideal marker (bright so the narrow line is obvious)
    doc.setDrawColor(PALETTE.idealMarker.r, PALETTE.idealMarker.g, PALETTE.idealMarker.b)
    doc.setLineWidth(0.5)
    doc.line(lx, ly, lx, ly + sh)
    doc.text('Ideal', lx + 1.2, y)
    y += LINE_H + 2

    let crossBodyShown = false
    const barX = MARGIN + LABEL_W + GUTTER
    const valueX = barX + BAR_W + GUTTER
    for (const r of result.ratios) {
      y = ensureSpace(doc, y, 14)
      if (CROSS_BODY_IDS.includes(r.id) && !crossBodyShown) {
        crossBodyShown = true
        doc.setFontSize(FONT.tiny)
        setMuted(doc)
        doc.setFont(pdfFontName, 'normal')
        doc.text('Lower : Upper (squat/deadlift vs bench/press)', MARGIN, y)
        y += LINE_H
      }
      const ideal = IDEAL_RATIOS[r.id]
      const idealForGoal = getIdealRangeForGoal(r.id, form.primary_goal)
      const flag = result.flags.find((f) => f.label === r.label)
      const value = r.value as number

      doc.setFontSize(FONT.small)
      doc.setFont(pdfFontName, 'normal')
      setInk(doc)
      doc.text(r.label, MARGIN, y)
      setMuted(doc)
      doc.text(String(value), valueX, y)

      // Bar with typical range overlay (parse range e.g. "1.0–1.5" for cross-body ratios)
      const scaleMax = ideal ? Math.max(value, ideal.ideal * 1.4, 1.2) : 1.2
      const frac = Math.min(1, value / scaleMax)

      doc.setFillColor(PALETTE.barBg.r, PALETTE.barBg.g, PALETTE.barBg.b)
      doc.rect(barX, y - 2.5, BAR_W, BAR_H, 'F')
      if (ideal) {
        doc.setFillColor(PALETTE.barTypical.r, PALETTE.barTypical.g, PALETTE.barTypical.b)
        const rangeStr = idealForGoal?.rangeLabel ?? ideal.range
        const rangeMatch = rangeStr.match(/^([\d.]+)[–-]([\d.]+)$/)
        const bandLo = rangeMatch ? parseFloat(rangeMatch[1]) : ideal.ideal - 0.1
        const bandHi = rangeMatch ? parseFloat(rangeMatch[2]) : ideal.ideal + 0.1
        const lo = Math.max(0, bandLo / scaleMax)
        const hi = Math.min(1, bandHi / scaleMax)
        doc.rect(barX + BAR_W * lo, y - 2.5, BAR_W * (hi - lo), BAR_H, 'F')
      }
      doc.setFillColor(PALETTE.barFill.r, PALETTE.barFill.g, PALETTE.barFill.b)
      doc.rect(barX, y - 2.5, BAR_W * frac, BAR_H, 'F')

      // Ideal marker line (bright white so it reads clearly on the bar)
      if (ideal) {
        const idealFrac = Math.min(1, Math.max(0, ideal.ideal / scaleMax))
        doc.setDrawColor(PALETTE.idealMarker.r, PALETTE.idealMarker.g, PALETTE.idealMarker.b)
        doc.setLineWidth(0.5)
        const mx = barX + BAR_W * idealFrac
        doc.line(mx, y - 2.7, mx, y - 2.7 + BAR_H + 0.4)
      }

      y += LINE_H + 1

      // One-line coaching cue if flagged
      if (flag && !flag.id.startsWith('typical_')) {
        doc.setFontSize(FONT.tiny)
        setMuted(doc)
        const actionLines = doc.splitTextToSize(flag.message, CONTENT_W - 2 * PAD)
        doc.text(actionLines, MARGIN + PAD, y)
        y += actionLines.length * LINE_HEIGHT_TINY
      }
      y += 1
    }
    y = actionLine(doc, 'Use these bars to spot what to bring up next. Keep the focus for 6 weeks, then retest.', y + 1)
    y += SECTION_GAP - 2
  }

  // ─── Accessory cards (top 3) — only when ratio diagnostics prescribe work ─
  const topAccessories = (result.accessories || []).slice(0, 3)
  if (topAccessories.length > 0) {
    y = ensureSpace(doc, y, 35)
    sectionHeader(doc, `Accessory focus (top ${topAccessories.length})`, y)
    y += LINE_H + 2

    const cardH = 21
    const cardGap = 3
    const cardW = CONTENT_W
    const cardPad = PAD
    const cardTextW = cardW - 2 * cardPad
    const cardOpts = { baseline: 'top' as const }

    for (const a of topAccessories) {
      y = ensureSpace(doc, y, cardH + cardGap + 2)
      doc.setFillColor(51, 65, 85) // slate-700
      doc.roundedRect(MARGIN, y, cardW, cardH, RADIUS, RADIUS, 'F')
      doc.setDrawColor(100, 116, 139)
      doc.setLineWidth(0.2)
      doc.roundedRect(MARGIN, y, cardW, cardH, RADIUS, RADIUS, 'S')

      const hasImbalance = a.forImbalance != null && String(a.forImbalance).trim().length > 0
      const cue = a.cue ?? 'Keep reps clean; stop 1–2 reps before failure.'
      const cueLines = doc.splitTextToSize(cue, cardTextW)
      const cueH = cueLines.length * LINE_HEIGHT_TINY

      let contentH = LINE_HEIGHT_NORMAL + 1
      if (hasImbalance) contentH += LINE_HEIGHT_TINY + 0.5
      contentH += LINE_HEIGHT_SMALL + 1 + cueH
      const contentTop = y + (cardH - contentH) / 2
      let rowY = contentTop

      doc.setFont(pdfFontName, 'bold')
      doc.setFontSize(FONT.normal)
      setInk(doc)
      const nameLines = doc.splitTextToSize(a.name, cardTextW)
      doc.text(nameLines, MARGIN + cardPad, rowY, cardOpts)
      rowY += nameLines.length * LINE_HEIGHT_NORMAL + 1

      if (hasImbalance) {
        doc.setFont(pdfFontName, 'normal')
        doc.setFontSize(FONT.tiny)
        setAccent(doc)
        doc.text(`Addresses: ${a.forImbalance}`, MARGIN + cardPad, rowY, cardOpts)
        rowY += LINE_HEIGHT_TINY + 0.5
      }

      doc.setFont(pdfFontName, 'normal')
      doc.setFontSize(FONT.small)
      setMuted(doc)
      const weightStr = a.suggestedWeight != null ? ` · ${formatKg(a.suggestedWeight, form.units)} ${form.units}` : ''
      const rx = `${a.setsReps || ''}${weightStr}`.trim() || '—'
      doc.text(rx, MARGIN + cardPad, rowY, cardOpts)
      rowY += LINE_HEIGHT_SMALL + 1

      doc.setFontSize(FONT.tiny)
      doc.text(cueLines, MARGIN + cardPad, rowY, cardOpts)

      y += cardH + cardGap
    }

    y = actionLine(
      doc,
      'Run these for 6 weeks. Increase load when you hit the top end with good form.',
      y + 2
    )
    y += SECTION_GAP - 2
  }

  // ─── Footer ──────────────────────────────────────────────────────────────
  y = ensureSpace(doc, y, 18)
  doc.setFontSize(FONT.tiny)
  setMuted(doc)
  const footer = `Reminder: Retest every 6 weeks.`
  doc.setFont(pdfFontName, 'bold')
  setAccent(doc)
  doc.text(footer, MARGIN + PAD, y)
  y += LINE_H

  doc.setFont(pdfFontName, 'normal')
  setMuted(doc)
  const disclaimerLines = doc.splitTextToSize(DISCLAIMER, CONTENT_W - 2 * PAD)
  doc.text(disclaimerLines, MARGIN + PAD, y)
  y += disclaimerLines.length * LINE_H + 1
  if (result.oneRMs.some((r) => r.method === 'epley')) {
    doc.text('1RM: Epley formula — weight × (1 + reps/30)', MARGIN + PAD, y)
  }
  setInk(doc)

  doc.save('ratio-lifts-report.pdf')
  })()
}
