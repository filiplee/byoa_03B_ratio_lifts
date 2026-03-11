# Ratio Lifts — One-Page PDF Template

**Non-production.** The in-app “Export PDF” button uses **`src/pdf.ts`** (jsPDF) only. This folder is for CLI generation, experimentation, and future server-side HTML→PDF. To avoid two-PDF drift, treat `src/pdf.ts` as the single source of truth unless you switch the app to this template.

Professional, coach-friendly PDF report with two-column layout, calculation traces, validation, and percentile visualization. Accent color: **#0F766E** (deep teal).

## Files

| File | Purpose |
|------|---------|
| `report-template.html` | HTML/Tailwind template with placeholders (A4/Letter) |
| `report-schema.json` | JSON schema for full report data |
| `input-schema.json` | JSON schema for raw input data |
| `example-input.json` | Example input (Squat 80×3, Bench 60×5, Deadlift 90×3, Press 50×5) |
| `example-report.json` | Example full report (computed from example-input) |
| `accessory-mapping.json` | Priorities and injury fallbacks for all flags |
| `report-validation.js` | Pre-generate validation module |
| `report-render.js` | Renders template + data → HTML |
| `report-validation.test.js` | Example unit tests |
| `generate-html.mjs` | CLI to generate HTML from JSON |
| `build-report-from-input.mjs` | CLI to build full report from raw input JSON |
| `percentile-visualization.md` | Instructions and code for percentile curves |

## Layout & Copy

- **Left column:** Inputs trace, 1RMs & calculation trace (input → Epley → 1RM), computed ratios, how calculated, dynamic banners (missing lifts, warmup hint, squat-deadlift parity)
- **Right column:** Confidence badge + explanation, overall summary, interpretation & priority, flags & thresholds, top 3 priorities (sets/reps, cues), accessory exercises, next steps, QR/link placeholders
- **Footer:** Safety note, CTAs (Save, Subscribe, Connect to coach), privacy

## Placeholders

- `{{date}}`, `{{initials_suffix}}`, `{{units}}`, `{{bodyweight_line}}`, `{{experience}}`, `{{training_frequency}}`, `{{primary_goal}}`
- `{{lifts_table_rows}}` — includes input_source column
- `{{ratios_section}}`, `{{missing_lifts_banner}}`, `{{warmup_hint}}`, `{{squat_deadlift_parity_note}}`, `{{squat_dominant_diagnosis_warning}}`
- `{{confidence}}`, `{{confidence_badge_class}}`, `{{confidence_explanation}}`, `{{overall_summary}}`, `{{one_line_diagnosis}}`
- `{{percentile_bars}}`, `{{percentile_caption}}` — lift percentiles (× bodyweight)
- `{{priorities_list}}`, `{{accessories_list}}`, `{{flags_section}}`
- `{{next_steps}}`, `{{qr_placeholder}}`, `{{link_placeholder}}`, `{{save_link}}`, `{{micro_plan_link}}`, `{{subscribe_link}}`, `{{coach_link}}`

## Ratio Logic (verbatim)

- **1RM:** Epley = weight × (1 + reps/30). Round to 1 decimal.
- **Ratios (2 decimals):** bench_to_squat = bench1RM/squat1RM; squat_to_deadlift = squat1RM/deadlift1RM; press_to_bench = press1RM/bench1RM
- **Thresholds:** Bench:Squat >1.10=>bench_dominant; 0.45–1.10=>typical; <0.45=>bench_lagging. Squat:Deadlift <0.80=>deadlift_dominant; 0.80–1.00=>typical; >1.00=>squat_dominant. Press:Bench <0.35=>press_weak; 0.35–0.45=>typical; >0.45=>press_strong
- **Confidence:** High = 4 lifts + experience + bodyweight; Medium = 2–3 lifts; Low = 1 lift or missing experience

## Validation Module

