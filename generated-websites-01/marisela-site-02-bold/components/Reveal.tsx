"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { theme } from "@/lib/theme";

type Bezier = [number, number, number, number];

/** The brief's motion settings (config/design-briefs.json → motion) as framer-motion props. */
export function briefTransition(delay = 0) {
  const m = theme.motion;
  const ease = Array.isArray(m.ease) ? ([...m.ease] as Bezier) : ("linear" as const);
  return { duration: m.duration, ease, delay };
}

export interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  /** Override the brief's travel distance (px). */
  distance?: number;
  axis?: "y" | "x";
}

/**
 * Scroll reveal in the brief's motion language. Content is never left hidden: with reduced motion
 * (or the brutalist "hard-cut" preset) it renders immediately.
 */
export function Reveal({ children, className, delay = 0, distance, axis = "y" }: RevealProps) {
  const reduce = useReducedMotion();
  const d = distance ?? theme.motion.distance;
  if (reduce || theme.motion.preset === "hard-cut") return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, [axis]: d }}
      whileInView={{ opacity: 1, [axis]: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={briefTransition(delay)}
    >
      {children}
    </motion.div>
  );
}
