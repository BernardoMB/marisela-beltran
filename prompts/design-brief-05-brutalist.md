# Design Brief: Brutalist

You are generating a website for Mexican singer Marisela Beltrán, "La Dama de Hierro."
Use the artist name exactly as provided in the content state (`/name`); never invent or alter names, dates, numbers or facts.

## Visual Direction
- Raw HTML as an aesthetic: a white document, black text, thick black borders, visible table structure.
- Everything looks like an index, a file listing or a terminal — honest, dense, fast.
- One harsh accent color used as solid blocks (highlights, active rows, call-to-action blocks), never as text on white.
- Hover inverts colors (black block, white text). Hard offset shadows instead of soft ones.

## Typography
- Display: **Space Mono** 700, uppercase, large, tight.
- Body: **IBM Plex Mono** 400–500 at 15–16px; everything monospaced.
- Labels look like file names and paths: `FECHAS.TXT`, `/DISCOS`, `BIO.TXT`; calls to action in brackets: `[ESCUCHAR]`.

## Color Palette
- Strategy `high-contrast`: pure white background, pure black text and 3px borders. The accent is the inspiration hue pushed to full saturation (fallback: safety orange `#ff3b00`), adjusted so black text on it stays ≥ 4.5:1.
- Accent is a BLOCK color only (`bg-accent text-accent-foreground`). No gradients, no blur, no tints.

## Layout Rules
- Sections are separated by 3px black rules; content sits in bordered boxes and tables.
- Dense, asymmetric box layouts; a wide 1600px container; no rounded corners anywhere.
- ASCII dividers (SectionDivider "ascii") between some sections: `=====[ LABEL ]=====` filling the width.
- Mobile: tables collapse to stacked bordered records; tap targets stay ≥ 44px.

## Component Styling
- **Hero** — variants `index` (default: giant monospace name with a blinking cursor, followed by a directory-listing table of key facts and bracketed links, the photo in a thick-bordered box with a hard shadow) and `poster` (the photo full width in a thick border with an overlapping caption box).
- **Discography** — layouts `list` (default: a dense table — No. | AÑO | TÍTULO | TIPO | LINK) and `grid` (thick-bordered cover tiles with black label bars).
- **Tour Dates** — a table; empty state: a bordered "NO DATA" box with the message and an accent CTA block.
- **Biography** — a "BIO.TXT" window with a title bar, monospaced text and `KEY: value` facts.
- **Top Songs** — a table with an inverted row for the song that is playing.
- **Press Quotes** — "CITAS.MD": markdown-style `>` quotes with `— source`.
- **Newsletter** — a terminal prompt: `$ suscribir --email` + input + `[ENVIAR]`.

## Animation Style
- Preset `hard-cut`: no easing, no travel — content appears instantly; a typing effect on the hero name and a blinking cursor; tiny jitter on hover.
- With `prefers-reduced-motion`: no cursor blink, no typing, no jitter.

## Do NOT
- Do not use rounded corners, gradients, shadows other than hard offsets, blur or serif type.
- Do not use the accent color for body text on white (contrast is too low).
- Do not add decorative illustrations or icons beyond functional ones.
- Do not invent facts, dates, sales figures or quotes — bind data from the content state.
