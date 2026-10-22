# marisela-site-05-brutalist — text rendering for review

A one-page website for the singer Marisela Beltrán (design: Brutalist). This file lists everything the page shows,
section by section in page order: headings, body text, button and link labels, list items and images (file path + alt text).
Lines tagged (content …) come from lib/content.ts — artist information fetched from public sources; untagged lines are page copy
from lib/ui-spec.json. Short interface labels such as "Leer más" or "Boletos" come from lib/i18n.ts and are not listed.

## Page metadata

- title: Marisela Beltrán — Ganadora de Todos Quieren Fama
- description: Marisela Beltrán es una joven cantante mazatleca que comienza a ver los resultados de su esfuerzo y dedicación para ganarse un lugar en la música.

## NavBar

- brand: Marisela Beltrán
- links:
  1. "INICIO" → #inicio
  2. "BIO" → #biografia
  3. "DISCOS" → #discografia
  4. "CANCIONES" → #canciones
  5. "GIRA" → #gira
  6. "CONTACTO" → #contacto
- socials (content /socialLinks):
  1. "Instagram" → https://www.instagram.com/mariselabeltranmusica/

## Hero (#inicio)

- title: Marisela Beltrán
- subtitle (content /tagline): Ganadora de Todos Quieren Fama
- tagline: ARCHIVO DEL SISTEMA / ARTISTA.DAT
- stats (content /stats/items): (none — the section shows its empty state)
- primaryCta: "[ESCUCHAR]" → #canciones
- secondaryCta: "[BIOGRAFÍA]" → #biografia

## SectionDivider

- label: MARISELA BELTRÁN

## Biography (#biografia)

- title: BIOGRAFÍA
- eyebrow: BIO.TXT
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

## SectionDivider

- label: DISCOGRAFÍA

## Discography (#discografia)

- title: DISCOGRAFÍA
- eyebrow: DISCOS.LST
- intro: Catálogo de grabaciones y producciones.
- albums (content /discography): (none — the section shows its empty state)

## TopSongs (#canciones)

- title: CANCIONES DESTACADAS
- eyebrow: TRACKS.DAT
- songs (content /topSongs): (none — the section shows its empty state)

## TourDates (#gira)

- title: FECHAS DE GIRA
- eyebrow: FECHAS.TXT
- intro: Próximas presentaciones en vivo.
- events (content /tourDates): (none — the section shows its empty state)
- emptyTitle: NO HAY FECHAS PROGRAMADAS
- emptyMessage: Actualmente no hay presentaciones confirmadas. Regresa pronto para actualizaciones o suscríbete al boletín para recibir notificaciones.
- ctaLabel: [SUSCRIBIR AL BOLETÍN]

## SectionDivider

- label: MULTIMEDIA

## VideoGallery (#videos)

- title: VIDEOS
- eyebrow: VIDEO.DIR
- intro: Videoclips oficiales y material audiovisual.
- videos (content /videos): (none — the section shows its empty state)

## PressQuotes (#prensa)

- title: CITAS DE PRENSA
- eyebrow: CITAS.MD
- quotes (content /pressQuotes):
  1. quote: Y adelantó que en cuanto reciba el premio en efectivo tendrán noticias de proyectos nuevos en su carrera. · outlet: Noroeste — Marisela Beltrán, la sinaloense que comienza a triunfar en la música · url: https://www.noroeste.com.mx/entretenimiento/espectaculos/marisela-beltran-la-sinaloense-que-comienza-a-triunfar-en-la-musica-IE633390

## Newsletter (#boletin)

- title: BOLETÍN
- eyebrow: SUSCRIBIR.SH
- body: Recibe actualizaciones sobre nuevos lanzamientos, presentaciones y noticias exclusivas.
- placeholder: $ email --address
- buttonLabel: [ENVIAR]
- successMessage: ✓ SUSCRIPCIÓN CONFIRMADA
- errorMessage: ✗ ERROR: INTENTA DE NUEVO
- privacyNote: Tu información se maneja con confidencialidad. No spam.

## SocialLinks (#redes)

- title: REDES SOCIALES
- eyebrow: SOCIAL.CFG
- intro: Conecta en plataformas digitales.
- links (content /socialLinks):
  1. "Instagram" → https://www.instagram.com/mariselabeltranmusica/

## ContactBooking (#contacto)

- title: CONTACTO / CONTRATACIONES
- eyebrow: CONTACT.INI
- body: Para contrataciones, entrevistas y colaboraciones.

## FeatureSection — merch (#tienda)

- title: TIENDA
- eyebrow: MERCH.LST
- body: Productos oficiales y artículos de colección.
- cta: "[VER TIENDA]" → #tienda

## Footer

- brand: Marisela Beltrán
- tagline: GANADORA DE TODOS QUIEREN FAMA
- links:
  1. "INICIO" → #inicio
  2. "BIOGRAFÍA" → #biografia
  3. "DISCOGRAFÍA" → #discografia
  4. "CONTACTO" → #contacto
- socials (content /socialLinks):
  1. "Instagram" → https://www.instagram.com/mariselabeltranmusica/
- copyright: © 2026 MARISELA BELTRÁN. TODOS LOS DERECHOS RESERVADOS.
- credits:
  1. Texto basado en Noroeste — Marisela Beltrán, la sinaloense que comienza a triunfar en la música.
- sources (content /credits/sources):
  1. "Noroeste — Marisela Beltrán, la sinaloense que comienza a triunfar en la música" → https://www.noroeste.com.mx/entretenimiento/espectaculos/marisela-beltran-la-sinaloense-que-comienza-a-triunfar-en-la-musica-IE633390

## Image index

Every image file and where it appears on the page:

