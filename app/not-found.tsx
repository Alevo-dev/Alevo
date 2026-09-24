import Link from "next/link";
import { notFound } from "@/content/copy";

export default function NotFound() {
  return (
    <section className="relative grid min-h-[70vh] place-items-center overflow-hidden">
      <div className="brand-aura absolute inset-0 opacity-60" aria-hidden />
      <div className="container-page relative flex flex-col items-center gap-6 text-center">
        <span className="font-display text-7xl font-semibold text-gradient">
          404
        </span>
        <h1 className="max-w-[18ch] font-display text-2xl font-semibold text-balance sm:text-3xl">
          {notFound.title}
        </h1>
        <p className="text-muted-foreground">{notFound.subtitle}</p>
        <Link
          href={notFound.cta.href}
          className="inline-flex h-11 items-center rounded-full px-6 text-sm font-medium text-white [background-image:var(--brand-gradient)] transition-transform hover:-translate-y-0.5"
        >
          {notFound.cta.label}
        </Link>
      </div>
    </section>
  );
}
