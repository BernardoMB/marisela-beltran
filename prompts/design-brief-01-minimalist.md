# Design Brief: Minimalist

You are generating a website for Mexican singer Marisela Beltrán, "La Dama de Hierro."
Use the artist name exactly as provided in the content state (`/name`); never invent or alter names, dates, numbers or facts.

## Visual Direction
- Swiss / International style: a strict 12-column grid, generous white space and visible 1px hairline rules that structure the page.
- The voice is a gallery catalogue, not a fan page: calm, confident, almost silent. Every section earns its place.
- Photography is shown in grayscale and regains color only on hover/focus — the music is the color.
- One accent hue (derived from the inspiration site) appears only as a dot, an underline or an active state. Never as a fill.

## Typography
- Display: **Jost** at weights 200–300, very large, tight tracking, for the artist name and section titles.
- Body: **Manrope** 300–400 at 16–18px with 1.7 line height.
- Labels: 11px uppercase with 0.3em tracking. Numbers are tabular (`tabular-nums`).
- Section titles are short (one or two words). No exclamation marks, no emojis.

## Color Palette
- Strategy `monochrome`: the inspiration site's base hue is kept only as a faint tint in the near-white background and in the single accent; saturation is capped at ~12%.
- Background ≈ #fbfbfb, ink ≈ #191715, hairlines at ~87% lightness, accent = the inspiration hue darkened to WCAG AA (used for ≤ 5% of the surface).

## Layout Rules
- Every section opens with a hairline and a numbered head: the eyebrow is the section number ("01", "02"…) in the left grid column, the title in the right three columns.
- Content aligns to the grid; asymmetry comes from empty columns, not from decoration.
- Vertical rhythm: one section-space between sections; nothing is boxed or carded.
- Mobile: single column, the numbered head stacks above the title, generous side margins (≥ 20px).

## Component Styling
- **Hero** — variants `split` (default when a photo exists: text column left, tall grayscale portrait right in a thin frame) and `centered` (the name alone, enormous and ultra-thin, centered, two underlined text CTAs). No overlays, no gradients.
- **Discography** — layouts `grid` (uniform square covers, grayscale → color on hover, tiny caption: title, then year · type) and `list` (table rows separated by hairlines: year, title, type, listen links). Show 12, then "Ver todo".
- **Tour Dates** — clean table rows: day + short month in tabular figures, venue and city, status label, underlined ticket link. Empty state: one centered sentence and one underlined link.
- **Biography** — two columns: left a facts list (definition list with hairlines) and a small grayscale portrait; right the text in a comfortable measure (≤ 65ch) with a "read more" toggle.
- **Top Songs** — a numbered list with hairlines; duration right-aligned; a small outlined circle plays the 30-second preview; a hairline progress bar under the playing row.
- **Press Quotes** — large, light quotations with the outlet in small caps; two columns on desktop.
- **Newsletter** — a single underlined input and a text button ("Suscribirme →"). No boxes.
- **Social Links / Footer** — text links with tiny icons, separated by hairlines; footer credits in 12px.

## Animation Style
- Preset `quiet-fade`: opacity + 14px rise over 0.9s with ease (0.22, 1, 0.36, 1); stagger 60ms.
- Hairlines draw from left to right. Images fade from grayscale to color on hover (500ms).
- Nothing bounces, nothing loops. Respect `prefers-reduced-motion` by rendering the final state.

## Do NOT
- Do not use gradients, shadows, rounded cards, glassmorphism or more than one accent color.
- Do not center long paragraphs or justify text.
- Do not use more than two typefaces, bold display weights, or ALL-CAPS headlines.
- Do not decorate with icons beyond tiny functional ones.
- Do not invent facts, dates, sales figures or quotes — bind data from the content state.