Exports: `compute1RM`, `computeRatios`, `generateFlags`, `computeConfidence`, `validateConsistency`, `validateUnits`, `validateBeforeGenerate`, `getValidationHints`, `getAccessoriesForFlags`, `ACCESSORY_MAP`.

- **validateConsistency:** Ensures diagnosis is derived from flags; returns error if mismatch (blocks PDF). Returns hints: `missing_lifts_banner`, `warmup_hint`, `squat_deadlift_parity_note`, `squat_dominant_diagnosis_warning`.
- **&lt;2 lifts:** Allow PDF, include banner.
- **reps&gt;10 and weight&lt;0.5×bodyweight:** Non-blocking warmup hint.
- **abs(squat_to_deadlift − 1.0) ≤ 0.02:** Explanatory line about parity and movement quality.
- **squat_to_deadlift &gt; 1.0:** If diagnosis does not recommend deadlift volume/technique, add warning.

## Wire Validation Before Generation

```javascript
import { validateBeforeGenerate, getValidationHints } from './report-validation.js';
import { renderReport } from './report-render.js';

// 1. Validate (throws if blocks)
validateBeforeGenerate(data);

// 2. Render (calls validateBeforeGenerate internally; uses getValidationHints for banners)
const html = renderReport(templateHtml, data);
```

## Rendering HTML → PDF

### Client-side (jsPDF + html2canvas)

```javascript
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { renderReport } from './report-render.js';

const templateHtml = await fetch('/report-template.html').then(r => r.text());
const html = renderReport(templateHtml, data);

// Inject into DOM, capture, export
const container = document.createElement('div');
container.innerHTML = html;
document.body.appendChild(container);
const canvas = await html2canvas(container, { scale: 2, useCORS: true });
const pdf = new jsPDF({ format: 'a4', unit: 'mm' });
pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297);
pdf.save('ratio-lifts-report.pdf');
document.body.removeChild(container);
```

### Serverless (Puppeteer / HTML→PDF)

```javascript
import { renderReport } from './report-render.js';
import puppeteer from 'puppeteer';

const html = renderReport(templateHtml, data);
const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'networkidle0' });
const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
await browser.close();
```

For serverless (Vercel, AWS Lambda): use `puppeteer-core` + `@sparticuz/chromium` or similar.

### Generate HTML (CLI)

```bash
cd src/pdf-template
node generate-html.mjs                    # example-report.json → report-output.html
node generate-html.mjs my-data.json out.html
```

### Build Report from Input (CLI)

```bash
cd src/pdf-template
node build-report-from-input.mjs                    # example-input.json → example-report.json
node build-report-from-input.mjs my-input.json out-report.json
node generate-html.mjs out-report.json report-output.html
```

Open `report-output.html` in a browser → Print → Save as PDF.

## Run Tests

```bash
npx vitest run src/pdf-template/report-validation.test.js
```

## Example Unit Test Cases

- **compute1RM:** Epley for weight_reps, user_provided for one_rm, null for invalid, rounding
- **computeRatios:** bench>squat, only one lift
- **generateFlags:** bench_dominant, bench_lagging, typical, squat_deadlift parity
- **computeConfidence:** High/Medium/Low
- **validateConsistency:** diagnosis vs flags, hints for &lt;2 lifts, warmup, parity, squat_dominant
- **validateUnits:** kg/lb valid, invalid units

## Ingesting Percentile Dataset

1. **Data sources** (for developer reference; cite provenance in PDF):
   - [StrengthLevel](https://strengthlevel.com/) — community self-reported data
   - [Strength Origins](https://strengthorigins.com/) — competition datasets
   - Open powerlifting / weightlifting datasets

2. **Format:** Store lift ratios (1RM ÷ bodyweight) by lift, sex, and bodyweight bin. Compute percentiles from cumulative distribution.

3. **Fallback:** If no external dataset, compute percentiles from anonymised app data once `N >= 500`. See `percentile-visualization.md` for code.
