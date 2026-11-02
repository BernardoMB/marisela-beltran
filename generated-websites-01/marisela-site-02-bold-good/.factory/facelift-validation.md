# Facelift validation — marisela-site-02-bold

Mechanical QA pass on `.factory/review/page.md`. Brand/design decisions are out of scope.

## 1. Image reuse

- **`/images/gallery/01-marisela-07.jpg`** — used 2× (Hero, line 35; Biography portrait, line 154), with the *identical* alt caption copied to both placements ("Marisela, renowned Mexican-American singer, celebrated worldwide as La Dama de Hierro."). A hero banner and a biography portrait serving different narrative purposes normally get distinct images/captions; reusing one photo with one caption for both reads as a missing asset rather than a deliberate choice. Fix: source a second portrait for the Biography section, or write a distinct, placement-appropriate caption if the photo must be reused.

## 2. Image placement

None.

## 3. Typos and spelling errors

- Album title **"Quedate A Mi Lado"** (lines 56, 61, 62, 64, 66) is missing its accent — should be "Quédate a mi lado." It recurs identically across five track listings, so the error is repeated, not a one-off.
- Album title **"Las Numero 1 De Marisela"** (line 65) — "Numero" should be "Número."
- Song title **"A Cambio de Que"** (lines 64, 67) is missing the accent and question marks, and is inconsistent with the correctly written "¿A cambio de qué?" in Biography paragraph 5 (line 144). Fix: standardize to "¿A Cambio de Qué?" in the song list.
- Biography paragraph 1 (line 140): **"llego por primera vez en 1984"** → should be "llegó" (missing accent on the past-tense verb).
- Biography paragraph 2 (line 141): **"un record que aun a la fecha"** → should be "récord" and "aún" (both missing required accents).
- Biography paragraph 4 (line 144): **"superándose a si misma"** → should be "a sí misma" (reflexive pronoun needs an accent).
- PressQuotes item 5 (line 128): there is a stray invisible/zero-width character between "...20 éxitos inmortales." and "En 2011..." — a leftover artifact from copy-pasting off Wikipedia. Fix: strip non-printing characters from scraped quote text.

## 4. Repetition

- The exact sentence **"Marisela Esqueda, conocida simplemente como Marisela; es una cantante, actriz y empresaria mexicoestadounidense. También es conocida como 'La dama de hierro'."** appears verbatim three times: page meta description (line 11), Hero subtitle (line 44), and Biography lead (line 158). Having the identical sentence surface twice in on-page, user-visible copy (Hero and Biography) reads as duplicated rather than intentional. Fix: keep the meta description as-is but give the Biography `lead` distinct wording from the Hero `subtitle`.
- PressQuotes item 1 (line 124) duplicates verbatim the closing sentence of Biography paragraph 1 (line 140: "Con una voz única y auténtica ha logrado permanecer en el gusto del público a través de los años, siendo sin duda alguna una consentida de la euforia popular a través de varias generaciones."). Fix: pick a different excerpt for the press quote, or trim the overlapping sentence from the bio paragraph.
- PressQuotes item 2 (line 125) duplicates verbatim a full sentence from Biography paragraph 4 (line 143: "Todos temas que siguen vigentes y de los que incluso algunos artistas hoy en día siguen sacando versiones de estos temas que conociera el mundo en la voz inconfundible de la eterna 'Dama de Hierro'."). Same fix as above.

## 5. Awkward phrasing

- Hero/Biography image alt text (lines 35, 154) wraps an English-language caption in literal curly quotation marks inside the alt attribute itself ( `alt="“Marisela, renowned…”"` ), which is both a language mismatch (the rest of the site is Spanish) and redundantly nested quoting. Fix: translate the alt text to Spanish and drop the embedded quote marks.
- PressQuotes items 4 and 6 (lines 127, 129) are left in English ("Her debut album, Sin Él, entered at No. 16...") while items 1, 2, 3, and 5 are in Spanish — an unannounced language switch mid-section on an otherwise fully Spanish page. Fix: translate these two quotes to Spanish (or clearly mark them as an English-language source quote, consistent with site convention).
- Biography paragraph 2 (line 141) uses straight double-quotes around **"Sin él"** and **"El Buki"** while the surrounding paragraphs use curly quotes for every other title/nickname ("Ya no te vayas", "El Chico Aquel", etc.) — inconsistent quotation style within the same block of copy. Fix: normalize to curly quotes throughout.

## 6. Missing or broken obvious things

- Five discography entries (lines 103, 111, 113, 114, 116 — "15 éxitos, vol. 1", "20 éxitos inmortales, volumen 1", "20 kilates", "Sólo hits (20 éxitos)", "20 éxitos inmortales, volumen 2") use generic placeholder SVG icons instead of real cover art, and lack the credit line every other album has. These stand out against the 11 photographic covers nearby. Fix: source the real covers for these releases, or confirm the placeholders are an accepted temporary state.
- The **"Tienda"** (Store) section (lines 160–166) renders with zero items — just a title, body copy, and a single outbound "Ver más" link to the official site. As built this looks like an empty/broken shop module rather than a populated section. Fix: either populate it with real merch items or remove the section if there's no catalog to show.
