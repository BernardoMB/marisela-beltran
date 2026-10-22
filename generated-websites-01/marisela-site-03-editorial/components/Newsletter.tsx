"use client";

import { useState, type FormEvent } from "react";
import type { NewsletterProps } from "@/lib/types";
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
        <div className="mx-auto max-w-3xl border-2 border-dashed border-foreground/60 bg-surface p-8 md:p-12">
          {eyebrow ? <p className="skin-eyebrow text-center">{eyebrow}</p> : null}
          <h2 className="text-center font-display text-4xl font-bold italic md:text-5xl">{title}</h2>
          {body ? <p className="mx-auto mt-4 max-w-xl text-center text-lg italic">{body}</p> : null}
          {state === "done" ? (
            <p className="mt-8 text-center font-display text-2xl italic text-accent" role="status">
              {successMessage}
            </p>
          ) : (
            <form onSubmit={submit} noValidate className="mx-auto mt-8 flex max-w-xl flex-col gap-4 sm:flex-row sm:items-end">
              <label className="flex-1">
                <span className="ed-smallcaps block text-sm text-muted-foreground">{t("emailLabel")}</span>
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
                  className="mt-1 h-12 w-full border-0 border-b border-foreground bg-transparent font-display text-xl italic outline-none placeholder:text-muted-foreground focus:border-accent"
                />
              </label>
              <button type="submit" disabled={state === "sending"} className="ed-smallcaps h-12 bg-foreground px-6 text-lg text-background transition hover:bg-accent hover:text-accent-foreground">
                {state === "sending" ? t("sending") : buttonLabel}
              </button>
            </form>
          )}
          <p className="ed-caption mt-4 min-h-5 text-center" aria-live="polite">
            {state === "error" ? <span className="text-destructive">{errorMessage}</span> : privacyNote}
          </p>
        </div>
      </div>
    </section>
  );
}
