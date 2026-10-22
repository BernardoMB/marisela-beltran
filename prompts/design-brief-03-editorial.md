# Design Brief: Editorial

You are generating a website for Mexican singer Marisela Beltrán, "La Dama de Hierro."
Use the artist name exactly as provided in the content state (`/name`); never invent or alter names, dates, numbers or facts.

## Visual Direction
- A cultural magazine's special issue devoted to one artist: cover, profile, archive, reviews, agenda.
- Cream newsprint, warm-black ink, thin rules, captions under every image, generous margins.
- Asymmetry is editorial, not decorative: offset columns, a wide text column next to a narrow sidebar, pull quotes breaking the measure.
- Feels written and edited — headlines have voice, every section has a kicker.

## Typography
- Display: **Playfair Display**, 400–900, with italics for emphasis and nameplates; very large on the cover.
- Body: **Newsreader** 400–500 at 18–19px, 1.65 line height, hanging punctuation where possible.
- Kickers and labels in small caps with letter-spacing; captions in italic 13px.
- Drop cap on the first biography paragraph; pull quotes set in large italic Playfair.

## Color Palette
- Strategy `ink-and-paper`: a deep cream paper (hue 40°) and warm-black ink whose hue comes from the inspiration site; one saturated editorial accent (the inspiration hue at ~70% saturation, oxblood for red hues) used for kickers, drop caps, rules and links.
- No gradients, no shadows; rules are ink at reduced opacity.

## Layout Rules
- 12-column grid with offset columns (text often starts at column 2 or 4); sidebars for facts.
- Thin single rules separate sections; double rules mark chapter breaks (SectionDivider "chapter-rule").
- Images always carry a caption and credit line.
- Mobile: single column, kicker → headline → standfirst → text; pull quotes full width.

## Component Styling
- **Hero** — variants `cover` (default with a photo: full-bleed magazine cover, nameplate across the top in giant italic Playfair, cover lines bottom-left) and `feature` (an opening spread: huge headline and standfirst left, captioned photo right).
- **Discography** — layouts `timeline` (default: a vertical timeline by year with thumbnails and annotations) and `list` (a table of contents with leader dots and years).
- **Tour Dates** — "Agenda": date in italic serif, venue in small caps, city in text; empty state as a ruled editor's note.
- **Biography** — a long read: kicker, headline, italic standfirst, two columns with a drop cap and a column rule, a "Ficha" facts sidebar, a pull quote.
- **Top Songs** — "Repertorio": a two-column numbered list in serif with discreet "▶ Escuchar" preview links.
- **Press Quotes** — oversized italic pull quotes with accent quotation marks; outlet in small caps.
- **Newsletter** — a subscription coupon with a dashed border, like a magazine insert.
- **Footer** — a colophon: nameplate, section index, sources and credits in fine print.

## Animation Style
- Preset `editorial-reveal`: 1.1s, ease (0.16, 1, 0.3, 1), 24px travel; images reveal with a clip-path wipe; text fades line by line.
- Never bouncy, never looping. Respect `prefers-reduced-motion`.

## Do NOT
- Do not use sans-serif display type, gradients, glow, rounded cards or pill buttons.
- Do not place images without captions; do not center long text.
- Do not use more than one accent color.
- Do not invent facts, dates, sales figures or quotes — bind data from the content state.
