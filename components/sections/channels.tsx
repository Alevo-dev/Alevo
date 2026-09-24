import { Mail, ClipboardList, Phone, MessagesSquare } from "lucide-react";
import { cn } from "cn";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Stagger, StaggerItem } from "@/components/motion/motion-primitives";
import { channels } from "@/content/copy";

const ICONS = {
  email: Mail,
  forms: ClipboardList,
  calls: Phone,
  chat: MessagesSquare,
} as const;

// A tiny human exchange per channel — reminds you real people are on the other end.
const SNIPPETS: Record<string, { from: string; text: string }[]> = {
  email: [
    { from: "them", text: "Saw you raised — congrats. Worth a chat?" },
    { from: "lead", text: "Actually, yes. How's Thursday?" },
  ],
  forms: [
    { from: "them", text: "Thanks for the demo request, Sam 👋" },
    { from: "lead", text: "Wow, that was fast." },
  ],
  calls: [
    { from: "them", text: "Happy to walk you through it — 15 mins?" },
    { from: "lead", text: "Perfect, booked." },
  ],
  chat: [
    { from: "them", text: "That plan covers 5 seats — want me to grab a rep?" },
    { from: "lead", text: "Please do." },
  ],
};

export function Channels() {
  return (
    <section id="channels" className="section-y">
      <div className="container-page flex flex-col gap-14">
        <SectionHeading
          eyebrow={channels.eyebrow}
          title={channels.title}
          subtitle={channels.subtitle}
        />

        <Stagger className="grid gap-5 sm:grid-cols-2">
          {channels.items.map((c) => {
            const Icon = ICONS[c.id as keyof typeof ICONS];
            const snippet = SNIPPETS[c.id];
            return (
              <StaggerItem key={c.id}>
                <article
                  id={c.id}
                  className="group h-full rounded-3xl border border-border bg-card p-6 shadow-(--shadow-card) transition-all duration-(--dur) hover:-translate-y-1 hover:shadow-(--shadow-lift) sm:p-8"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid size-11 place-items-center rounded-2xl [background-image:var(--brand-gradient-soft)] text-brand-violet ring-1 ring-border">
                      <Icon className="size-5" />
                    </span>
                    <h3 className="font-display text-xl font-semibold">
                      {c.name}
                    </h3>
                  </div>

                  <p className="mt-5 font-display text-lg font-medium text-balance">
                    {c.headline}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">{c.body}</p>

                  {/* mock conversation */}
                  <div className="mt-6 flex flex-col gap-2">
                    {snippet.map((m, i) => (
                      <span
                        key={i}
                        className={cn(
                          "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm",
                          m.from === "lead"
                            ? "self-end bg-primary text-primary-foreground"
                            : "self-start bg-muted text-foreground",
                        )}
                      >
                        {m.text}
                      </span>
                    ))}
                  </div>
                </article>
              </StaggerItem>
            );
          })}
        </Stagger>
      </div>
    </section>
  );
}
