import type { Metadata } from "next";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { PageHeader } from "@/components/marketing/page-header";
import { SectionHeading } from "@/components/marketing/section-heading";
import {
  FadeIn,
  Stagger,
  StaggerItem,
} from "@/components/motion/motion-primitives";
import { FinalCta } from "@/components/sections/final-cta";
import { aboutPage } from "@/content/copy";

export const metadata: Metadata = {
  title: "About",
  description: aboutPage.lead,
};

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow={aboutPage.eyebrow}
        title={aboutPage.title}
        subtitle={aboutPage.lead}
      />

      {/* Story */}
      <section className="section-y">
        <div className="container-page mx-auto max-w-3xl">
          <FadeIn className="flex flex-col gap-6">
            {aboutPage.body.map((p, i) => (
              <p
                key={i}
                className="text-foreground/90"
                style={{ fontSize: "var(--text-lead)", lineHeight: 1.6 }}
              >
                {p}
              </p>
            ))}
          </FadeIn>
        </div>
      </section>

      {/* Values */}
      <section className="section-y bg-muted/30">
        <div className="container-page flex flex-col gap-14">
          <SectionHeading title="What we hold to." />
          <Stagger className="grid gap-5 md:grid-cols-3">
            {aboutPage.values.map((v) => (
              <StaggerItem key={v.title}>
                <article className="h-full rounded-3xl border border-border bg-card p-7">
                  <h3 className="font-display text-lg font-semibold">
                    {v.title}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">{v.body}</p>
                </article>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Team */}
      <section className="section-y">
        <div className="container-page flex flex-col gap-14">
          <SectionHeading eyebrow="The team" title="People, building for people." />
          <Stagger className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
            {aboutPage.team.map((m) => (
              <StaggerItem key={m.name}>
                <article className="flex flex-col items-center gap-4 rounded-3xl border border-border bg-card p-8 text-center">
                  <Avatar className="size-20">
                    <AvatarImage src={m.avatar} alt={m.name} />
                    <AvatarFallback>{m.initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-display text-lg font-semibold">
                      {m.name}
                    </div>
                    <div className="text-sm text-muted-foreground">{m.role}</div>
                  </div>
                </article>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <FinalCta />
    </>
  );
}
