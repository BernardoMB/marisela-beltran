# Facelift validation — marisela-site-01-minimalist

Mechanical QA sweep. Site language is Spanish (`html lang="es"`); findings are judged against that.
Rendered page = `app/page.tsx`; all copy originates in `lib/content.ts` and `lib/ui-spec.json`.

---

## 1. Image reuse

- **`lib/content.ts:545`, `:554`, `:563` — one photo does the work of three.**
  `/images/gallery/01-marisela-07.jpg` is assigned to `images.hero`, `images.portrait` *and*
  `images.gallery[0]`. Two of those render: the hero (`app/page.tsx:28`) and the biography portrait
  (`app/page.tsx:72`), so the identical live shot appears twice on one page.
  *Fix:* source a second photo for the biography portrait (ideally a vertical press shot), or drop the
  portrait slot from the Biography section.

- **`lib/content.ts:134` and `:212` — the same album artwork appears twice in the discography grid.**
  `album-marisela-1989.jpg` (600×600) and `album-exitos-con-banda-2002.jpg` (1000×1000) are different
  files but visually identical artwork (the "Éxitos con Banda" sleeve). Both fall inside the first 12
  tiles, so both are visible without expanding the grid.
  *Fix:* replace the 1989 "Marisela" cover with that album's real sleeve (see §2).

- **`public/images/CREDITS.md:3-4` — the same credit line is printed twice**, verbatim.
  *Fix:* delete the duplicate line.

## 2. Image placement

- **`lib/content.ts:134` — wrong artwork on "Marisela (1989)".** The file served for the 1989 album is
  the sleeve for *Éxitos con Banda*; the `sourceUrl` on the same entry confirms it
  (`.../album/marisela-exitos-con-banda/254001609`). Visitors see a 2002 compilation sleeve labelled
  "Marisela · 1989".
  *Fix:* fetch the correct 1989 artwork, or drop the cover and let the placeholder generator handle it.

- **`lib/content.ts:336` — cover art and title disagree.** The tile is labelled "15 grandes éxitos"
  while the artwork (and the source URL) reads "15 Grandes Éxitos **Vol. 1**".
  *Fix:* rename the entry to "15 grandes éxitos, vol. 1".

- **`lib/content.ts:554` — landscape live shot in a portrait frame.** `images.portrait` feeds a 3:4 box
  (`components/Biography.tsx:20`); the asset is a 1920×1280 landscape stage photo, so `object-cover`
  crops roughly 55% of the frame width away.
  *Fix:* use a portrait-orientation image for this slot.

## 3. Typos and spelling errors

All line numbers are in `lib/content.ts`; the biography paragraphs render in the "Biografía" section.

- **`:12` and `:16` — misused semicolon:** "Marisela Esqueda, conocida simplemente como Marisela**;**
  es una cantante…". This is the highest-traffic sentence on the site — hero subtitle, biography lead
  *and* `<meta name="description">`. *Fix:* change the semicolon to a comma.
- **`:18` — "desde que **llego** por primera vez"** → `llegó`.
- **`:19` — "un **record** que **aun** a la fecha"** → `récord` … `aún`.
- **`:19` — "en **todo** Hispanoamérica"** → `toda Hispanoamérica` (gender agreement).
- **`:20` — "“El Chico Aquel” “Si no te hubieras ido”"** — missing comma between the two titles.
- **`:20` — "el dueto **mas** importante"** → `más`.
- **`:21` — "superándose a **si misma**"** → `a sí misma`.
- **`:21` — "“Enamorada y Herida”**:** “Sola con mi soledad”"** — the colon should be a comma; as written
  the first title appears to introduce the rest of the list.
- **`:22` — "A través de **la toda la** década"** — duplicated article → `a través de toda la década`.
- **`:22` — "los **80´s**"** — acute accent used as an apostrophe plus an English plural →
  `los ochenta` (or `los 80`).
- **`:23` — "un tema de **navidad**"** → `Navidad`.
- **`:40`, `:56`, `:57` — "Los Angeles"** → `Los Ángeles`. Line 40 is the visible "Lugar de nacimiento"
  fact in the biography sidebar.
- **`:464` — song title "A Cambio de Que"** → `¿A cambio de qué?`. The biography (`:22`) already writes
  it correctly, so both spellings sit on the same page.
- **`:372`, `:432`, `:443`, `:465`, `:487` — album label "Quedate A Mi Lado"** → `Quédate a mi lado`.
  It appears under four separate tracks in the visible top-10 list.
- **`:408`, `:420` — "Siénteme Ámame Quiéreme"** — missing commas → `Siénteme, ámame, quiéreme`.
- **`:476` — "Las Numero 1 De Marisela"** → `Las número 1 de Marisela`.
- **`:641` — stray zero-width space (U+200B)** after "20 éxitos inmortales." in press quote 5 — a
  leftover Wikipedia footnote marker. *Fix:* strip the character.
