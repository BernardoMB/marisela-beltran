# Design Brief: Bold & Colorful

You are generating a website for Mexican singer Marisela Beltrán, "La Dama de Hierro."
Use the artist name exactly as provided in the content state (`/name`); never invent or alter names, dates, numbers or facts.

## Visual Direction
- A stadium at night: a near-black, hue-tinted canvas lit by huge saturated gradient fields and blurred color blobs.
- Type is the main graphic element: condensed, UPPERCASE, enormous, overlapping images and section edges.
- Layers overlap on purpose — cards with negative margins, photos tilted over headlines, rotated sticker badges.
- Energy over restraint: every scroll should feel like the drop of a chorus.

## Typography
- Display: **Anton** (condensed), uppercase, line-height 0.85–0.9, sizes up to ~12rem on desktop. Gradient-filled for the key headline of each section.
- Body: **Archivo** 400–800; labels in Archivo 800 uppercase with wide tracking.
- Short, exclamatory headings in Mexican Spanish ("¡Los éxitos!", "¡En vivo!") — respectful, never vulgar.

## Color Palette
- Strategy `vibrant`: the inspiration site's base hue becomes the saturated primary (~95% saturation); the secondary is rotated ~150° (or the inspiration's own second hue) and the accent ~60°.
- Background = the base hue at ~7% lightness; text near-white; glow shadows tinted with the primary.
- The three colors form the brand gradient (from → via → to) used for text fills, borders, blobs and buttons.

## Layout Rules
- Full-bleed sections, generous but punchy spacing; content in a wide 1440px container.
- Big pill buttons; rounded 28px cards; nothing is boxed in thin borders.
- Insert marquee bands (SectionDivider "marquee") between high-energy sections: an infinite scrolling uppercase line in the accent color.
- Mobile keeps the drama: headlines still fill the width; overlapping is reduced but not removed.

## Component Styling
- **Hero** — variants `stacked` (default: the name broken across lines in gradient Anton, a tilted rounded photo overlapping the letters, stat stickers) and `poster` (a gradient poster panel with the photo as a tilted tile).
- **Discography** — layouts `carousel` (default: a horizontal scroll-snap strip of large tilted covers that straighten on hover) and `bento` grid (`grid`: the debut/highlight album large, the rest around it).
- **Tour Dates** — bold ticket stubs with perforated edges, date in huge Anton, gradient "tickets" pill. Empty state: a giant gradient "coming soon" line and a pill CTA.
- **Biography** — a gradient-bordered card with the lead set huge in Anton, text in two columns, facts as colorful pills.
- **Top Songs** — big numbered cards (numbers in gradient Anton) with round gradient play buttons for previews.
- **Press Quotes** — oversized quotes on slightly rotated colored cards.
- **Newsletter** — a full-width gradient panel with an Anton headline and pill input + pill button.

## Animation Style
- Preset `punchy-spring`: 0.6s, overshoot ease (0.34, 1.56, 0.64, 1), 60px travel; staggered pops.
- Hover: scale 1.04 and slight rotation; marquee loops; slow drifting gradient blobs.
- Respect `prefers-reduced-motion`: no loops, no movement, final state only.

## Do NOT
- Do not use thin weights, serif fonts, hairline rules or muted pastel palettes.
- Do not center everything — break the grid with overlaps and rotations.
- Do not put body text on top of busy gradients without a solid backing.
- Do not invent facts, dates, sales figures or quotes — bind data from the content state.
