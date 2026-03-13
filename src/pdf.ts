import { jsPDF } from 'jspdf'
import type { FormState, DiagnosticResult } from './types'
import { IDEAL_RATIOS, getIdealRangeForGoal, getRadarChartData, getHeadlineDiagnosis } from './calculations'

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

export function generateReportPDF(
  form: FormState,
  result: DiagnosticResult,
  options?: {
    initials?: string
    coachMode?: boolean
    coachName?: string
    athleteName?: string
    coachNotes?: string
  }
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
  doc.text(options?.coachMode ? 'Strength Ratio Assessment Report' : 'Ratio Lifts', MARGIN, y)
  y += LINE_H

  doc.setFontSize(FONT.tiny)
  setMuted(doc)
  doc.setFont(pdfFontName, 'normal')
  const coachLineParts = [
    options?.coachMode && options.coachName ? `Coach: ${options.coachName}` : null,
    options?.coachMode && options.athleteName ? `Athlete: ${options.athleteName}` : null,
  ].filter(Boolean) as string[]
  if (coachLineParts.length > 0) {
    doc.text(coachLineParts.join('  ·  '), MARGIN, y)
    y += LINE_H
  }
  doc.text(
    `${new Date().toLocaleDateString()}${options?.initials ? ` · ${options.initials}` : ''}  ·  ${form.units}  ·  ${result.confidence} confidence`,
    MARGIN,
    y
  )
  y += LINE_H + 3

  // ─── Header insight box (Key takeaway) — matches Action panel typography ─
  const insightX = MARGIN
  const insightW = CONTENT_W
  const insightY = y
  const diagWrapW = insightW - 2 * PAD
  doc.setFont(pdfFontName, 'normal')
  doc.setFontSize(FONT.small)
  const headline = getHeadlineDiagnosis(result.oneRMs, result.flags)
  const diag = doc.splitTextToSize(headline, diagWrapW)
  const titleH = LINE_HEIGHT_SMALL   // same scale as Action label
  const bodyH = Math.max(1, diag.length) * LINE_HEIGHT_SMALL
  const insightContentH = titleH + 1.5 + bodyH
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
  const mainAction =
    focus != null
      ? `Prioritise ${focus.toLowerCase()} for 4 weeks.`
      : 'Prioritise the accessory work below for 4 weeks.'
  y = insightY + insightH + 6
  y = actionLine(doc, mainAction, y)
  y += SECTION_GAP - 2

  // ─── Strength profile radar (simple polygon) ────────────────────────────
  if (result.oneRMs.length > 0) {
    y = ensureSpace(doc, y, 58)
    sectionHeader(doc, 'Strength profile (radar)', y)
    y += LINE_H + 2

    const data = getRadarChartData(result.oneRMs, form.primary_goal, form.bodyweight)
    const cx = MARGIN + CONTENT_W / 2
    const cy = y + 26
    const radius = 18

    // axes
    doc.setDrawColor(100, 116, 139)
    doc.setLineWidth(0.2)
    const n = data.length
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 * i) / n - Math.PI / 2
      const ax = cx + Math.cos(ang) * radius
      const ay = cy + Math.sin(ang) * radius
      doc.line(cx, cy, ax, ay)
    }

    function polygonPoints(key: 'user' | 'ideal'): [number, number][] {
      return data.map((d, i) => {
        const ang = (Math.PI * 2 * i) / n - Math.PI / 2
        const r = (d[key] / 100) * radius
        return [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r]
      })
    }

    const userPts = polygonPoints('user')
    const idealPts = polygonPoints('ideal')

    // ideal outline
    doc.setDrawColor(PALETTE.muted.r, PALETTE.muted.g, PALETTE.muted.b)
    doc.setLineWidth(0.4)
    for (let i = 0; i < idealPts.length; i++) {
      const [x1, y1] = idealPts[i]!
      const [x2, y2] = idealPts[(i + 1) % idealPts.length]!
      doc.line(x1, y1, x2, y2)
    }

    // user outline + light fill
    doc.setDrawColor(PALETTE.accent.r, PALETTE.accent.g, PALETTE.accent.b)
    doc.setLineWidth(0.6)
    for (let i = 0; i < userPts.length; i++) {
      const [x1, y1] = userPts[i]!
      const [x2, y2] = userPts[(i + 1) % userPts.length]!
      doc.line(x1, y1, x2, y2)
    }

    // labels
    doc.setFont(pdfFontName, 'normal')
    doc.setFontSize(FONT.tiny)
    setMuted(doc)
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 * i) / n - Math.PI / 2
      const lx = cx + Math.cos(ang) * (radius + 6)
      const ly = cy + Math.sin(ang) * (radius + 6)
      const row = data[i]!
      const label =
        row.subject === 'BW ratio'
          ? `BW ${row.oneRM.toFixed(2)}`
          : `${row.subject} ${Math.round(row.oneRM)}${form.units}`
      doc.text(label, lx, ly, { align: 'center' })
    }

    // legend
    setAccent(doc)
    doc.text('Your profile', MARGIN, y + 50)
    setMuted(doc)
    doc.text(`Ideal for ${form.primary_goal}`, MARGIN + 34, y + 50)
    setInk(doc)
    y += 56
    y += SECTION_GAP - 2
  }

  // ─── 1RM snapshot (simple grid) ─────────────────────────────────────────
  y = ensureSpace(doc, y, 50)
  sectionHeader(doc, '1RM snapshot', y)
  y += LINE_H + 2

  // Compact context line (kept minimal, coaching-first)
  doc.setFont(pdfFontName, 'normal')
  doc.setFontSize(FONT.tiny)
  setMuted(doc)
  const metaParts = [
    `Experience: ${form.experience}`,
    `Frequency: ${form.training_frequency}/wk`,
    `Goal: ${form.primary_goal}`,
    form.bodyweight != null ? `BW: ${form.bodyweight} ${form.units}` : null,
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
    const valueStr = String(lift.oneRM)
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
  y = actionLine(doc, 'Use these as baselines. Retest every 4–6 weeks.', y)
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
    y = actionLine(doc, 'Use these bars to spot what to bring up next. Keep the focus for 4 weeks, then retest.', y + 1)
    y += SECTION_GAP - 2
  }

  // ─── Accessory cards (top 3) ─────────────────────────────────────────────
  y = ensureSpace(doc, y, 35)
  sectionHeader(doc, 'Accessory focus (top 3)', y)
  y += LINE_H + 2

  const cardH = 21
  const cardGap = 3
  const cardW = CONTENT_W
  const cardPad = PAD
  const cardTextW = cardW - 2 * cardPad
  const cardOpts = { baseline: 'top' as const }

  for (const a of (result.accessories || []).slice(0, 3)) {
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
    const weightStr = a.suggestedWeight != null ? ` · ${a.suggestedWeight} ${form.units}` : ''
    const rx = `${a.setsReps || ''}${weightStr}`.trim() || '—'
    doc.text(rx, MARGIN + cardPad, rowY, cardOpts)
    rowY += LINE_HEIGHT_SMALL + 1

    doc.setFontSize(FONT.tiny)
    doc.text(cueLines, MARGIN + cardPad, rowY, cardOpts)

    y += cardH + cardGap
  }

  y = actionLine(
    doc,
    'Run these for 4 weeks. Increase load when you hit the top end with good form.',
    y + 2
  )
  y += SECTION_GAP - 2

  // ─── Footer ──────────────────────────────────────────────────────────────
  y = ensureSpace(doc, y, 18)
  doc.setFontSize(FONT.tiny)
  setMuted(doc)
  const footer = `Reminder: Retest every 4–6 weeks.`
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

  if (options?.coachMode && options.coachNotes) {
    y = ensureSpace(doc, y + 6, 30)
    sectionHeader(doc, 'Coach notes', y)
    y += LINE_H + 2
    doc.setFont(pdfFontName, 'normal')
    doc.setFontSize(FONT.small)
    setMuted(doc)
    const notesLines = doc.splitTextToSize(options.coachNotes, CONTENT_W - 2 * PAD)
    doc.text(notesLines, MARGIN + PAD, y)
    setInk(doc)
  }

  doc.save('ratio-lifts-report.pdf')
  })()
}
