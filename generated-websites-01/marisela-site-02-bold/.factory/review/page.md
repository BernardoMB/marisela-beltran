# marisela-site-02-bold — text rendering for review

A one-page website for the singer Marisela (design: test). This file lists everything the page shows,
section by section in page order: headings, body text, button and link labels, list items and images (file path + alt text).
Lines tagged (content …) come from lib/content.ts — artist information fetched from public sources; untagged lines are page copy
from lib/ui-spec.json. Short interface labels such as "Leer más" or "Boletos" come from lib/i18n.ts and are not listed.

## Page metadata

- title: Marisela — La Dama de Hierro — Desde 1984
- description: Marisela Esqueda, conocida simplemente como Marisela; es una cantante, actriz y empresaria mexicoestadounidense. También es conocida como "La dama de hierro".

## NavBar

- brand: Marisela
- links:
  1. "Discografía" → #discografia
  2. "Canciones" → #canciones
  3. "Gira" → #gira
  4. "Biografía" → #biografia
  5. "Videos" → #videos
  6. "Prensa" → #prensa
- cta: "¡Dale play!" → https://open.spotify.com/artist/73c2MjCAFNyKYIs7nBlqG2
- socials (content /socialLinks):
  1. "Spotify" → https://open.spotify.com/artist/73c2MjCAFNyKYIs7nBlqG2
  2. "Apple Music" → https://music.apple.com/mx/artist/marisela/295749
  3. "Deezer" → https://www.deezer.com/artist/8856
  4. "Instagram" → https://www.instagram.com/mariselaofficial/
  5. "Facebook" → https://www.facebook.com/MariselaLaCantante/
  6. "X" → https://twitter.com/tudama_marisela
  7. "Web" → https://www.marisela.com.mx

## Hero (#inicio)

- image (content /images/hero): [image /images/gallery/01-marisela-07.jpg] alt="“Marisela, renowned Mexican-American singer, celebrated worldwide as La Dama de Hierro.”" credit="STARZBYM"
- stats (content /stats/items):
  1. "Álbumes de estudio" · value: 6
  2. "Años de trayectoria" · value: 42 · detail: Desde 1984
  3. "Oyentes mensuales en Spotify" · value: 5.8M
  4. "Temas de «Sin él» en el top 10 de Billboard" · value: Todos
  5. "Seguidores en Deezer" · value: 172.5 k
- title: Marisela
- eyebrow: La Dama de Hierro
- subtitle: Marisela Esqueda, conocida simplemente como Marisela; es una cantante, actriz y empresaria mexicoestadounidense. También es conocida como "La dama de hierro".
- tagline: La Dama de Hierro — Desde 1984
- primaryCta: "¡Escúchala ya!" → #canciones
- secondaryCta: "Boletos" → #gira

## SectionDivider

- label: La Dama de Hierro

## TopSongs (#canciones)

- songs (content /topSongs):
  1. "Tu dama de hierro" · album: Quedate A Mi Lado · streams: 310.8 M
  2. "La Pareja Ideal" · album: Me Gusta Estar Contigo · streams: 314.2 M
  3. "Sin él" · album: Fue Tan Poco Tu Cariño · streams: 241.9 M
  4. "Sola Con Mi Soledad" · album: Siénteme Ámame Quiéreme · streams: 208 M
  5. "Enamorada y Herida" · album: Siénteme Ámame Quiéreme · streams: 142.8 M
  6. "No Puedo Olvidarlo" · album: Quedate A Mi Lado
  7. "Completamente tuya" · album: Quedate A Mi Lado
  8. "Mi Problema" · album: Amor de Los Dos
  9. "A Cambio de Que" · album: Quedate A Mi Lado
  10. "Y Voy a Ser Feliz" · album: Las Numero 1 De Marisela
  11. "Dios Bendiga Nuestro Amor" · album: Quedate A Mi Lado
  12. "Y Te Voy A Olvidar" · album: La otra · year: 2002
- title: ¡Los éxitos!
- eyebrow: Top canciones
- intro: Las que todo México canta de memoria.

## TourDates (#gira)

