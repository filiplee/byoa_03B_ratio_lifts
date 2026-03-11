# Percentile Visualization — Instructions & Code

This document describes how to compute percentiles from an external dataset and render a population curve with the lifter's percentile highlighted and color-coded.

## Overview

- **Input:** 1RM and bodyweight for each lift. Compute ratio = 1RM ÷ bodyweight.
- **Output:** Percentile (0–100) for each lift, plus optional population density curve.
- **Color coding:** Green (≥ 67th), Amber (34th–66th), Red (≤ 33rd).

## Data Sources (Developer Reference)

These are community/competition datasets and **must be cited in the PDF** as provenance:

- **StrengthLevel** — community self-reported data; API or scraped tables
- **Strength Origins** — competition datasets; open data
- **Open Powerlifting** — [openpowerlifting.org](https://www.openpowerlifting.org/) — competition results

Include a caption in the PDF: *"Percentiles derived from [data source]. Shown for context — heuristics only."*

## Fallback: App Data

If no external dataset is available, compute percentiles from anonymised app data once `N >= 500` per lift/bodyweight bin. Store `{ liftId, bodyweightBin, ratioBW }` and compute cumulative distribution.

---

## 1. Compute Percentile from Dataset

```javascript
/**
 * Compute percentile for a lifter's ratio (1RM ÷ bodyweight) given a sorted array of population ratios.
 * @param {number} lifterRatio - 1RM / bodyweight
 * @param {number[]} populationRatios - Sorted ascending
 * @returns {number} Percentile 0–100
 */
function computePercentile(lifterRatio, populationRatios) {
  if (!populationRatios?.length) return null;
  const sorted = [...populationRatios].sort((a, b) => a - b);
  const countBelow = sorted.filter((r) => r < lifterRatio).length;
  const countEqual = sorted.filter((r) => r === lifterRatio).length;
  const pct = ((countBelow + countEqual / 2) / sorted.length) * 100;
  return Math.round(pct);
}

// Example: Squat 88 kg, bodyweight 73 kg → ratio 1.21
const squatRatios = [0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5]; // from dataset
const pct = computePercentile(88 / 73, squatRatios);
```

---

## 2. Build lift_percentiles for Report

```javascript
/**
 * Build lift_percentiles array for report data.
 * @param {Object} oneRMByLift - { squat, bench, deadlift, press }
 * @param {number} bodyweight
 * @param {Object} datasetByLift - { squat: number[], bench: number[], ... }
 * @returns {Array<{ id, name, ratioBW, percentile }>}
 */
function buildLiftPercentiles(oneRMByLift, bodyweight, datasetByLift) {
  const liftNames = { squat: 'Squat', bench: 'Bench', deadlift: 'Deadlift', press: 'Press' };
  const result = [];
  for (const [id, oneRM] of Object.entries(oneRMByLift)) {
    if (oneRM == null || bodyweight == null || bodyweight <= 0) continue;
    const ratioBW = oneRM / bodyweight;
    const population = datasetByLift[id];
    const percentile = population ? computePercentile(ratioBW, population) : null;
    result.push({
      id,
      name: liftNames[id] || id,
      ratioBW: Math.round(ratioBW * 100) / 100,
      percentile: percentile ?? 50, // fallback to median if no data
    });
  }
  return result;
}
```

---

## 3. Population Density Curve (SVG/Canvas)

Render a cumulative distribution or density curve for the selected lift and bodyweight bin; overlay a vertical line and colored dot for the lifter's percentile.

```javascript
/**
 * Render a compact population curve with lifter's percentile highlighted.
 * @param {Object} opts - { liftId, lifterRatio, populationRatios, width, height }
 * @returns {string} SVG markup
 */
function renderPercentileCurve(opts) {
  const { liftId, lifterRatio, populationRatios, width = 200, height = 60 } = opts;
  if (!populationRatios?.length) return '';

  const sorted = [...populationRatios].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const pct = computePercentile(lifterRatio, populationRatios);
  const color = pct >= 67 ? '#22c55e' : pct >= 34 ? '#f59e0b' : '#ef4444';

  // Normalize lifter position (0–1) within range
  const range = max - min || 1;
  const xPos = Math.max(0, Math.min(1, (lifterRatio - min) / range));

  return `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="curveGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0F766E" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#0F766E" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <!-- Simplified density curve (histogram bins) -->
  <path d="${buildHistogramPath(sorted, width, height)}" fill="url(#curveGrad)" stroke="#0F766E" stroke-width="1"/>
  <!-- Lifter's position -->
  <line x1="${xPos * width}" y1="0" x2="${xPos * width}" y2="${height}" stroke="${color}" stroke-width="2"/>
  <circle cx="${xPos * width}" cy="${height - 4}" r="4" fill="${color}"/>
</svg>`;
}

function buildHistogramPath(sorted, w, h) {
  const bins = 20;
  const min = sorted[0];
  const max = sorted[sorted.length - 1] || min + 1;
  const step = (max - min) / bins || 1;
  const counts = new Array(bins).fill(0);
  for (const v of sorted) {
    const i = Math.min(bins - 1, Math.floor((v - min) / step));
    counts[i]++;
  }
  const maxCount = Math.max(...counts, 1);
  let d = `M 0 ${h}`;
  for (let i = 0; i < bins; i++) {
    const x = (i / bins) * w;
    const barH = (counts[i] / maxCount) * (h - 8);
    d += ` L ${x} ${h - barH} L ${x + w / bins} ${h - barH} L ${x + w / bins} ${h}`;
  }
  d += ` L ${w} ${h} Z`;
  return d;
}
```

---

## 4. Color-Code Percentile Badge

```javascript
function getPercentileColor(percentile) {
  if (percentile >= 67) return { bg: '#dcfce7', text: '#166534', bar: '#22c55e' }; // green
  if (percentile >= 34) return { bg: '#fef3c7', text: '#92400e', bar: '#f59e0b' }; // amber
  return { bg: '#fee2e2', text: '#991b1b', bar: '#ef4444' }; // red
}
```

---

## 5. Inline Bar for PDF (Used in Template)

The report template uses a compact horizontal bar. Data shape:

```json
{
  "lift_percentiles": [
    { "id": "squat", "name": "Squat", "ratioBW": 1.21, "percentile": 45 },
    { "id": "bench", "name": "Bench", "ratioBW": 0.96, "percentile": 52 },
    { "id": "deadlift", "name": "Deadlift", "ratioBW": 1.36, "percentile": 38 },
    { "id": "press", "name": "Press", "ratioBW": 0.80, "percentile": 55 }
  ],
  "percentile_caption": "Percentiles derived from [data source]. Shown for context — heuristics only."
}
```

Bar color: `percentile >= 67` → green, `34–66` → amber, `<= 33` → red.

---

## 6. Bodyweight Binning (Optional)

For more accurate percentiles, bin the population by bodyweight (e.g. 60–70 kg, 70–80 kg) and compute percentiles within the lifter's bin.

```javascript
function getBodyweightBin(bw) {
  const bins = [50, 60, 70, 80, 90, 100, 150];
  for (let i = 0; i < bins.length - 1; i++) {
    if (bw >= bins[i] && bw < bins[i + 1]) return `${bins[i]}-${bins[i + 1]}`;
  }
  return '100+';
}
```

Store dataset as `{ [liftId]: { [bodyweightBin]: number[] } }`.
