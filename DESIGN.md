# Design Principles — Rainy Mood Aesthetic

The Ratio Lifts web app and PDF report are designed to evoke the **calm of rainy moods**: quiet, reflective, and focused. The visual language supports thoughtful analysis of strength data without distraction.

---

## Color Palette

| Role | Value | Usage |
|------|-------|-------|
| **Background** | Slate gray (`#334155` / `slate-700`) | Primary surface; evokes overcast sky |
| **Text** | White (`#ffffff`) | Primary content; crisp against dark background |
| **Muted text** | Slate 200–300 (`#e2e8f0`–`#cbd5e1`) | Secondary labels, hints, captions |
| **Accent** | Muted teal (`#5eead4` / `teal-300`) | Links, buttons, highlights; soft, not loud |
| **Accent (darker)** | Teal 600 (`#0d9488`) | Active states, emphasis |

---

## Typography

- **Font family**: Clean sans-serif (system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)
- **Weights**: Light (300) for body, medium (500) for labels, semibold (600) for headings
- **Avoid**: Heavy weights (700+), decorative or display fonts
- **Line height**: Generous (1.5–1.6) for readability

---

## Layout

- **Centered**: Content centered with `max-w-lg` or `max-w-xl` for comfortable reading
- **Whitespace**: Generous padding and margins; sections breathe
- **Structure**: Clear, digestible sections with subtle dividers
- **No clutter**: One primary task per view

---

## Navigation & UI

- **Minimal**: Only essential controls (e.g., unit toggle, generate report)
- **No decorative imagery**: No illustrations, icons only when functional
- **Flat hierarchy**: Avoid nested menus; use expandable sections sparingly

---

## Mood

- **Quiet**: Low contrast, muted accents, no bright or saturated colors
- **Reflective**: Space to pause and consider; no urgency or flash
- **Focused**: Content-first; UI recedes so data stands out

---

## Implementation Notes

- Use `focus:ring-teal-500/50` for accessible focus states
- Borders: `border-slate-600` or `border-slate-500/50` on dark backgrounds
- Cards: `bg-slate-600/50` or `bg-slate-700` with subtle borders
- Buttons: Muted teal fill or outline; avoid pure white buttons

---

## Ratios Table Alignment

The Ratios table (Ratio, Yours, Ideal, Range) must display all columns fully and legibly. Truncation of the Ideal or Range columns is a design failure.

**Requirements:**

- **Column visibility**: All four columns (Ratio, Yours, Ideal, Range) must be fully visible. No truncation of headers or cell content.
- **Table layout**: Use `table-layout: fixed` with explicit column widths via `<colgroup>` so the Ideal and Range columns receive adequate space (e.g. ~20% each). The Ratio column may use ~42%, Yours ~18%.
- **Minimum width**: Apply a minimum table width (e.g. `min-w-[360px]`) so columns do not collapse when the layout is constrained.
- **Overflow**: Use `overflow-x-auto` on the table wrapper so that when the container is narrower than the table’s minimum width, the table scrolls horizontally instead of truncating.
- **Numeric columns**: Use `whitespace-nowrap` on Yours, Ideal, and Range cells to prevent wrapping and preserve alignment.