- **`:641` — "siendo ganadora de dos de **ellos**"** — refers back to "categorías" → `ellas`.
- **`:653` / `:655`, `:684` — "5.8M" vs "172.5 k".** Two conventions for abbreviated numbers in the same
  stats block. *Fix:* pick one (`5.8 M` / `172.5 K`).
- **`:372`–`:497` — inconsistent title casing in the song list.** "Tu dama de hierro" and "Sin él"
  (sentence case) sit beside "La Pareja Ideal", "Sola Con Mi Soledad" and "Dios Bendiga Nuestro Amor"
  (English-style title case). *Fix:* normalise to Spanish sentence case throughout.
- **`:7` vs `:23` — internal contradiction.** The sidebar fact "Nombre de nacimiento" reads "Marisela
  Esqueda Hernández", while the biography two columns away says she took the name Hernández by
  marriage ("se casa con el gran trompetista Juan Manuel Hernández").
  *Fix:* verify the birth name and correct one of the two.

## 4. Repetition

- **Hero subtitle and biography lead are the identical sentence.** `app/page.tsx:33` and
  `app/page.tsx:76` both render "Marisela Esqueda, conocida simplemente como Marisela; es una cantante,
  actriz y empresaria mexicoestadounidense…". Source: `lib/content.ts:12` (`shortBio`) and `:16`
  (`biography.summary`) hold byte-identical strings.
  *Fix:* keep it in the hero and give the biography its own lead (or drop the `lead` prop).

