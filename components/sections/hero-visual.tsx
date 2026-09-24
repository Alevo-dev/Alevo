"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Mail, Phone, MessagesSquare, CalendarCheck, Check } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "cn";

/** Gentle floating wrapper — drifts unless reduced motion is requested. */
function Float({
  children,
  delay = 0,
  drift = 10,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  drift?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        animate={reduce ? undefined : { y: [0, -drift, 0] }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
          delay,
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function CardShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-border bg-card/90 p-4 shadow-(--shadow-lift) backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

function ChannelIcon({
  Icon,
  ping = false,
  className,
}: {
  Icon: typeof Mail;
  ping?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative grid size-9 shrink-0 place-items-center rounded-xl [background-image:var(--brand-gradient-soft)] text-brand-violet ring-1 ring-border",
        className,
      )}
    >
      <Icon className="size-4.5" />
      {ping ? (
        <span className="absolute -top-0.5 -right-0.5 flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-magenta opacity-75" />
          <span className="relative inline-flex size-2.5 rounded-full bg-brand-magenta ring-2 ring-card" />
        </span>
      ) : null}
    </span>
  );
}

function Dot({ delay }: { delay: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      className="size-1.5 rounded-full bg-brand-violet"
      animate={reduce ? undefined : { opacity: [0.3, 1, 0.3] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay }}
    />
  );
}

const swap = {
  initial: { opacity: 0, scale: 0.8 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.8 },
  transition: { duration: 0.25 },
};

/** Right-hand status that cycles: Alevo typing … → Sent ✓ (fixed size, no shift). */
function ChatStatus({ typing }: { typing: boolean }) {
  return (
    <span className="relative flex h-7 w-17 items-center justify-end">
      <AnimatePresence mode="wait" initial={false}>
        {typing ? (
          <motion.span
            key="typing"
            {...swap}
            className="absolute inset-0 flex items-center justify-center gap-1 rounded-full bg-muted"
          >
            <Dot delay={0} />
            <Dot delay={0.15} />
            <Dot delay={0.3} />
          </motion.span>
        ) : (
          <motion.span
            key="sent"
            {...swap}
            className="absolute inset-0 flex items-center justify-center gap-1 rounded-full [background-image:var(--brand-gradient-soft)] text-xs font-medium text-brand-violet"
          >
            <Check className="size-3.5" />
            Sent
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

export function HeroVisual() {
  const reduce = useReducedMotion();
  const [tick, setTick] = useState(0);

  // Slow heartbeat that drives the "live" cycles. Paused for reduced motion.
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setTick((t) => t + 1), 2800);
    return () => clearInterval(id);
  }, [reduce]);

  const typing = tick % 2 === 0;
  const pinging = tick % 2 === 1; // unread pulse alternates with typing

  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* soft brand aura */}
      <div
        aria-hidden
        className="brand-aura absolute inset-0 -z-10 scale-125 opacity-80"
      />

      {/* floating "meeting booked" pill — gentle breathing */}
      <Float delay={0.35} drift={7} className="absolute -top-6 right-0 z-20">
        <motion.div
          animate={reduce ? undefined : { scale: [1, 1.05, 1] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          className="flex items-center gap-2 rounded-full [background-image:var(--brand-gradient)] px-3.5 py-2 text-sm font-medium text-white shadow-(--shadow-lift)"
        >
          <CalendarCheck className="size-4" />
          Meeting booked
        </motion.div>
      </Float>

      <div className="flex flex-col gap-4 pt-6">
        {/* Email thread */}
        <Float delay={0.05} className="-rotate-2">
          <CardShell>
            <div className="flex items-center gap-3">
              <ChannelIcon Icon={Mail} ping={pinging} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium">
                  Email
                  <span className="text-xs font-normal text-muted-foreground">
                    · just now
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  to Maya at Loomly
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm text-foreground/90">
              “Congrats on the raise — worth a quick chat this week?”
            </p>
            <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-brand-violet">
              <motion.span
                animate={reduce ? undefined : { scale: [1, 1.25, 1] }}
                transition={{
                  duration: 2.8,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="inline-flex"
              >
                <Check className="size-3.5" />
              </motion.span>
              Alevo replied &amp; followed up
            </div>
          </CardShell>
        </Float>

        {/* Call booked */}
        <Float delay={0.18} drift={13} className="ml-auto w-[86%] rotate-2">
          <CardShell className="flex items-center gap-3">
            <ChannelIcon Icon={Phone} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">Call booked</div>
              <p className="text-xs text-muted-foreground">
                Thu 2:00pm · with Maya
              </p>
            </div>
            <Avatar className="size-9">
              <AvatarImage
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=96&h=96&fit=crop&crop=faces"
                alt="Maya"
              />
              <AvatarFallback>MO</AvatarFallback>
            </Avatar>
          </CardShell>
        </Float>

        {/* Chat typing → sent */}
        <Float delay={0.28} drift={9} className="mr-6 -rotate-1">
          <CardShell className="flex items-center gap-3">
            <ChannelIcon Icon={MessagesSquare} ping={!pinging} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">Chat · live</div>
              <p className="truncate text-xs text-muted-foreground">
                “Can you grab me a rep?”
              </p>
            </div>
            <ChatStatus typing={reduce ? false : typing} />
          </CardShell>
        </Float>
      </div>
    </div>
  );
}