- events (content /tourDates): (none — the section shows its empty state)
- ticketsUrl (content /tour/ticketsUrl): https://www.ticketmaster.com.mx/search?q=marisela
- title: ¡En vivo!
- eyebrow: La gira
- emptyTitle: ¡Muy pronto en tu ciudad!
- emptyMessage: Las nuevas fechas están por anunciarse. Únete a la familia para no perderte nada.
- ctaLabel: Boletos

## SectionDivider

- label: La Dama de Hierro

## VideoGallery (#videos)

- videos (content /videos):
  1. "A cambio de que - Marisela - Auditorio Nacional"
  2. "La Pareja Ideal - Marisela - Tercia de Damas"
  3. "Marisela - Enamorada y Herida - Grandes de los 80s - Auditorio Nacional"
  4. "SG Producciones presenta: Marisela regresa al Auditorio Nacional (Oficial)"
  5. "Amor de los Dos - Marisela, Coque Muñiz y Marilyn Odessa"
  6. "Historia de un Amor - Marisela y Coque Muñiz"
- title: Mírala
- eyebrow: Videos

## Discography (#discografia)

- albums (content /discography):
  1. "Sin él" · year: 1984 · releaseDate: 1984-03-30 · [image /images/covers/album-sin-el-1984.jpg] alt="Portada del álbum «Sin él» (1984)" credit="Portadas de álbumes © sus respectivos titulares." · trackCount: 10
  2. "Completamente tuya" · year: 1985 · releaseDate: 1985 · [image /images/covers/album-completamente-tuya-1985.jpg] alt="Portada del álbum «Completamente tuya» (1985)" credit="Portadas de álbumes © sus respectivos titulares." · trackCount: 10
  3. "15 éxitos, vol. 1" · year: 1989 · releaseDate: 1989 · [image /images/placeholders/cover-album-15-exitos-vol-1-1989.svg] alt="15 éxitos, vol. 1"
  4. "Marisela" · year: 1989 · releaseDate: 1989 · [image /images/covers/album-marisela-1989.jpg] alt="Portada del álbum «Marisela» (1989)" credit="Portadas de álbumes © sus respectivos titulares." · trackCount: 10
  5. "20 éxitos inmortales" · year: 1993 · releaseDate: 1993 · [image /images/covers/album-20-exitos-inmortales-1993.jpg] alt="Portada del álbum «20 éxitos inmortales» (1993)" credit="Portadas de álbumes © sus respectivos titulares." · trackCount: 20
  6. "Borrón y cuenta nueva" · year: 1996 · releaseDate: 1996 · [image /images/covers/album-borron-y-cuenta-nueva-1996.jpg] alt="Portada del álbum «Borrón y cuenta nueva» (1996)" credit="Portadas de álbumes © sus respectivos titulares." · trackCount: 10
  7. "Tu dama de hierro" · year: 1999 · releaseDate: 1999-04-27 · [image /images/covers/album-tu-dama-de-hierro-1999.jpg] alt="Portada del álbum «Tu dama de hierro» (1999)" credit="Portadas de álbumes © sus respectivos titulares." · trackCount: 17
  8. "Éxitos con banda" · year: 2002 · releaseDate: 2002-03-19 · [image /images/covers/album-exitos-con-banda-2002.jpg] alt="Portada del álbum «Éxitos con banda» (2002)" credit="Portadas de álbumes © sus respectivos titulares."
  9. "La otra" · year: 2002 · releaseDate: 2002 · [image /images/covers/album-la-otra-2002.jpg] alt="Portada del álbum «La otra» (2002)" credit="Portadas de álbumes © sus respectivos titulares." · trackCount: 13
  10. "Ellas cantan así" · year: 2003 · releaseDate: 2003 · [image /images/covers/album-ellas-cantan-asi-2003.jpg] alt="Portada del álbum «Ellas cantan así» (2003)" credit="Portadas de álbumes © sus respectivos titulares." · trackCount: 21
  11. "20 éxitos inmortales, volumen 1" · year: 2009 · releaseDate: 2009 · [image /images/placeholders/cover-album-20-exitos-inmortales-volumen-1-2009.svg] alt="20 éxitos inmortales, volumen 1"
  12. "El marco de mis recuerdos" · year: 2012 · releaseDate: 2012-04-12 · [image /images/covers/album-el-marco-de-mis-recuerdos-2012.jpg] alt="Portada del álbum «El marco de mis recuerdos» (2012)" credit="Portadas de álbumes © sus respectivos titulares." · trackCount: 11
  13. "20 kilates" · year: 2014 · releaseDate: 2014 · [image /images/placeholders/cover-album-20-kilates-2014.svg] alt="20 kilates"
  14. "Sólo hits (20 éxitos)" · year: 2017 · releaseDate: 2017 · [image /images/placeholders/cover-album-solo-hits-20-exitos-2017.svg] alt="Sólo hits (20 éxitos)"
  15. "15 grandes éxitos" · year: 2019 · releaseDate: 2019-11-15 · [image /images/covers/album-15-grandes-exitos-2019.jpg] alt="Portada del álbum «15 grandes éxitos» (2019)" credit="Portadas de álbumes © sus respectivos titulares." · trackCount: 15
  16. "20 éxitos inmortales, volumen 2" · [image /images/placeholders/cover-album-20-exitos-inmortales-volumen-2.svg] alt="20 éxitos inmortales, volumen 2"
