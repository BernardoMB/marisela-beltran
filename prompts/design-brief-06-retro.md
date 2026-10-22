# Design Brief: Retro / Vintage

You are generating a website for Mexican singer Marisela Beltrán, "La Dama de Hierro."
Use the artist name exactly as provided in the content state (`/name`); never invent or alter names, dates, numbers or facts.

## Visual Direction
- A 1980s Mexican LP sleeve and a Sunday-night TV variety show, rediscovered in a record shop crate.
- Warm manila paper with film grain, printed-sticker offset shadows, rounded corners, 70s stripes and sunbursts.
- Objects tell the story: vinyl records, cassette J-cards, concert tickets, polaroids with tape, newspaper clippings.
- Nostalgic but crisp — never blurry, never dirty; the grain is subtle.

## Typography
- Display: **Shrikhand** — bold italic 70s display, with a solid offset text-shadow in the primary color.
- Body: **Bitter** 400–700 (a warm slab serif), 17px, italics for captions.
- Labels and catalogue numbers: **Courier Prime** uppercase ("LADO A", "CAT. 001", "ADMIT ONE").

## Color Palette
- Strategy `warm-vintage`: a sun-faded manila background; deep brown ink; the inspiration hue is projected into the brick → terracotta → burnt-orange range for the primary; mustard as secondary; a vintage teal accent (or the inspiration's own second hue when it is far from the primary).
- The three colors stack as 70s stripes (primary / secondary / accent) on dividers, the hero and the footer.

## Layout Rules
- A 1200px container; content sits on paper cards with 2px brown borders and 4px offset shadows; corners 14px.
- Sections alternate between flat paper and striped or sunburst backgrounds.
- SectionDivider "ornament": small ✦ ornaments with labels such as "Lado A" / "Lado B".
- Mobile: objects stack; rotations are reduced; tickets become full width.

## Component Styling
- **Hero** — variants `record-sleeve` (default: a square LP sleeve holding the photo with a vinyl record sliding out and slowly spinning, the name in huge Shrikhand on a sunburst) and `sunburst` (the name centered over radial stripes).
- **Discography** — layouts `carousel` (default: a crate of records — hover slides the vinyl out of each sleeve) and `grid` (sleeves with round year stickers).
- **Tour Dates** — "ADMIT ONE" tickets with perforations and stubs; empty state: a theater marquee sign with light bulbs.
- **Biography** — "Había una vez": a paper card with a big Shrikhand initial, a taped polaroid of the artist, and a typewritten fact sheet.
- **Top Songs** — a cassette J-card: "Lado A" and "Lado B" columns with round play buttons.
- **Press Quotes** — newspaper clippings with torn edges and slight rotations.
- **Newsletter** — a fan-club membership card.
- **Social Links** — round vintage pin badges.

## Animation Style
- Preset `vinyl-wobble`: 0.7s, ease (0.45, 0, 0.55, 1), 20px travel; playful wobble on hover; the vinyl spins slowly (33⅓ rpm feel); TV-title slide-ins.
- With `prefers-reduced-motion`: no spinning, no wobble.

## Do NOT
- Do not use cold colors as the dominant tone, glassmorphism, neon glows or thin sans-serif type.
- Do not overdo the grain or rotate text blocks so much that they become hard to read.
- Do not use real brand logos as decoration.
- Do not invent facts, dates, sales figures or quotes — bind data from the content state.
