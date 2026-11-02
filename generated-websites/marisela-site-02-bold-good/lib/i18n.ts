import { artistContent } from "@/lib/content";
import type { AlbumType, TourEvent } from "@/lib/types";

/**
 * UI micro-labels (buttons, aria-labels, status chips). Section titles and CTA copy come from
 * the json-render spec as props — this dictionary only covers small, generic interface strings.
 */
const dict = {
  es: {
    tickets: "Boletos",
    soldOut: "Agotado",
    onSale: "A la venta",
    announced: "Anunciado",
    moreInfo: "Más información",
    listen: "Escuchar",
    listenOn: "Escuchar en",
    watch: "Ver video",
    watchOnYoutube: "Ver en YouTube",
    play: "Reproducir",
    pause: "Pausar",
    playPreview: "Escuchar fragmento",
    stopPreview: "Detener fragmento",
    readMore: "Leer más",
    readLess: "Leer menos",
    openMenu: "Abrir menú",
    closeMenu: "Cerrar menú",
    close: "Cerrar",
    previous: "Anterior",
    next: "Siguiente",
    viewAll: "Ver todo",
    backToTop: "Volver arriba",
    skipToContent: "Saltar al contenido",
    scrollDown: "Desliza",
    emailLabel: "Correo electrónico",
    sending: "Enviando…",
    followOn: "Síguela en",
    sources: "Fuentes",
    photoCredit: "Foto",
    tracks: "canciones",
    streams: "reproducciones",
    rank: "Puesto",
    released: "Lanzamiento",
    duration: "Duración",
    date: "Fecha",
    venue: "Recinto",
    city: "Ciudad",
    nextShow: "Próxima fecha",
    latestRelease: "Último lanzamiento",
    debut: "Debut",
    bookingInquiry: "Escribir a contrataciones",
    call: "Llamar",
    officialSite: "Sitio oficial",
    visitOfficialSite: "Visitar el sitio oficial",
    allRightsReserved: "Todos los derechos reservados.",
    contentFromSources: "Contenido obtenido de fuentes públicas.",
    opensInNewTab: "(se abre en una pestaña nueva)",
    days: "días",
    hours: "horas",
    minutes: "min",
    seconds: "seg",
    emptyVideos: "Muy pronto, nuevos videos.",
    emptyPhotos: "Galería en preparación.",
    emptyQuotes: "Próximamente, reseñas y crónicas.",
    emptySongs: "Muy pronto, sus canciones aquí.",
    emptyAlbums: "Discografía en preparación.",
    album: "Álbum",
    live: "En vivo",
    compilation: "Recopilación",
    single: "Sencillo",
    ep: "EP",
  },
  en: {
    tickets: "Tickets",
    soldOut: "Sold out",
    onSale: "On sale",
    announced: "Announced",
    moreInfo: "More info",
    listen: "Listen",
    listenOn: "Listen on",
    watch: "Watch video",
    watchOnYoutube: "Watch on YouTube",
    play: "Play",
    pause: "Pause",
    playPreview: "Play preview",
    stopPreview: "Stop preview",
    readMore: "Read more",
    readLess: "Read less",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    close: "Close",
    previous: "Previous",
    next: "Next",
    viewAll: "View all",
    backToTop: "Back to top",
    skipToContent: "Skip to content",
    scrollDown: "Scroll",
    emailLabel: "Email address",
    sending: "Sending…",
    followOn: "Follow on",
    sources: "Sources",
    photoCredit: "Photo",
    tracks: "tracks",
    streams: "streams",
    rank: "Rank",
    released: "Released",
    duration: "Duration",
    date: "Date",
    venue: "Venue",
    city: "City",
    nextShow: "Next show",
    latestRelease: "Latest release",
    debut: "Debut",
    bookingInquiry: "Booking inquiry",
    call: "Call",
    officialSite: "Official site",
    visitOfficialSite: "Visit the official site",
    allRightsReserved: "All rights reserved.",
    contentFromSources: "Content gathered from public sources.",
    opensInNewTab: "(opens in a new tab)",
    days: "days",
    hours: "hours",
    minutes: "min",
    seconds: "sec",
    emptyVideos: "New videos coming soon.",
    emptyPhotos: "Gallery in preparation.",
    emptyQuotes: "Reviews coming soon.",
    emptySongs: "Her songs will be here soon.",
    emptyAlbums: "Discography in preparation.",
    album: "Album",
    live: "Live",
    compilation: "Compilation",
    single: "Single",
    ep: "EP",
  },
} as const;

export type I18nKey = keyof (typeof dict)["es"];

export const LANG: "es" | "en" = artistContent.lang === "en" ? "en" : "es";
export const LOCALE: string = artistContent.locale || (LANG === "es" ? "es-MX" : "en-US");

/** Translate a UI micro-label into the site language. */
export function t(key: I18nKey): string {
  return dict[LANG][key] ?? dict.es[key];
}

export function albumTypeLabel(type: AlbumType): string {
  return t(type);
}

export function eventStatusLabel(status: TourEvent["status"]): string {
  switch (status) {
    case "sold-out":
      return t("soldOut");
    case "on-sale":
      return t("onSale");
    case "announced":
      return t("announced");
    default:
      return t("moreInfo");
  }
}