- title: La discografía
- eyebrow: Álbumes
- intro: Décadas de clásicos, uno tras otro.

## PressQuotes (#prensa)

- quotes (content /pressQuotes):
  1. quote: Con una voz única y auténtica ha logrado permanecer en el gusto del público a través de los años, siendo sin duda alguna una consentida de la euforia popular a través de varias generaciones. · outlet: Sitio oficial — Biografía · url: http://marisela.com.mx/biografia
  2. quote: Todos temas que siguen vigentes y de los que incluso algunos artistas hoy en día siguen sacando versiones de estos temas que conociera el mundo en la voz inconfundible de la eterna “Dama de Hierro”. · outlet: Sitio oficial — Biografía · url: http://marisela.com.mx/biografia
  3. quote: Es la única cantante en español en colocar todos los temas de un disco en el top 10 de la revista Billboard, en este caso el álbum debut de Marisela Sin él (1984). · outlet: Wikipedia (es) · url: https://es.wikipedia.org/wiki/Marisela_(cantante)
  4. quote: Her debut album, Sin Él, entered at No. 16 on the first Billboard Latin Albums Chart. · outlet: Wikipedia (en) · url: https://en.wikipedia.org/wiki/Marisela
  5. quote: En el año 2010 fue nominada en tres categorías a los Premios Billboard de la Música Latina, siendo ganadora de dos de ellos por su disco recopilación 20 éxitos inmortales.​ En 2011, regresa a la música con El marco de mis recuerdos. · outlet: Wikipedia (es) · url: https://es.wikipedia.org/wiki/Marisela_(cantante)
  6. quote: Her debut album, Sin Él (1984), was produced by Marco Antonio Solís and included the title track as its lead single. · outlet: Wikipedia (en) · url: https://en.wikipedia.org/wiki/Marisela
- title: Lo que dicen
- eyebrow: Prensa

## SectionDivider

- label: La Dama de Hierro

## Biography (#biografia)

