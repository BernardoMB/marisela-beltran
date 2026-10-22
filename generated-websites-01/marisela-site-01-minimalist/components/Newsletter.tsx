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
    if (!isValidEmail(email)) {
      setState("error");
      return;
    }
    setState("sending");
    window.setTimeout(() => setState("done"), 700);
  };
  return (
    <section id={anchorId} className="skin-section">
      <div className="skin-container">
        <SectionHeading eyebrow={eyebrow} title={title} intro={body} />
        <div className="md:ml-[25%] md:max-w-2xl">
          {state === "done" ? (
            <p className="border-b border-foreground py-4 font-display text-2xl font-light" role="status">
              {successMessage}
            </p>
          ) : (
            <form onSubmit={submit} noValidate className="flex flex-col gap-6 sm:flex-row sm:items-end">
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
                  className="h-12 w-full border-0 border-b border-foreground bg-transparent text-lg font-light outline-none placeholder:text-muted-foreground focus:border-accent"
                />
              </label>
              <button type="submit" disabled={state === "sending"} className="skin-btn h-12 text-base">
                {state === "sending" ? t("sending") : `${buttonLabel} →`}
              </button>
            </form>
          )}
          <p className="mt-4 min-h-5 text-sm" aria-live="polite">
            {state === "error" ? <span className="text-destructive">{errorMessage}</span> : privacyNote ? <span className="text-muted-foreground">{privacyNote}</span> : null}
          </p>
        </div>
      </div>
    </section>
  );
}
