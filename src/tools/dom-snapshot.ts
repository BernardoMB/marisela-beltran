import type { Page } from "playwright";

/**
 * Structural snapshot of a rendered page, captured in the browser and analyzed offline by the
 * heuristic feature analyzer (src/agents/feature-inventory.ts).
 *
 * The in-page code is kept as a plain JavaScript string (not a compiled function): tsx/esbuild
 * injects helpers such as `__name` into compiled functions, which do not exist inside the page.
 */

export interface DomSection {
  tag: string;
  id: string;
  classes: string;
  role: string;
  top: number;
  height: number;
  width: number;
  fullWidth: boolean;
  sticky: boolean;
  heading: string;
  text: string;
  images: number;
  squareImages: number;
  links: number;
  buttons: number;
  forms: number;
  inputTypes: string[];
  iframes: string[];
  videos: number;
  hasBackgroundImage: boolean;
  listItems: number;
  gridLike: boolean;
  horizontalScroll: boolean;
}

export interface DomSnapshot {
  url: string;
  title: string;
  lang: string;
  viewport: { width: number; height: number };
  documentHeight: number;
  meta: Record<string, string>;
  landmarks: { header: boolean; nav: boolean; main: boolean; footer: boolean; aside: boolean };
  sections: DomSection[];
  headings: Array<{ level: number; text: string }>;
  forms: Array<{ action: string; inputTypes: string[]; inputNames: string[]; buttonText: string; text: string }>;
  iframes: Array<{ src: string; host: string; title: string; width: number; height: number }>;
  media: { videos: number; audios: number; embeddedPlayers: string[] };
  images: { count: number; square: number; large: number; backgrounds: number; altSamples: string[] };
  links: {
    total: number;
    internal: number;
    external: number;
    anchors: string[];
    social: Array<{ platform: string; href: string }>;
    ticketing: string[];
    store: string[];
    streaming: string[];
    mailto: string[];
    tel: string[];
    texts: string[];
  };
  buttons: string[];
  blockquotes: string[];
  classTokens: string[];
  scriptHosts: string[];
  fixedElements: number;
  dateLikeCount: number;
  countdownLike: boolean;
  languageSwitcher: boolean;
  carousels: number;
  textSample: string;
}

