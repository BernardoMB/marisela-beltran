# marisela-site-01-minimalist — text rendering for review

A one-page website for the singer Marisela Beltrán (design: Minimalist). This file lists everything the page shows,
section by section in page order: headings, body text, button and link labels, list items and images (file path + alt text).
Lines tagged (content …) come from lib/content.ts — artist information fetched from public sources; untagged lines are page copy
from lib/ui-spec.json. Short interface labels such as "Leer más" or "Boletos" come from lib/i18n.ts and are not listed.

## Page metadata

- title: Marisela Beltrán — Ganadora de Todos Quieren Fama
- description: Marisela Beltrán es una joven cantante mazatleca que comienza a ver los resultados de su esfuerzo y dedicación para ganarse un lugar en la música.

## NavBar

- brand: Marisela Beltrán
- links:
  1. "Biografía" → #biografia
  2. "Música" → #discografia
  3. "Gira" → #gira
  4. "Videos" → #videos
  5. "Prensa" → #prensa
  6. "Contacto" → #contacto
- cta: "Boletín" → #boletin
- socials (content /socialLinks):
  1. "Instagram" → https://www.instagram.com/mariselabeltranmusica/

## Hero (#inicio)

- title: Marisela Beltrán
- tagline (content /tagline): Ganadora de Todos Quieren Fama
- primaryCta: "Biografía" → #biografia
- secondaryCta: "Música" → #discografia
- stats (content /stats/items): (none — the section shows its empty state)

## SectionDivider


## Biography (#biografia)

- title: Biografía
- eyebrow: 01
- paragraphs (content /biography/paragraphs):
  1. Marisela Beltrán es una joven cantante mazatleca que comienza a ver los resultados de su esfuerzo y dedicación para ganarse un lugar en la música; el 27 de febrero ganó el reality show de TV Azteca, Todos quieren fama. La carrera de Marisela no es improvisada, pues tiene años de lucha constante, con el objetivo de que su voz sea escuchada por millones de personas y comienza a lograrlo.
  2. En el 2019, logró entrar a La Voz México, en la primera edición que realizó TV Azteca, logró llegar a la pantalla luego de hacer castings para tres ediciones diferentes de este reality show, pero fue hasta ese año que logró llegar a la etapa de audiciones en vivo, donde interpretando el tema Paloma negra se ganó un lugar en el equipo de Lupillo Rivera.
  3. En ese momento la suerte no estuvo de su lado, pues dejó el programa en la segunda etapa, en los Knockouts, donde su interpretación del tema Te dirán, de La Adictiva, no le fue suficiente para avanzar; sin embargo, una nueva oportunidad llegó a su vida, y la historia fue completamente diferente. En noviembre del año pasado, envió un video, en forma de casting, para participar en un nuevo reality de TV Azteca, aún sin saber los detalles. Pasó la primera edición, y no fue llamada a participar.
  4. Fue cuando iba a comenzar la segunda temporada que recibió la noticia que sería una de las participantes. Marisela obtuvo dos premios, pues este concurso tiene un formato en el que hay un ganador por semana, estos son acreedores de un premio monetario de 50 mil pesos, mientras que en la final se enfrentan los ganadores de cada semana y la ganadora, en este casi Marisela, se llevó un premio adicional de 100 mil pesos.
  5. La cantante dijo en entrevista que, este premio lo utilizará para su carrera, pues ella es una artista independiente, y no es fácil comenzar desde cero, y sin el respaldo de una disquera. “Además quiero dejar de darle dolores de cabeza a mis papás”, agregó la cantante pues son quienes le han estado ayudando durante está pandemia por coronavirus, en la cual se quedó sin trabajo.
  6. Dijo que su trabajo principal en la Ciudad de México es dar shows de imitación, donde sus caracterizaciones favoritas son Jenni Rivera y Lupita D’Alessio. Sin embargo, esta plataforma comienza a cristalizar un sueño que siempre a tenido; darse a conocer como cantante profesional. Hace aproximadamente dos años, su intención era abrirse paso en el mundo del regional mexicano, como cantante de norteño banda, pero ahora, con esta experiencia se dio cuenta que sus seguidores prefieren escucharla en otros géneros.
- facts (content /biography/facts):
  1. "Nombre artístico" · value: Marisela Beltrán
  2. "Apodo" · value: Ganadora de Todos Quieren Fama
- sourceNote (content /biography/sourceNote): Texto basado en Noroeste — Marisela Beltrán, la sinaloense que comienza a triunfar en la música.

## Discography (#discografia)

- title: Música
- eyebrow: 02
- albums (content /discography): (none — the section shows its empty state)

## TopSongs (#canciones)

- title: Canciones
- eyebrow: 03
- songs (content /topSongs): (none — the section shows its empty state)

## TourDates (#gira)

- title: Gira
- eyebrow: 04
- events (content /tourDates): (none — the section shows its empty state)
- emptyTitle: Próximamente
- emptyMessage: Nuevas fechas próximamente.
- ctaLabel: Ver fechas

## SectionDivider


## VideoGallery (#videos)

- title: Videos
- eyebrow: 07
- videos (content /videos): (none — the section shows its empty state)

## PressQuotes (#prensa)

- title: Prensa
- eyebrow: 09
- quotes (content /pressQuotes):
  1. quote: Y adelantó que en cuanto reciba el premio en efectivo tendrán noticias de proyectos nuevos en su carrera. · outlet: Noroeste — Marisela Beltrán, la sinaloense que comienza a triunfar en la música · url: https://www.noroeste.com.mx/entretenimiento/espectaculos/marisela-beltran-la-sinaloense-que-comienza-a-triunfar-en-la-musica-IE633390

## SectionDivider


## Newsletter (#boletin)

- title: Boletín
- eyebrow: 10
- body: Recibe noticias y fechas de presentaciones.
- placeholder: tu@email.com
- buttonLabel: Suscribirme →
- successMessage: Gracias por suscribirte.
- errorMessage: Por favor verifica tu email.
- privacyNote: Nunca compartimos tu información.

## SocialLinks (#redes)

- title: Redes
- eyebrow: 12
- links (content /socialLinks):
  1. "Instagram" → https://www.instagram.com/mariselabeltranmusica/

## ContactBooking (#contacto)

- title: Contacto
- eyebrow: 11
- body: Para presentaciones y colaboraciones.

## FeatureSection — merch (#tienda)

- title: Tienda
- eyebrow: 10
- body: Próximamente.

## Footer

- brand: Marisela Beltrán
- tagline (content /tagline): Ganadora de Todos Quieren Fama
- links:
  1. "Biografía" → #biografia
  2. "Música" → #discografia
  3. "Contacto" → #contacto
- socials (content /socialLinks):
  1. "Instagram" → https://www.instagram.com/mariselabeltranmusica/
- copyright: © 2026 Marisela Beltrán
- credits:
  1. Texto basado en Noroeste — Marisela Beltrán, la sinaloense que comienza a triunfar en la música.
- sources (content /credits/sources):
  1. "Noroeste — Marisela Beltrán, la sinaloense que comienza a triunfar en la música" → https://www.noroeste.com.mx/entretenimiento/espectaculos/marisela-beltran-la-sinaloense-que-comienza-a-triunfar-en-la-musica-IE633390

## Image index

Every image file and where it appears on the page:

