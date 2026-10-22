import { ArrowUpRight, Mail, Phone } from "lucide-react";
import type { ContactBookingProps } from "@/lib/types";
import { Reveal } from "@/components/Reveal";
import { SectionHeading } from "@/components/SectionHeading";
import { t } from "@/lib/i18n";
import { linkAttrs } from "@/lib/utils";

/** Shared, skinnable booking / press contact section (briefs may override this file). */
export default function ContactBooking({ anchorId, title, eyebrow, body, email, bookingUrl, phone, links }: ContactBookingProps) {
  return (
    <section id={anchorId} className="c-contact skin-section">
      <div className="skin-container">
        <Reveal className="skin-card grid gap-8 p-8 md:grid-cols-[1.4fr_1fr] md:p-12">
          <div>
            <SectionHeading eyebrow={eyebrow} title={title} intro={body} className="mb-0 md:mb-0" />
          </div>
          <div className="flex flex-col justify-center gap-3">
            {email ? (
              <a href={`mailto:${email}`} className="skin-btn inline-flex min-h-12 items-center justify-center gap-2 px-6">
                <Mail className="h-4 w-4" aria-hidden />
                {t("bookingInquiry")}
              </a>
            ) : null}
            {bookingUrl ? (
              <a {...linkAttrs(bookingUrl)} className={`${email ? "skin-btn-ghost" : "skin-btn"} inline-flex min-h-12 items-center justify-center gap-2 px-6`}>
                {email ? t("moreInfo") : t("bookingInquiry")}
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </a>
            ) : null}
            {phone ? (
              <a href={`tel:${phone.replace(/[^+\d]/g, "")}`} className="skin-btn-ghost inline-flex min-h-12 items-center justify-center gap-2 px-6">
                <Phone className="h-4 w-4" aria-hidden />
                {phone}
              </a>
            ) : null}
            {links?.map((l) => (
              <a key={l.href} {...linkAttrs(l.href)} className="skin-link inline-flex items-center gap-1 self-center text-sm">
                {l.label}
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </a>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