- paragraphs (content /biography/paragraphs):
  1. Marisela, la única e indiscutible Dama de Hierro, nace en 1966, en Estados Unidos, sin embargo, Marisela la cantante nace y se hace en México, país que le dio la fama desde que llego por primera vez en 1984. Con una voz única y auténtica ha logrado permanecer en el gusto del público a través de los años, siendo sin duda alguna una consentida de la euforia popular a través de varias generaciones.
  2. Su primera producción de la mano de Marco Antonio Solís, "El Buki", quien le graba el disco "Sin él" la hizo debutar en el programa de Siempre en Domingo, de la mano de su padrino, Raúl Velasco. De este trabajo se desprenden diez sencillos que se colocaron todos sin excepción en el primer lugar de popularidad no sólo en México sino en todo Hispanoamérica. Esto se vuelve un record que aun a la fecha es prácticamente imposible de igualar.
  3. Algunos de los temas que la gente aún no olvida son: “Ya no te vayas”, “El Chico Aquel” “Si no te hubieras ido”, el emblemático tema que dio nombre al disco y es un himno de la música en español, “Sin él”, y el dueto mas importante de la década, “La Pareja Ideal” en donde unieron sus voces, Marisela y su entonces novio y compositor del disco, “El Buki”.
  4. Después del gran éxito abrumador, vinieron producciones igual de exitosas o incluso más superándose a si misma, con temas como: “Enamorada y Herida”: “Sola con mi soledad”, “Completamente tuya” y “Mi Problema”. Todos temas que siguen vigentes y de los que incluso algunos artistas hoy en día siguen sacando versiones de estos temas que conociera el mundo en la voz inconfundible de la eterna “Dama de Hierro”.
  5. A través de la toda la década de los 80´s siguió sacando producciones que incluían temas de oro, siempre con gran éxito entre los que destacan: “Porque tengo ganas”, “Quisiera detener el tiempo”, “¿A cambio de qué?”, o incluso un nombre que marcaría para siempre su carrera musical “Tu Dama de Hierro”. De prácticamente todos los temas, la discográfica lanzó versiones incluso con banda que resultaron igual de exitosas, a pesar de ser la misma voz con diferentes arreglos musicales.
  6. En su vida personal, se casa con el gran trompetista Juan Manuel Hernández con quien procrea su única hija, Marilyn Odessa, que hereda el talento y lleva también hoy en día varios años en la música, logrando conquistar muchísimos corazones sobre todo en la música regional mexicana. Ambas en 2019 graban por fin un tema de navidad juntas.
- facts (content /biography/facts):
  1. "Nombre artístico" · value: Marisela
  2. "Nombre de nacimiento" · value: Marisela Esqueda Hernández
  3. "Nacimiento" · value: 24 de abril de 1966
  4. "Lugar de nacimiento" · value: Los Angeles
  5. "Debut" · value: Sin él (1984)
  6. "Apodo" · value: La Dama de Hierro
  7. "Años de actividad" · value: 1984–presente
- image (content /images/portrait): [image /images/gallery/01-marisela-07.jpg] alt="“Marisela, renowned Mexican-American singer, celebrated worldwide as La Dama de Hierro.”" credit="STARZBYM"
- sourceNote (content /biography/sourceNote): Texto basado en el sitio oficial y Wikipedia (es) (Wikipedia: CC BY-SA 4.0).
- title: La historia
- eyebrow: Biografía
- lead: Marisela Esqueda, conocida simplemente como Marisela; es una cantante, actriz y empresaria mexicoestadounidense. También es conocida como "La dama de hierro".

## FeatureSection — merch (#tienda)

- title: Tienda
- eyebrow: Extra
- body: Artículos oficiales y novedades, directamente desde los canales de la artista.
- items: (none — the section shows its empty state)
- cta: "Ver más" → https://www.marisela.com.mx

## Newsletter (#boletin)

- title: Únete a la familia
- eyebrow: Boletín
- body: Primero tú: fechas, lanzamientos y sorpresas.
- placeholder: tu correo
- buttonLabel: ¡Me apunto!
- successMessage: ¡Listo! Ya eres parte de la familia.
- errorMessage: Ese correo no se ve bien. ¿Lo revisas?
- privacyNote: Cero spam. Palabra.

## SocialLinks (#redes)

- links (content /socialLinks):
  1. "Spotify" → https://open.spotify.com/artist/73c2MjCAFNyKYIs7nBlqG2
  2. "Apple Music" → https://music.apple.com/mx/artist/marisela/295749
  3. "Deezer" → https://www.deezer.com/artist/8856
  4. "Instagram" → https://www.instagram.com/mariselaofficial/
  5. "Facebook" → https://www.facebook.com/MariselaLaCantante/
  6. "X" → https://twitter.com/tudama_marisela
  7. "Web" → https://www.marisela.com.mx
- title: Síguela
- eyebrow: Redes

## Footer

- brand: Marisela
- tagline: La Dama de Hierro — Desde 1984
- links:
  1. "Discografía" → #discografia
  2. "Canciones" → #canciones
  3. "Gira" → #gira
  4. "Biografía" → #biografia
  5. "Videos" → #videos
  6. "Prensa" → #prensa
- socials (content /socialLinks):
  1. "Spotify" → https://open.spotify.com/artist/73c2MjCAFNyKYIs7nBlqG2
  2. "Apple Music" → https://music.apple.com/mx/artist/marisela/295749
  3. "Deezer" → https://www.deezer.com/artist/8856
  4. "Instagram" → https://www.instagram.com/mariselaofficial/
  5. "Facebook" → https://www.facebook.com/MariselaLaCantante/
  6. "X" → https://twitter.com/tudama_marisela
  7. "Web" → https://www.marisela.com.mx
- sources (content /credits/sources):
  1. "Wikidata" → https://www.wikidata.org/wiki/Q2890550
  2. "Wikipedia (es)" → https://es.wikipedia.org/wiki/Marisela_(cantante)
  3. "Wikipedia (en)" → https://en.wikipedia.org/wiki/Marisela
  4. "MusicBrainz" → https://musicbrainz.org/artist/bf319713-88a0-4a06-ab6f-2ead83e923bb
  5. "Deezer" → https://www.deezer.com/artist/8856
  6. "Apple Music / iTunes" → https://music.apple.com/mx/artist/marisela/295749
  7. "Sitio oficial" → https://www.marisela.com.mx
  8. "Sitio oficial — Biografía" → http://marisela.com.mx/biografia
  9. "YouTube" → https://www.youtube.com
  10. "Wikimedia Commons" → https://commons.wikimedia.org
  11. "Spotify" → https://open.spotify.com/artist/73c2MjCAFNyKYIs7nBlqG2
- copyright: © 2026 Marisela
- credits:
  1. Texto basado en el sitio oficial y Wikipedia (es) (Wikipedia: CC BY-SA 4.0).
  2. Foto: STARZBYM (CC0), Wikimedia Commons
  3. Portadas de álbumes © sus respectivos titulares.

## Image index

Every image file and where it appears on the page:

- /images/gallery/01-marisela-07.jpg — 2× (Hero image; Biography image)
- /images/covers/album-sin-el-1984.jpg — 1× (Discography albums[1] cover)
- /images/covers/album-completamente-tuya-1985.jpg — 1× (Discography albums[2] cover)
- /images/placeholders/cover-album-15-exitos-vol-1-1989.svg — 1× (Discography albums[3] cover)
- /images/covers/album-marisela-1989.jpg — 1× (Discography albums[4] cover)
- /images/covers/album-20-exitos-inmortales-1993.jpg — 1× (Discography albums[5] cover)
- /images/covers/album-borron-y-cuenta-nueva-1996.jpg — 1× (Discography albums[6] cover)
- /images/covers/album-tu-dama-de-hierro-1999.jpg — 1× (Discography albums[7] cover)
- /images/covers/album-exitos-con-banda-2002.jpg — 1× (Discography albums[8] cover)
- /images/covers/album-la-otra-2002.jpg — 1× (Discography albums[9] cover)
- /images/covers/album-ellas-cantan-asi-2003.jpg — 1× (Discography albums[10] cover)
- /images/placeholders/cover-album-20-exitos-inmortales-volumen-1-2009.svg — 1× (Discography albums[11] cover)
- /images/covers/album-el-marco-de-mis-recuerdos-2012.jpg — 1× (Discography albums[12] cover)
- /images/placeholders/cover-album-20-kilates-2014.svg — 1× (Discography albums[13] cover)
- /images/placeholders/cover-album-solo-hits-20-exitos-2017.svg — 1× (Discography albums[14] cover)
- /images/covers/album-15-grandes-exitos-2019.jpg — 1× (Discography albums[15] cover)
- /images/placeholders/cover-album-20-exitos-inmortales-volumen-2.svg — 1× (Discography albums[16] cover)
