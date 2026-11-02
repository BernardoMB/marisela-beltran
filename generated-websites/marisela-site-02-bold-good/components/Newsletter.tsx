"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useState, type FormEvent } from "react";
import type { NewsletterProps } from "@/lib/types";
import { t } from "@/lib/i18n";
import { isValidEmail } from "@/lib/utils";

export default function Newsletter({ anchorId, title, eyebrow, body, placeholder, buttonLabel, successMessage, errorMessage, privacyNote }: NewsletterProps) {
  const reduce = useReducedMotion();
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
      <div className="mx-auto max-w-[1440px] px-5 md:px-10">
        <div className="relative overflow-hidden rounded-[var(--radius-lg)] bg-linear-to-br from-gradient-from via-gradient-via to-gradient-to p-8 shadow-lg md:p-16">
          <span className="bold-blob -right-20 -top-20 h-72 w-72 bg-background" aria-hidden />
          {eyebrow ? <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.25em] text-background/80">{eyebrow}</p> : null}
          <h2 className="font-display text-[clamp(3rem,9vw,7.5rem)] uppercase leading-[0.85] text-background">{title}</h2>
          {body ? <p className="mt-5 max-w-xl text-lg font-semibold text-background/90">{body}</p> : null}
          {state === "done" ? (
            <motion.p initial={reduce ? undefined : { scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mt-10 inline-block rounded-full bg-background px-8 py-4 text-lg font-extrabold uppercase text-foreground" role="status">
              {successMessage}
            </motion.p>
          ) : (
            <form onSubmit={submit} noValidate className="mt-10 flex max-w-2xl flex-col gap-3 sm:flex-row">
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
                  className="h-14 w-full rounded-full border-0 bg-background px-6 text-base font-semibold text-foreground outline-none placeholder:text-muted-foreground focus:ring-4 focus:ring-background/60"
                />
              </label>
              <button type="submit" disabled={state === "sending"} className="h-14 rounded-full bg-foreground px-8 text-sm font-extrabold uppercase tracking-wider text-background transition hover:scale-105">
                {state === "sending" ? t("sending") : buttonLabel}
              </button>
            </form>
          )}
          <p className="mt-4 min-h-5 text-sm font-semibold text-background/90" aria-live="polite">
            {state === "error" ? errorMessage : privacyNote}
          </p>
        </div>
      </div>
    </section>
  );
}
