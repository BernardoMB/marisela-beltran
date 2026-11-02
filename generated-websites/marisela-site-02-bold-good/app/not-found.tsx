import Link from "next/link";
import { artistContent } from "@/lib/content";

export default function NotFound() {
  const es = artistContent.lang === "es";
  return (
    <main id="contenido" className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="font-mono text-sm uppercase tracking-[0.3em] text-muted-foreground">404</p>
      <h1 className="font-display text-4xl md:text-6xl">{es ? "Página no encontrada" : "Page not found"}</h1>
      <Link href="/" className="underline underline-offset-4 hover:text-primary">
        {es ? "Volver al inicio" : "Back to home"}
      </Link>
    </main>
  );
}
