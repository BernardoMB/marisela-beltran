import type { MusicPlayerProps } from "@/lib/types";
import { BrandIcon, platformLabel } from "@/components/BrandIcons";
import { Reveal } from "@/components/Reveal";
import { SectionHeading } from "@/components/SectionHeading";
import { t } from "@/lib/i18n";
import { theme } from "@/lib/theme";
import { linkAttrs, spotifyArtistEmbedUrl, streamingLinks } from "@/lib/utils";

/** Shared, skinnable "listen" section: Spotify artist embed + streaming platform links. */
export default function MusicPlayer({ anchorId, title, eyebrow, intro, spotifyArtistId, links }: MusicPlayerProps) {
  const platforms = streamingLinks(links ?? []);
  return (
    <section id={anchorId} className="c-player skin-section">
      <div className="skin-container grid items-start gap-10 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <SectionHeading eyebrow={eyebrow} title={title} intro={intro} className="mb-8" />
          {platforms.length ? (
            <ul className="flex flex-wrap gap-3">
              {platforms.map((l) => (
                <li key={l.href}>
                  <a {...linkAttrs(l.href)} className="skin-chip inline-flex min-h-11 items-center gap-2 px-4">
                    <BrandIcon platform={l.platform} className="h-4 w-4" />
                    <span>
                      {t("listenOn")} {platformLabel(l.platform)}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {spotifyArtistId ? (
          <Reveal className="skin-media overflow-hidden">
            <iframe
              title={`Spotify — ${title}`}
              src={spotifyArtistEmbedUrl(spotifyArtistId, theme.mode === "dark" ? 0 : 1)}
              width="100%"
              height="380"
              loading="lazy"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              className="block w-full border-0"
            />
          </Reveal>
        ) : null}
      </div>
    </section>
  );
}