- **Press quote 1 repeats biography paragraph 1 verbatim.** `lib/content.ts:617` ("Con una voz única y
  auténtica ha logrado permanecer en el gusto del público…") is lifted word-for-word from the paragraph
  at `:18`, which is visible by default — the reader meets the same sentence twice.
  *Fix:* replace quote 1 with a genuine third-party quote.

- **Press quote 2 repeats biography paragraph 4 verbatim** (`:623` vs `:21`, "Todos temas que siguen
  vigentes…"). Same fix. Note both quotes are credited to "Sitio oficial — Biografía" under a section
  headed "Lo que se ha dicho" — the artist's own bio presented as press.

- **Biography source note is printed twice.** `lib/content.ts:62` renders at the end of the Biografía
  section (`components/Biography.tsx:49`) and again as the first footer credit (`app/page.tsx:128`).
  *Fix:* drop it from one of the two.

## 5. Awkward phrasing

- **`lib/content.ts:19` — broken clause.** "Su primera producción de la mano de Marco Antonio Solís,
  "El Buki", quien le graba el disco "Sin él" la hizo debutar en el programa de Siempre en Domingo, de
  la mano de su padrino, Raúl Velasco." The relative clause leaves the subject stranded, "de la mano de"
  is used twice in one sentence, and the title "Sin él" runs straight into "la hizo debutar" with no
  punctuation. *Fix:* split into two sentences and drop one "de la mano de".
- **`lib/content.ts:20` — the description precedes the title it describes.** "…“Si no te hubieras ido”,
  el emblemático tema que dio nombre al disco y es un himno de la música en español, “Sin él”…" reads as
  if the gloss belongs to the previous title. *Fix:* move "Sin él" ahead of its description.
- **`lib/content.ts:21` — redundant loop.** "…siguen sacando versiones de estos temas que conociera el
  mundo…" repeats "temas" from earlier in the same sentence, and the sentence opens with the fragment
  "Todos temas que siguen vigentes". *Fix:* "Todos **son** temas que siguen vigentes y de los que algunos
  artistas siguen grabando versiones."
- **`lib/content.ts:18` — comma splice** around "sin embargo": "…nace en 1966, en Estados Unidos, sin
  embargo, Marisela la cantante nace y se hace en México…". *Fix:* semicolon before "sin embargo", and
  delete the stray comma after "1966".
- **`lib/content.ts:23` — scrambled word order.** "Ambas en 2019 graban por fin un tema de navidad
  juntas." *Fix:* "En 2019 grabaron por fin un tema navideño juntas."
- **`lib/content.ts:547`, `:556`, `:566` — alt text is quoted English on a Spanish page.** The value is
  `"“Marisela, renowned Mexican-American singer, celebrated worldwide as La Dama de Hierro.”"` — wrapped
  in curly quotation marks, in English, and it also feeds the OpenGraph image alt (`app/layout.tsx:34`).
  *Fix:* unquoted Spanish, e.g. `Marisela en concierto`.
- **`lib/content.ts:634`, `:646` — mixed-language press section.** Quotes 4 and 6 are in English
  ("Her debut album, Sin Él, entered at No. 16…") inside an otherwise Spanish section.
  *Fix:* translate them or swap in Spanish-language sources.
- **`lib/ui-spec.json:261` / `app/layout.tsx:27` — double em dash in the page title.** The title is built
  as `${name} — ${tagline}` and the tagline already contains one, producing
  "Marisela — La Dama de Hierro — Desde 1984". *Fix:* use "Marisela — La Dama de Hierro | Desde 1984" or
  shorten the tagline.
- **Alias capitalised two ways on the same screen.** The hero eyebrow and tagline say "La Dama de
  Hierro"; the hero subtitle directly beneath says "La dama de hierro" in straight quotes
  (`lib/content.ts:12`), while the biography uses curly quotes elsewhere.
  *Fix:* settle on "La Dama de Hierro" with typographic quotes everywhere.

## 6. Missing or broken obvious things

- **`README.md:13` — points at a file that does not exist.** "See `RUN.md` for details." There is no
  `RUN.md` in the project. *Fix:* create it or remove the sentence.
- **`README.md:13` — false claim.** "`node_modules/` is already installed." It is not present; the
  project will not start without `npm install`. *Fix:* correct the sentence or run the install.
- **`app/page.tsx:43`–`:118` — section numbering has visible gaps.** The eyebrow numerals run
  02, 03, 04, 05, 07, —, 09, 10, 12; 01, 06, 08 and 11 are missing (the hero carries no number).
  *Fix:* renumber the rendered sections consecutively.
- **`app/page.tsx:98` — placeholder eyebrow.** The "Tienda" section's eyebrow is the literal string
  `"—"` where every sibling has a number. *Fix:* give it its number in the renumbered sequence.
- **`app/page.tsx:94`–`:102` — the store sells nothing.** "Tienda" renders a heading, a line promising
  "Artículos oficiales y novedades" and a "Visitar" button, but `items={[]}` and the button goes to the
  artist's homepage, not a shop. *Fix:* populate the items or remove the section.
- **`components/Discography.tsx:64`–`:67` — orphaned separator.** The entry at `lib/content.ts:355`
  ("20 éxitos inmortales, volumen 2") has no `year`, so its caption renders as " · Recopilación" with a
  leading middot and nothing before it. *Fix:* add the year, or only emit the separator when a year is
  present.
- **`components/TopSongs.tsx:30` — one column, two different units.** `showStats` makes the right-hand
  column show stream counts when available and track duration otherwise, unlabelled: rows 01–05 read
  "310.8 M", "314.2 M"…, rows 06–10 read "4:01", "3:50"….
  *Fix:* show one metric for the whole list, or label both.
- **`lib/content.ts:374`–`:387` — the ranking contradicts the numbers beside it.** Track 01 ("Tu dama de
  hierro") shows 310.8 M streams; track 02 ("La Pareja Ideal") shows 314.2 M — a higher figure in a
  lower position. *Fix:* sort by the metric displayed, or hide the stream counts.
- **`lib/content.ts:372`–`:487` — the Canciones section cites albums the Discografía does not contain.**
  "Sin él" is attributed to "Fue Tan Poco Tu Cariño", "Completamente tuya" to "Quedate A Mi Lado", and
  so on; none of those six album names appear in the discography, which lists "Sin él (1984)" and
  "Completamente tuya (1985)" as the debut records. *Fix:* map tracks to the canonical album titles.
- **Two alt-text conventions for album covers.** Real covers use "Portada del álbum «Título» (año)"
  (e.g. `lib/content.ts:96`); the five placeholder covers use the bare title (e.g. `:144`, "20 kilates").
  *Fix:* apply the descriptive pattern to the placeholders too.
- **`app/page.tsx:127` — hard-coded copyright year.** `"© 2026 Marisela"` is correct today but will go
  stale silently. *Fix:* render `new Date().getFullYear()`.
- **`lib/content.ts:739`–`:740`, `:744`–`:745` — footer "Fuentes" links that lead nowhere specific.**
  "YouTube" → `https://www.youtube.com` and "Wikimedia Commons" → `https://commons.wikimedia.org` point
  at the services' homepages rather than the pages the content came from.
  *Fix:* link the artist's channel and the Commons file page, or drop both entries.
- **Insecure scheme on the official-site links.** `lib/content.ts:66`, `:619`, `:625`, `:692`, `:735` use
  `http://marisela.com.mx/…` while `:611`, `:695`, `:730` use `https://www.marisela.com.mx`.
  *Fix:* use `https://` consistently.
- **`components/NavBar.tsx:24` and `components/Footer.tsx:14` — two `<nav>` landmarks share the
  accessible name "Marisela"** (both use `aria-label={brand}`), so screen-reader users get two
  identically-named navigations. *Fix:* label them "Principal" and "Pie de página".
