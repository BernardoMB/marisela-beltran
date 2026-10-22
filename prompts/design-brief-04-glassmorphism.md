# Design Brief: Glassmorphism

You are generating a website for Mexican singer Marisela Beltrán, "La Dama de Hierro."
Use the artist name exactly as provided in the content state (`/name`); never invent or alter names, dates, numbers or facts.

## Visual Direction
- A night sky of slow aurora light: a deep, hue-tinted background with three large blurred orbs drifting behind everything.
- All content floats on frosted glass: translucent panels with background blur, a 1px light border and an inner top highlight.
- Intimate and modern — like a concert seen through a rain-streaked window. Soft, luminous, unhurried.

## Typography
- Display: **Sora** — light (300) for large headlines, semibold for UI and numbers.
- Body: **Plus Jakarta Sans** 400–500, 16–17px, airy line height.
- Warm, short sentences in Spanish; no exclamation marks in body copy.

## Color Palette
- Strategy `aurora-glass`: the inspiration hue sets the deep background (~9% lightness); the aurora uses the inspiration hue and two companions (+55° and +120°, or the inspiration's own second hue) as `gradient-from / via / to`.
- Surfaces are translucent white (6–14%); borders white 18%; primary and accent are pastel neon versions of the companion hues with ≥ 8:1 contrast on the background.

## Layout Rules
- Everything sits in glass panels with 24px radius and generous padding; panels may overlap the orbs but never each other.
- Centered 1280px container, comfortable gaps (24–32px), no hard dividers — sections are separated by space and light.
- Mobile: panels go full width with 16px margins; blur stays (it is the identity).

## Component Styling
- **Hero** — variants `floating-card` (default: headline left, the portrait inside a floating glass card that tilts gently with the pointer, glass stat chips around it) and `centered-orb` (the name centered over a large glowing orb).
- **Discography** — layouts `grid` (default: glass cards with covers; hover lifts the card and adds a glow) and `carousel` (a snap-scrolling row of glass cards).
- **Tour Dates** — glass rows with glowing status chips; empty state: a glass card with a soft glow, the message and a pill CTA.
- **Biography** — a large glass panel: text column, facts as glass chips, the portrait in a rounded glass frame.
- **Top Songs** — a "now playing" glass playlist with pastel play buttons and a gradient progress bar.
- **Music Player** — the Spotify embed inside a glass panel with platform pills.
- **Press Quotes / Newsletter / Social** — glass cards; pill inputs and buttons; icon tiles.

## Animation Style
- Preset `floating-blur`: 0.8s, ease (0.25, 0.8, 0.25, 1), 30px travel; reveals blur in (12px → 0).
- Orbs drift slowly (20–30s loops); cards tilt subtly with the pointer; hover lifts with a soft glow.
- With `prefers-reduced-motion`: static orbs, no tilt, no blur transitions.

## Do NOT
- Do not use solid opaque cards, hard black borders, serif type or harsh contrast blocks.
- Do not stack glass on glass on glass — one level of translucency per area.
- Do not put text on glass without enough contrast; keep panels dark enough.
- Do not invent facts, dates, sales figures or quotes — bind data from the content state.
