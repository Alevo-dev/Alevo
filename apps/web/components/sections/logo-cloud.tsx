import { FadeIn } from "@/components/motion/motion-primitives";
import { LogoMarquee } from "@/components/sections/logo-marquee";
import { logos } from "@/content/copy";

export function LogoCloud() {
  return (
    <section className="border-y border-border/60 bg-muted/30">
      <div className="py-10">
        <div className="container-page">
          <FadeIn className="flex flex-col items-center gap-6">
            <p className="text-center text-sm text-muted-foreground">
              {logos.caption}
            </p>
            {/* Desktop: static wrap — there's room to show every name */}
            <ul className="hidden flex-wrap items-center justify-center gap-x-10 gap-y-4 md:flex">
              {logos.names.map((name) => (
                <li
                  key={name}
                  className="font-display text-lg font-semibold text-foreground/45 transition-colors hover:text-foreground/70"
                >
                  {name}
                </li>
              ))}
            </ul>
          </FadeIn>
        </div>

        {/* Mobile: velocity-aware marquee — scroll to speed it up */}
        <LogoMarquee names={logos.names} className="mt-6 md:hidden" />
      </div>
    </section>
  );
}
