"use client";

import { useState, type FormEvent } from "react";
import type { NewsletterProps } from "@/lib/types";
import { SectionHeading } from "@/components/SectionHeading";
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
        <SectionHeading eyebrow={eyebrow} title={title} intro={body} />
        <div className="skin-card max-w-4xl bg-foreground p-5 text-background md:p-8">
          {state === "done" ? (
            <p className="font-bold" role="status">
              $ <span className="bg-accent px-2 text-accent-foreground">{successMessage}</span>
            </p>
          ) : (
            <form onSubmit={submit} noValidate className="flex flex-col gap-4 md:flex-row md:items-center">
              <label className="flex flex-1 items-center gap-3">
                <span className="shrink-0 font-bold" aria-hidden>
                  $ subscribe --email
                </span>
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
                  className="h-12 min-w-0 flex-1 border-0 border-b-[3px] border-background bg-transparent font-mono text-background outline-none placeholder:text-background/50 focus:border-accent"
                />
              </label>
              <button type="submit" disabled={state === "sending"} className="min-h-12 border-[3px] border-background bg-accent px-6 font-bold uppercase text-accent-foreground hover:bg-background hover:text-foreground">
                {state === "sending" ? t("sending") : buttonLabel}
              </button>
            </form>
          )}
          <p className="mt-4 min-h-5 text-sm" aria-live="polite">
            {state === "error" ? <span className="bg-destructive px-2 text-destructive-foreground">{errorMessage}</span> : <span className="text-background/70">// {privacyNote}</span>}
          </p>
        </div>
      </div>
    </section>
  );
}
