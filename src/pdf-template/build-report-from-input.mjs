#!/usr/bin/env node
/**
 * Build full report data from raw input.
 * Usage: node build-report-from-input.mjs [input.json] [output.json]
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  compute1RM,
  computeRatios,
  generateFlags,
  computeConfidence,
  getAccessoriesForFlags,
} from './report-validation.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const inputPath = process.argv[2] || join(__dirname, 'example-input.json');
const outputPath = process.argv[3] || join(__dirname, 'example-report.json');

const input = JSON.parse(readFileSync(inputPath, 'utf-8'));

// Compute 1RMs
const liftIdToKey = { squat: 'squat', bench: 'bench', deadlift: 'deadlift', press: 'press' };
const oneRMByLift = {};
const computed1rms = [];

for (const lift of input.lifts || []) {
  const result = compute1RM(lift);
  if (result) {
    const key = liftIdToKey[lift.id] || lift.id;
    oneRMByLift[key] = result.oneRM;
    computed1rms.push({
      id: lift.id,
      name: lift.name,
      oneRM: result.oneRM,
      method: result.method === 'user_provided' ? 'user_provided' : 'epley',
    });
  }
}

// Compute ratios and flags
const ratios = computeRatios(oneRMByLift);
const flags = generateFlags(ratios);

// Confidence
const confidence = computeConfidence({
  ...input,
  computed_1rms: computed1rms,
});

// Diagnosis from primary flag
const primaryFlag = flags.find((f) => !f.id.startsWith('typical_'));
const diagnosis =
  primaryFlag?.message ||
  'Ratios within typical ranges. Keep consistent training.';

// Soften language for Medium/Low confidence
let oneLineDiagnosis = diagnosis;
if (confidence === 'Medium' || confidence === 'Low') {
  oneLineDiagnosis = oneLineDiagnosis.replace(/^(\w)/, (m) => m.toLowerCase());
  if (!oneLineDiagnosis.startsWith('may') && !oneLineDiagnosis.startsWith('consider')) {
    oneLineDiagnosis = `May indicate: ${oneLineDiagnosis}`;
  }
}

// Confidence explanation
const confidenceExplanations = {
  High: 'High: 4 lifts, experience, and bodyweight provided.',
  Medium: 'Medium: 2–3 lifts present. Consider adding more data for stronger diagnostics.',
  Low: 'Low: 1 lift only or missing experience. Add more lifts for ratio diagnostics.',
};
const confidenceExplanation = confidenceExplanations[confidence];

// Accessories
const accessories = getAccessoriesForFlags(flags, {
  injury_notes: input.injury_notes,
});

// Priorities (top 3 from accessories)
const priorities = accessories.slice(0, 3).map((a) => `${a.name} ${a.setsReps}`);

// Lift percentiles (placeholder; requires external dataset)
const bodyweight = input.bodyweight;
const liftPercentiles =
  bodyweight > 0
    ? computed1rms.map((c) => ({
        id: c.id,
        name: c.name,
        ratioBW: Math.round((c.oneRM / bodyweight) * 100) / 100,
        percentile: 50, // placeholder; replace with dataset lookup
      }))
    : [];

const report = {
  units: input.units || 'kg',
  date: new Date().toISOString().slice(0, 10),
  initials: input.initials || '',
  bodyweight: input.bodyweight,
  experience: input.experience,
  training_frequency: input.training_frequency,
  primary_goal: input.primary_goal,
  lifts: input.lifts.map((l) => ({
    ...l,
    input_source: l.method === 'one_rm' ? 'user_provided' : l.method || 'weight_reps',
  })),
  computed_1rms: computed1rms,
  ratios,
  flags,
  confidence,
  confidence_explanation: confidenceExplanation,
  overall_summary:
    primaryFlag
      ? `${primaryFlag.message} Focus on priorities below.`
      : 'Ratios within typical ranges. Keep consistent training.',
  one_line_diagnosis: oneLineDiagnosis,
  priorities,
  accessories,
  next_steps: 'Continue training. Add more lifts if you want broader ratio diagnostics.',
  lift_percentiles: liftPercentiles,
  percentile_caption: 'Percentiles derived from [data source]. Shown for context — heuristics only.',
  how_ratios_work_url: '#',
  qr_placeholder: '[QR code URL]',
  link_placeholder: '[https://ratio-lifts.app/how-ratios-work]',
  save_link: '#',
  micro_plan_link: '#',
  subscribe_link: '#',
  coach_link: '#',
};

writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
console.log(`Wrote ${outputPath}`);