/** Browser-side snapshot code. Pure ES2019, no external references. */
export const DOM_SNAPSHOT_SCRIPT = String.raw`(() => {
  var vw = window.innerWidth, vh = window.innerHeight;
  var clean = function (s, n) { return (s || "").replace(/\s+/g, " ").trim().slice(0, n || 200); };
  var hostOf = function (u) { try { return new URL(u, location.href).host.replace(/^www\./, ""); } catch (e) { return ""; } };
  var SOCIAL = { "instagram.com": "instagram", "facebook.com": "facebook", "fb.com": "facebook", "tiktok.com": "tiktok",
    "twitter.com": "x", "x.com": "x", "youtube.com": "youtube", "youtu.be": "youtube", "open.spotify.com": "spotify",
    "spotify.com": "spotify", "music.apple.com": "apple-music", "deezer.com": "deezer", "soundcloud.com": "soundcloud",
    "music.amazon.com": "amazon-music", "threads.net": "threads", "snapchat.com": "snapchat", "twitch.tv": "twitch" };
  var STREAMING = ["spotify", "apple-music", "deezer", "soundcloud", "amazon-music", "youtube"];
  var TICKET = ["ticketmaster", "livenation", "axs.com", "seated", "bandsintown", "songkick", "eventbrite", "dice.fm", "etix", "boletia", "eticket", "tickets", "boletos"];
  var STORE = ["shop", "store", "merch", "tienda", "shopify", "bigcartel", "cart"];
  var platformFor = function (host) {
    for (var k in SOCIAL) { if (host === k || host.slice(-(k.length + 1)) === "." + k) return SOCIAL[k]; }
    return "";
  };
  var rectOf = function (el) { var r = el.getBoundingClientRect(); return { top: Math.round(r.top + window.scrollY), height: Math.round(r.height), width: Math.round(r.width) }; };
  var visible = function (el) { var r = el.getBoundingClientRect(); var cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; };

  var meta = {};
  Array.prototype.forEach.call(document.querySelectorAll("meta[name], meta[property]"), function (m) {
    var k = (m.getAttribute("name") || m.getAttribute("property") || "").toLowerCase();
    if (/^(description|og:title|og:site_name|og:type|og:description|theme-color|generator|twitter:site)$/.test(k)) meta[k] = clean(m.getAttribute("content"), 300);
  });

  var headings = Array.prototype.slice.call(document.querySelectorAll("h1, h2, h3, h4")).filter(visible).slice(0, 80).map(function (h) {
    return { level: Number(h.tagName.slice(1)), text: clean(h.innerText || h.textContent, 140) };
  }).filter(function (h) { return h.text; });

  var sectionEls = [];
  var seen = new Set();
  var candidates = document.querySelectorAll("header, nav, section, footer, article, aside, [role=banner], [role=region], [role=contentinfo], main > *, body > *, body > * > *");
  Array.prototype.forEach.call(candidates, function (el) {
    if (seen.has(el)) return;
    var tag = el.tagName.toLowerCase();
    if (tag === "script" || tag === "style" || tag === "noscript" || tag === "link") return;
    if (!visible(el)) return;
    var r = rectOf(el);
    if (r.height < 80 || r.width < vw * 0.4) return;
    seen.add(el);
    sectionEls.push(el);
  });
  sectionEls.sort(function (a, b) { return rectOf(a).top - rectOf(b).top; });
  var sections = sectionEls.slice(0, 70).map(function (el) {
    var r = rectOf(el);
    var cs = getComputedStyle(el);
    var imgs = el.querySelectorAll("img");
    var square = 0;
    Array.prototype.forEach.call(imgs, function (img) {
      var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
      if (w >= 80 && h >= 80 && Math.abs(w / h - 1) < 0.12) square++;
    });
    var bg = cs.backgroundImage && cs.backgroundImage.indexOf("url(") >= 0;
    if (!bg && el.firstElementChild) { var c1 = getComputedStyle(el.firstElementChild).backgroundImage; bg = !!c1 && c1.indexOf("url(") >= 0; }
    var gridLike = false;
    var kids = el.children.length;
    if (cs.display === "grid" || (cs.display === "flex" && cs.flexWrap === "wrap" && kids >= 3)) gridLike = true;
    var inner = el.querySelector("[class*=grid], ul, ol");
    if (!gridLike && inner) { var ics = getComputedStyle(inner); gridLike = ics.display === "grid" || (ics.display === "flex" && ics.flexWrap === "wrap" && inner.children.length >= 3); }
    var scroller = el.scrollWidth > el.clientWidth + 20 && /(auto|scroll)/.test(cs.overflowX);
    if (!scroller) {
      var inner2 = el.querySelector("[class*=carousel], [class*=slider], [class*=swiper], [class*=slick], [class*=splide], [class*=embla]");
      scroller = !!inner2;
    }
    var h = el.querySelector("h1, h2, h3");
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || "",
      classes: clean(typeof el.className === "string" ? el.className : "", 160),
      role: el.getAttribute("role") || "",
      top: r.top, height: r.height, width: r.width,
      fullWidth: r.width >= vw * 0.95,
      sticky: cs.position === "fixed" || cs.position === "sticky",
      heading: h ? clean(h.innerText || h.textContent, 120) : "",
      text: clean(el.innerText, 320),
      images: imgs.length,
      squareImages: square,
      links: el.querySelectorAll("a[href]").length,
      buttons: el.querySelectorAll("button, [role=button]").length,
      forms: el.querySelectorAll("form").length,
      inputTypes: Array.prototype.slice.call(el.querySelectorAll("input")).map(function (i) { return (i.getAttribute("type") || "text").toLowerCase(); }).slice(0, 12),
      iframes: Array.prototype.slice.call(el.querySelectorAll("iframe")).map(function (f) { return hostOf(f.getAttribute("src") || ""); }).filter(Boolean).slice(0, 8),
      videos: el.querySelectorAll("video").length,
      hasBackgroundImage: !!bg,
      listItems: el.querySelectorAll("li").length,
      gridLike: gridLike,
      horizontalScroll: !!scroller
    };
  });

  var forms = Array.prototype.slice.call(document.querySelectorAll("form")).slice(0, 20).map(function (f) {
    var inputs = Array.prototype.slice.call(f.querySelectorAll("input, textarea, select"));
    var btn = f.querySelector("button, input[type=submit]");
    return {
      action: f.getAttribute("action") || "",
      inputTypes: inputs.map(function (i) { return (i.getAttribute("type") || i.tagName).toLowerCase(); }).slice(0, 12),
      inputNames: inputs.map(function (i) { return (i.getAttribute("name") || i.getAttribute("placeholder") || i.getAttribute("aria-label") || "").toLowerCase(); }).slice(0, 12),
      buttonText: btn ? clean(btn.innerText || btn.value || btn.getAttribute("aria-label"), 60) : "",
      text: clean(f.innerText, 200)
    };
  });

  var iframes = Array.prototype.slice.call(document.querySelectorAll("iframe")).slice(0, 30).map(function (f) {
    var src = f.getAttribute("src") || f.getAttribute("data-src") || "";
    var r = f.getBoundingClientRect();
    return { src: src.slice(0, 300), host: hostOf(src), title: clean(f.getAttribute("title"), 80), width: Math.round(r.width), height: Math.round(r.height) };
  });
  var players = iframes.map(function (f) { return f.host; }).filter(function (h) { return /spotify|apple|soundcloud|deezer|youtube|vimeo|bandcamp|audiomack/.test(h); });

  var imgs = Array.prototype.slice.call(document.images);
  var imgSquare = 0, imgLarge = 0;
  imgs.forEach(function (img) {
    var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    if (w >= 80 && h >= 80 && Math.abs(w / h - 1) < 0.12) imgSquare++;
    var r = img.getBoundingClientRect();
    if (r.width >= vw * 0.5) imgLarge++;
  });
  var bgCount = 0;
  Array.prototype.forEach.call(document.querySelectorAll("section, div, header"), function (el, i) {
    if (i > 1500) return;
    var b = getComputedStyle(el).backgroundImage;
    if (b && b.indexOf("url(") >= 0) bgCount++;
  });

  var links = { total: 0, internal: 0, external: 0, anchors: [], social: [], ticketing: [], store: [], streaming: [], mailto: [], tel: [], texts: [] };
  var socialSeen = {};
  Array.prototype.forEach.call(document.querySelectorAll("a[href]"), function (a) {
    var href = a.getAttribute("href") || "";
    links.total++;
    var text = clean(a.innerText || a.getAttribute("aria-label") || a.title, 60);
    if (text && links.texts.length < 120) links.texts.push(text);
    if (href.indexOf("mailto:") === 0) { links.mailto.push(href.slice(0, 120)); return; }
    if (href.indexOf("tel:") === 0) { links.tel.push(href.slice(0, 60)); return; }
    if (href.charAt(0) === "#") { if (links.anchors.length < 40) links.anchors.push(href.slice(0, 60)); links.internal++; return; }
    var abs;
    try { abs = new URL(href, location.href); } catch (e) { return; }
    var host = abs.host.replace(/^www\./, "");
    if (abs.host === location.host) links.internal++; else links.external++;
    var platform = platformFor(host);
    if (platform && !socialSeen[platform + abs.pathname]) {
      socialSeen[platform + abs.pathname] = 1;
      if (links.social.length < 40) links.social.push({ platform: platform, href: abs.href.slice(0, 200) });
      if (STREAMING.indexOf(platform) >= 0 && links.streaming.length < 20) links.streaming.push(abs.href.slice(0, 200));
    }
    var low = (abs.href + " " + text).toLowerCase();
    if (TICKET.some(function (t) { return low.indexOf(t) >= 0; }) && links.ticketing.length < 30) links.ticketing.push(abs.href.slice(0, 200));
    if (STORE.some(function (t) { return low.indexOf(t) >= 0; }) && links.store.length < 30) links.store.push(abs.href.slice(0, 200));
  });

  var buttons = Array.prototype.slice.call(document.querySelectorAll("button, [role=button], input[type=submit]")).filter(visible).map(function (b) {
    return clean(b.innerText || b.value || b.getAttribute("aria-label"), 60);
  }).filter(Boolean).slice(0, 80);
  var blockquotes = Array.prototype.slice.call(document.querySelectorAll("blockquote, q, [class*=quote], [class*=testimonial]")).map(function (q) { return clean(q.innerText, 240); }).filter(Boolean).slice(0, 15);

  var counts = {};
  var all = document.querySelectorAll("[class], [id]");
  for (var i = 0; i < all.length && i < 6000; i++) {
    var el = all[i];
    var raw = ((typeof el.className === "string" ? el.className : "") + " " + (el.id || "")).toLowerCase();
    raw.split(/[\s_:\/\[\]]+/).forEach(function (t) {
      if (t.length < 3 || t.length > 40 || /\d{3,}/.test(t)) return;
      counts[t] = (counts[t] || 0) + 1;
    });
  }
  var classTokens = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 300);

  var scriptHosts = Array.from(new Set(Array.prototype.slice.call(document.querySelectorAll("script[src]")).map(function (s) { return hostOf(s.getAttribute("src")); }).filter(Boolean))).slice(0, 60);

  var fixed = 0;
  Array.prototype.forEach.call(document.querySelectorAll("header, nav, div"), function (el, i) {
    if (i > 2500) return;
    var p = getComputedStyle(el).position;
    if (p === "fixed" || p === "sticky") fixed++;
  });

  var bodyText = (document.body && document.body.innerText) || "";
  var dateRe = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|ene|abr|ago|dic)[a-z]*\.?\s+\d{1,2}\b|\b\d{1,2}\s+(de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b|\b\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}\b/gi;
  var dateMatches = bodyText.match(dateRe);
  var low = bodyText.toLowerCase();
  var countdownLike = /countdown|cuenta regresiva/.test(classTokens.join(" ")) || ((/\bdays?\b|\bdías\b/.test(low)) && (/\bhours?\b|\bhoras\b|\bhrs\b/.test(low)) && (/\bmin/.test(low)));
  var langSwitch = document.querySelectorAll("[hreflang], [class*=lang], [class*=language], [aria-label*=language i]").length > 0;
  var carousels = document.querySelectorAll("[class*=carousel], [class*=slider], [class*=swiper], [class*=slick], [class*=splide], [class*=embla], [class*=glide]").length;

  return {
    url: location.href,
    title: clean(document.title, 200),
    lang: document.documentElement.lang || "",
    viewport: { width: vw, height: vh },
    documentHeight: Math.round(document.documentElement.scrollHeight),
    meta: meta,
    landmarks: {
      header: !!document.querySelector("header, [role=banner]"),
      nav: !!document.querySelector("nav, [role=navigation]"),
      main: !!document.querySelector("main, [role=main]"),
      footer: !!document.querySelector("footer, [role=contentinfo]"),
      aside: !!document.querySelector("aside")
    },
    sections: sections,
    headings: headings,
    forms: forms,
    iframes: iframes,
    media: { videos: document.querySelectorAll("video").length, audios: document.querySelectorAll("audio").length, embeddedPlayers: Array.from(new Set(players)) },
    images: { count: imgs.length, square: imgSquare, large: imgLarge, backgrounds: bgCount, altSamples: imgs.map(function (i) { return clean(i.alt, 80); }).filter(Boolean).slice(0, 30) },
    links: links,
    buttons: buttons,
    blockquotes: blockquotes,
    classTokens: classTokens,
    scriptHosts: scriptHosts,
    fixedElements: fixed,
    dateLikeCount: dateMatches ? dateMatches.length : 0,
    countdownLike: !!countdownLike,
    languageSwitcher: langSwitch,
    carousels: carousels,
    textSample: clean(bodyText, 4000)
  };
})()`;

/** Capture a DomSnapshot of the page currently loaded in `page`. */
export async function captureDomSnapshot(page: Page): Promise<DomSnapshot> {
  return (await page.evaluate(DOM_SNAPSHOT_SCRIPT)) as DomSnapshot;
}
