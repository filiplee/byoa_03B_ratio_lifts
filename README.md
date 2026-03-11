# Ratio Lifts MVP

A minimal, mobile-first single-page web app that accepts barbell lift inputs, computes estimated 1RMs (Epley formula), derives strength ratios, and returns a one-page PDF diagnostic with a one-line diagnosis and three accessory exercises.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Scripts

- **`npm run dev`** — Start Vite dev server
- **`npm run build`** — Production build
- **`npm run preview`** — Preview production build
- **`npm run test`** — Run unit tests (calculation module)
- **`npm run test:watch`** — Run tests in watch mode

## Tech stack

- **Frontend:** React 19 + Vite + TypeScript
- **Styling:** Tailwind CSS v4 (mobile-first)
- **PDF:** jsPDF (client-side)
- **Tests:** Vitest + Testing Library

## Deploy (Vercel)

```bash
npm run build
```

Then deploy the `dist` folder to Vercel (or connect the repo for automatic deploys).

## Sample input and expected output

- **Input (kg):** bodyweight 78, experience Intermediate, Squat 120×3, Bench 90×5, Deadlift 160×3, Press 55×5  
- **1RMs (Epley):** Squat 132, Bench 105, Deadlift 176, Press 64.2  
- **Ratios:** Bench:Squat 0.8, Squat:Deadlift 0.75 (flag: deadlift_dominant), Press:Bench 0.61  
- **Diagnosis:** “Deadlift dominant relative to squat — consider prioritising posterior-chain accessories.”  
- **Accessories:** RDL 3×6; Glute bridge 3×8; Hamstring curl 3×10  

See `src/calculations.test.ts` and `RULES.md` for full diagnostic and calculation rules.

## Project structure

- `RULES.md` — Diagnostics, calculation, and design rules (canonical spec)
- `src/` — App entry, types, calculations, validation, PDF, analytics, components
- `src/calculations.ts` — Epley 1RM, ratios, flags, confidence, accessories
- `src/pdf.ts` — **Production** one-page report PDF generation (used by the in-app Export button)
- `src/analytics.ts` — Event hooks for form_start, form_complete, pdf_export (wire to PostHog/GA4 as needed)
- `src/pdf-template/` — Standalone template + tooling (not used by the app export):
  - `report-template.html` — Single-page A4/Letter template (accent #0F766E)
  - `report-validation.js` — compute1RM, computeRatios, generateFlags, computeConfidence, validateConsistency
  - `accessory-mapping.json` — Priorities and injury fallbacks for all flags
  - `input-schema.json` — JSON schema for raw input
  - `example-input.json` — Sample input (Squat 80×3, Bench 60×5, Deadlift 90×3, Press 50×5)
  - `percentile-visualization.md` — Instructions and code for percentile curves

## PDF generation: avoiding “two systems” drift

The app intentionally has **one production PDF path**: `src/pdf.ts`.

`src/pdf-template/` exists for experimentation, CLI generation, and future server-side HTML→PDF, but it can drift stylistically. If you want to fully eliminate that risk, we should either:

- delete `src/pdf-template/` (or move it to a separate repo), or
- switch the app export to the HTML template as the single canonical PDF source.

## License

Private / unlicensed for now.
