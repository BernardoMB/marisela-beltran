"use client";

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
    <section id={anchorId} className="skin-section">
      <div className="skin-container">
        <Reveal className="mx-auto max-w-3xl overflow-hidden rounded-[22px] border-2 border-border bg-surface shadow-lg">
          <div className="retro-stripes h-6" aria-hidden />
          <div className="grid gap-6 p-6 md:grid-cols-[auto_1fr] md:p-10">
            <div className="retro-vinyl mx-auto aspect-square w-28 md:w-36" aria-hidden />
            <div>
              {eyebrow ? <p className="skin-eyebrow">{eyebrow}</p> : null}
              <h2 className="skin-title">{title}</h2>
              {body ? <p className="mt-3 italic">{body}</p> : null}
              {state === "done" ? (
                <p className="retro-display mt-6 text-3xl text-primary" style={{ textShadow: "2px 2px 0 var(--secondary)" }} role="status">
                  {successMessage}
                </p>
              ) : (
                <form onSubmit={submit} noValidate className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <label className="flex-1">
                    <span className="sr-only">{t("emailLabel")}</span>
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
                      className="h-13 w-full rounded-full border-2 border-border bg-background px-5 py-3 font-bold outline-none placeholder:font-normal placeholder:text-muted-foreground focus:border-primary"
                    />
                  </label>
                  <button type="submit" disabled={state === "sending"} className="skin-btn h-13 px-7 py-3">
                    {state === "sending" ? t("sending") : buttonLabel}
                  </button>
                </form>
              )}
              <p className="retro-mono mt-3 min-h-5 text-[11px]" aria-live="polite">
                {state === "error" ? <span className="text-destructive">{errorMessage}</span> : privacyNote}
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
