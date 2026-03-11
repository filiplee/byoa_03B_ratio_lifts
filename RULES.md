# Ratio Lifts — Diagnostics, Calculation & Design Rules

This document defines the ratio logic, validation rules, and design principles for the Ratio Lifts MVP. Implementations must follow these rules verbatim.

---

## 1) 1RM Calculation

- If user provides **weight + reps**, compute 1RM using Epley:
  ```
  1RM = weight * (1 + reps/30)
  ```
- Round 1RM to **1 decimal place**.
- If user provides **one_rm** directly, use that value and mark as `"user_provided"`.

---

## 2) Ratios to Compute and Formulas

- Compute **only when both lifts exist**.
  - **Same-body:** `bench_to_squat` = bench1RM / squat1RM, `squat_to_deadlift` = squat1RM / deadlift1RM, `press_to_bench` = press1RM / bench1RM
  - **Lower : Upper (cross-body):** `squat_to_bench` = squat1RM / bench1RM, `deadlift_to_bench` = deadlift1RM / bench1RM, `squat_to_press` = squat1RM / press1RM, `deadlift_to_press` = deadlift1RM / press1RM
- Round ratios to **2 decimal places** for display.

---

## 3) Thresholds and Flags (MVP Conservative Defaults)

### Bench : Squat
- **> 1.10** => flag `"bench_dominant"`
- **0.45–1.10** => `"typical_bench_squat"`
- **< 0.45** => flag `"bench_lagging"`

### Squat : Deadlift
- **< 0.80** => flag `"deadlift_dominant"`
- **0.80–1.00** => `"typical_squat_deadlift"`
- **> 1.00** => flag `"squat_dominant"`

### Press : Bench
- **< 0.35** => flag `"press_weak"`
- **0.35–0.45** => `"typical_press_bench"`
- **> 0.45** => flag `"press_strong"`

### Lower : Upper (cross-body)
- **Squat : Bench:** < 1.0 => `squat_lagging_bench`, 1.0–1.5 => typical, > 1.5 => `bench_lagging_squat`
- **Deadlift : Bench:** < 1.3 => `deadlift_lagging_bench`, 1.3–1.7 => typical, > 1.7 => `bench_lagging_deadlift`
- **Squat : Press:** < 1.8 => `squat_lagging_press`, 1.8–2.4 => typical, > 2.4 => `press_lagging_squat`
- **Deadlift : Press:** < 2.2 => `deadlift_lagging_press`, 2.2–2.8 => typical, > 2.8 => `press_lagging_deadlift`

---

## 4) Confidence Scoring

- **High:** 4 lifts present AND experience provided AND bodyweight present.
- **Medium:** 2–3 lifts present.
- **Low:** 1 lift only or missing experience.
- Include confidence label in the PDF and **soften language** when confidence is Medium/Low.

---

## 5) Accessory Mapping JSON (MVP)

Provide mapping for each flag with primary priorities and injury fallbacks:

```json
{
  "bench_dominant": {
    "priorities": ["Squat strength 3x5", "Lower-body volume 3x8", "Hip drive work 3x10"],
    "fallback_if_knee_injury": ["Romanian deadlift 3x6", "Glute bridge 3x8"]
  },
  "deadlift_dominant": {
    "priorities": ["RDL 3x6", "Glute bridge 3x8", "Hamstring curl 3x10"],
    "fallback_if_lower_back_pain": ["Hip thrust 3x6", "Single-leg RDL light"]
  },
  "bench_lagging": {
    "priorities": ["Horizontal push volume 3x8", "Close-grip bench 3x6", "Triceps work 3x10"]
  },
  "press_weak": {
    "priorities": ["Seated DB press 3x6", "Face pulls 3x12", "Lateral raises 3x10"]
  }
}
```

*(Additional flags such as `squat_dominant`, `press_strong`, `typical_*` may use generic or no accessory mapping.)*

---

## 6) Pre-Generate Validation Rules

- If diagnosis text category does **not** match numeric flags, **block PDF generation** and surface a developer error.
- If **fewer than 2 lifts**, allow PDF but include banner: *"Add more lifts to unlock ratio diagnostics."*
- If **reps > 10** and **weight < 0.5 × bodyweight**, show non-blocking hint: *"Check input — is this a warmup?"*
- Ensure units are consistent; convert mixed units or block with an error.

---

## 7) Output Requirements for Generated Artifacts

- The HTML/PDF template must include placeholders for:
  - lifts array (name, method, weight, reps, one_rm)
  - computed 1RMs
  - ratios
  - flags
  - confidence
  - accessory arrays
  - raw input trace lines

- The validation script must export functions:
  - `compute1RM(input)`
  - `computeRatios(lifts)`
  - `generateFlags(ratios)`
  - `computeConfidence(inputs)`
  - `validateConsistency(inputs, outputs)`

---

## Design Rules (from Product Brief)

- **Treat ratios as diagnostic heuristics, not definitive science.** They vary by sex, bodyweight, limb lengths, training age, and sport.
- Use **soft, non-prescriptive language**: "may indicate", "likely", "consider".
- Always show how values were calculated (e.g. "1RM estimated via Epley formula").
- Prominent disclaimer before report generation and on PDF: *"Informational only — not medical advice. Consult a professional for injuries."*
- Mobile-first: large numeric inputs, sticky CTA, fast keyboard flow.
- Accessibility: proper labels, numeric keyboard on mobile, color contrast.
