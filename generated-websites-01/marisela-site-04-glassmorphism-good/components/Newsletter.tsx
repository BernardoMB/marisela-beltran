"use client";

import { Mail } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { NewsletterProps } from "@/lib/types";
import { Reveal } from "@/components/Reveal";
import { t } from "@/lib/i18n";
import { isValidEmail } from "@/lib/utils";

export default function Newsletter({ anchorId, title, eyebrow, body, placeholder, buttonLabel, successMessage, errorMessage, privacyNote }: NewsletterProps) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(email)) return setState("error");
    setState("sending");
    window.setTimeout(() => setState("done"), 700);
  };
  return (
    <section id={anchorId} className="skin-section px-4">
      <Reveal className="glass relative mx-auto max-w-3xl overflow-hidden p-8 text-center md:p-14">
        <span className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent opacity-30 blur-3xl" aria-hidden />
        <span className="absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-primary opacity-30 blur-3xl" aria-hidden />
        {eyebrow ? <p className="skin-eyebrow justify-center">{eyebrow}</p> : null}
        <h2 className="skin-title">{title}</h2>
        {body ? <p className="mx-auto mt-4 max-w-md text-muted-foreground">{body}</p> : null}
        {state === "done" ? (
          <p className="mt-8 text-xl text-primary" role="status">
            {successMessage}
          </p>
        ) : (
          <form onSubmit={submit} noValidate className="relative mx-auto mt-8 flex max-w-lg flex-col gap-3 sm:flex-row">
            <label className="relative flex-1">
              <span className="sr-only">{t("emailLabel")}</span>
              <Mail className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (state === "error") setState("idle");
                }}
                placeholder={placeholder}
                aria-invalid={state === "error"}
                className="h-13 w-full rounded-full border border-foreground/20 bg-foreground/10 py-3.5 pl-12 pr-5 text-foreground outline-none backdrop-blur placeholder:text-muted-foreground focus:border-primary"
              />
            </label>
            <button type="submit" disabled={state === "sending"} className="skin-btn h-13 px-7 py-3.5 font-semibold">
              {state === "sending" ? t("sending") : buttonLabel}
            </button>
          </form>
        )}
        <p className="mt-4 min-h-5 text-sm text-muted-foreground" aria-live="polite">
          {state === "error" ? <span className="text-destructive">{errorMessage}</span> : privacyNote}
        </p>
      </Reveal>
    </section>
  );
}
