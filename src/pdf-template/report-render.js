/**
 * Renders report-template.html with JSON data.
 * Produces HTML string ready for PDF conversion.
 */

import { validateBeforeGenerate, getValidationHints } from './report-validation.js';

/**
 * Build HTML string from template and data.
 * @param {string} templateHtml - Raw HTML template
 * @param {Object} data - Report data (see report-schema.json)
 * @returns {string} Rendered HTML
 */
function renderReport(templateHtml, data) {
  validateBeforeGenerate(data);
  const hints = getValidationHints(data);

  const units = data.units || 'kg';
  const initialsSuffix = data.initials ? ` — ${data.initials}` : '';
  const bodyweightLine = data.bodyweight != null
    ? `<li>Bodyweight: ${data.bodyweight} ${units}</li>`
    : '';

  const computedByLift = {};
  (data.computed_1rms || []).forEach((c) => { computedByLift[c.id] = c; });

  const liftIcons = { squat: '▾', bench: '▬', deadlift: '▴', press: '▴' };
  const liftsWithComputed = (data.lifts || []).map((lift) => {
    const computed = computedByLift[lift.id];
    let trace = '';
    let inputStr = '';
    const source = lift.input_source || lift.method || 'weight_reps';
    if (lift.method === 'weight_reps' && lift.weight != null && lift.reps != null) {
      inputStr = `${lift.weight} × ${lift.reps} reps`;
      trace = computed?.method === 'epley'
        ? `${lift.weight} × ${lift.reps} → Epley → ${computed?.oneRM ?? '-'}`
        : `${lift.weight} × ${lift.reps} → Epley → ${computed?.oneRM ?? '-'}`;
    } else if (lift.method === 'one_rm' && lift.one_rm != null) {
      inputStr = `${lift.one_rm} (provided)`;
      trace = `${lift.one_rm} (provided)`;
    }
    const oneRM = computed?.oneRM ?? '-';
    const icon = liftIcons[lift.id] || '•';
    return `<tr class="border-b border-slate-500/30">
      <td class="py-1 text-slate-200"><span style="color: var(--accent);">${icon}</span> ${escapeHtml(lift.name)}</td>
      <td class="py-1 text-slate-300">${inputStr}</td>
      <td class="py-1 text-slate-300">${escapeHtml(source)}</td>
      <td class="py-1 font-medium text-slate-200">${oneRM} ${units}<span class="trace-line block">→ ${trace}</span></td>
    </tr>`;
  }).join('\n');

  const ratios = data.ratios || [];
  const ratiosSection = ratios.length > 0
    ? ratios.map((r) => `<div class="flex justify-between text-[10px] py-0.5 text-slate-200"><span>${escapeHtml(r.label)}</span><span class="font-medium">${r.value}</span></div>`).join('\n')
    : '<p class="text-[10px] text-slate-400 italic">Add more lifts to unlock ratio diagnostics.</p>';

  const missingLiftsBanner = hints.missing_lifts_banner
    ? `<div class="rounded p-2 mb-3 border border-amber-500/40" style="background: rgba(252, 211, 77, 0.15);"><p class="text-[10px] text-amber-300 font-medium">${escapeHtml(hints.missing_lifts_banner)}</p></div>`
    : '';

  const warmupHint = hints.warmup_hint
    ? `<div class="rounded p-2 mb-3 border border-slate-500/50 bg-slate-600/50"><p class="text-[10px] text-slate-300">${escapeHtml(hints.warmup_hint)}</p></div>`
    : '';

  const squatDeadliftParityNote = hints.squat_deadlift_parity_note
    ? `<div class="rounded p-2 mb-3 border border-teal-500/40" style="background: rgba(94, 234, 212, 0.1);"><p class="text-[10px] text-teal-300">${escapeHtml(hints.squat_deadlift_parity_note)}</p></div>`
    : '';

  const squatDominantDiagnosisWarning = hints.squat_dominant_diagnosis_warning
    ? `<div class="rounded p-2 mb-3 border border-amber-500/40" style="background: rgba(252, 211, 77, 0.15);"><p class="text-[10px] text-amber-300">${escapeHtml(hints.squat_dominant_diagnosis_warning)}</p></div>`
    : '';

  const confidence = data.confidence || 'Medium';
  const confidenceBadgeClass =
    confidence === 'High' ? 'badge-high' : confidence === 'Medium' ? 'badge-medium' : 'badge-low';

  const liftPercentiles = data.lift_percentiles || [];
  const percentileBars = liftPercentiles.length > 0
    ? liftPercentiles.map((lp) => {
        const pct = lp.percentile ?? 50;
        const barColor = pct >= 67 ? 'bar-high' : pct >= 34 ? 'bar-amber' : 'bar-red';
        const ratioBW = lp.ratioBW != null ? lp.ratioBW.toFixed(2) : '—';
        const icon = liftIcons[lp.id] || '•';
        return `<div class="flex items-center gap-2 mb-1">
          <span class="text-[10px] w-2 text-center text-slate-200" style="color: var(--accent);">${icon}</span>
          <span class="text-[9px] w-12 text-slate-200">${escapeHtml(lp.name || lp.id)}</span>
          <div class="flex-1 h-1.5 bg-slate-600 rounded overflow-hidden">
            <div class="${barColor} h-full rounded" style="width: ${Math.min(100, Math.max(0, pct))}%"></div>
          </div>
          <span class="text-[8px] w-8 text-slate-300">${pct}%</span>
          <span class="text-[8px] text-slate-400">${ratioBW}×BW</span>
        </div>`;
      }).join('\n')
    : '<p class="text-[9px] text-slate-400 italic">Add bodyweight and external percentile data to show lift percentiles.</p>';

  const percentileCaption = data.percentile_caption ||
    'Percentiles derived from external dataset. Shown for context — heuristics only.';

  const priorities = data.priorities || [];
  const prioritiesList = priorities.map((p) => `<li>${escapeHtml(typeof p === 'string' ? p : p.name || p)}</li>`).join('\n');

  const accessories = data.accessories || [];
  const accessoriesList = accessories.map((a) => {
    const name = a.name || a;
    const addresses = a.forImbalance ? ` <span class="text-slate-400">(addresses: ${escapeHtml(a.forImbalance)})</span>` : '';
    const setsReps = a.setsReps ? ` <span class="font-medium text-slate-200">${escapeHtml(a.setsReps)}</span>` : '';
    const cue = a.cue ? ` <span class="text-slate-400">— ${escapeHtml(a.cue)}</span>` : '';
    return `<li><span class="text-slate-200">${escapeHtml(name)}</span>${addresses}${setsReps}${cue}</li>`;
  }).join('\n');

  const flags = data.flags || [];
  const flagsSection = flags.length > 0
    ? `<ul class="text-[10px] text-slate-200 space-y-0.5">${flags.map((f) => `<li>${escapeHtml(f.label)}: ${f.value} — ${escapeHtml(f.message)}</li>`).join('\n')}</ul>`
    : '<p class="text-[10px] text-slate-400 italic">No flags within typical ranges.</p>';

  const replacements = {
    '{{date}}': data.date || new Date().toISOString().slice(0, 10),
    '{{initials_suffix}}': initialsSuffix,
    '{{units}}': units,
    '{{bodyweight_line}}': bodyweightLine,
    '{{training_frequency}}': data.training_frequency || '3-4',
    '{{primary_goal}}': data.primary_goal || 'Strength',
    '{{experience}}': data.experience || 'Intermediate',
    '{{lifts_table_rows}}': liftsWithComputed,
    '{{ratios_section}}': ratiosSection,
    '{{missing_lifts_banner}}': missingLiftsBanner,
    '{{warmup_hint}}': warmupHint,
    '{{squat_deadlift_parity_note}}': squatDeadliftParityNote,
    '{{squat_dominant_diagnosis_warning}}': squatDominantDiagnosisWarning,
    '{{how_ratios_work_url}}': data.how_ratios_work_url || '#',
    '{{confidence}}': confidence,
    '{{confidence_badge_class}}': confidenceBadgeClass,
    '{{percentile_bars}}': percentileBars,
    '{{percentile_caption}}': escapeHtml(percentileCaption),
    '{{micro_plan_link}}': data.micro_plan_link || '#',
    '{{confidence_explanation}}': escapeHtml(data.confidence_explanation || ''),
    '{{overall_summary}}': escapeHtml(data.overall_summary || ''),
    '{{one_line_diagnosis}}': escapeHtml(data.one_line_diagnosis || 'No diagnosis available.'),
    '{{priorities_list}}': prioritiesList || '<li>Add more lifts for priorities.</li>',
    '{{accessories_list}}': accessoriesList || '<li>Add more lifts for accessories.</li>',
    '{{flags_section}}': flagsSection,
    '{{next_steps}}': escapeHtml(data.next_steps || 'Continue training.'),
    '{{qr_placeholder}}': data.qr_placeholder || '[QR]',
    '{{link_placeholder}}': data.link_placeholder || '[link]',
    '{{save_link}}': data.save_link || '#',
    '{{subscribe_link}}': data.subscribe_link || '#',
    '{{coach_link}}': data.coach_link || '#',
  };

  let html = templateHtml;
  for (const [key, value] of Object.entries(replacements)) {
    html = html.split(key).join(value);
  }
  return html;
}

function escapeHtml(s) {
  if (typeof s !== 'string') return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export { renderReport, escapeHtml };
