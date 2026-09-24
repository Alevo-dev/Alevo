/**
 * All marketing copy in one typed place — easy to edit, no strings buried in
 * components. Voice: warm, human, confident. Not buzzword AI-slop.
 * Photography URLs are Unsplash placeholders until real R2 assets land.
 */

export const hero = {
  eyebrow: "Meet Alevo",
  title: "Your AI SDR that actually sounds human.",
  // rendered with the middle clause gradient-highlighted in the component
  titleLead: "Your AI SDR that actually",
  titleAccent: "sounds human",
  subtitle:
    "Alevo works your pipeline the way your best rep would — writing the email, filling the form, picking up the call, answering the chat. You wake up to booked meetings, not busywork.",
  primaryCta: { label: "Start for free", href: "signup" as const },
  secondaryCta: { label: "Book a demo", href: "/contact" },
  note: "No credit card. Live in an afternoon.",
} as const;

export const logos = {
  caption: "Trusted by revenue teams who hate cold-calling more than you do",
  // Placeholder wordmarks (rendered as text) until brand assets arrive
  names: ["Northwind", "Loomly", "Cadence", "Brightwork", "Hearth", "Vela"],
} as const;

export const channels = {
  eyebrow: "Every channel, one rep",
  title: "It meets your leads where they already are.",
  subtitle:
    "One AI rep, fluent across the four places deals actually happen. No hand-offs, no dropped context — just one continuous conversation.",
  items: [
    {
      id: "email",
      name: "Email",
      headline: "Outbound that reads like you wrote it",
      body: "Researched, personal, and on-brand — Alevo drafts, sends, and follows up until it gets a reply worth your time.",
    },
    {
      id: "forms",
      name: "Forms",
      headline: "Inbound leads, answered in seconds",
      body: "Every form fill gets an instant, thoughtful reply and a calendar link — while the intent is still hot.",
    },
    {
      id: "calls",
      name: "Calls",
      headline: "A voice that qualifies and books",
      body: "Alevo picks up, asks the right questions, handles objections, and books the meeting — then hands you the notes.",
    },
    {
      id: "chat",
      name: "Chat",
      headline: "A chatbot people don't hate",
      body: "It answers like a teammate who knows your product, routes the serious buyers, and never loses the thread.",
    },
  ],
} as const;

export const features = {
  eyebrow: "Why teams switch",
  title: "Less pipeline anxiety. More conversations that count.",
  subtitle:
    "Alevo isn't a chatbot bolted onto your funnel. It's a rep with judgment — one that knows when to push, when to wait, and when to bring in a human.",
  items: [
    {
      title: "Sounds like your brand",
      body: "Train it on your best threads and it picks up your tone — warm, sharp, never robotic.",
      icon: "sparkles",
    },
    {
      title: "Knows when to hand off",
      body: "The moment a lead is ready, Alevo pulls in the right human with full context. No cold hand-offs.",
      icon: "users",
    },
    {
      title: "Books while you sleep",
      body: "Time zones, follow-ups, and 'circle back next quarter' — handled. You just show up to the meeting.",
      icon: "calendar",
    },
    {
      title: "Learns your playbook",
      body: "Objections, pricing, edge cases — it studies what closes and gets sharper every week.",
      icon: "brain",
    },
    {
      title: "Honest reporting",
      body: "See exactly what was said, sent, and booked. Every touch is logged and readable — no black box.",
      icon: "line-chart",
    },
    {
      title: "Respects the human",
      body: "Opt-outs, quiet hours, and a real 'talk to a person' path are built in, not bolted on.",
      icon: "heart-handshake",
    },
  ],
} as const;

export const howItWorks = {
  eyebrow: "Live in an afternoon",
  title: "Three steps to your first booked meeting.",
  steps: [
    {
      n: "01",
      title: "Point it at your world",
      body: "Connect your inbox, CRM, and calendar. Drop in a few winning threads so it learns your voice.",
    },
    {
      n: "02",
      title: "Set the guardrails",
      body: "Tell it who to chase, what to say, and where the human line is. You stay in control the whole time.",
    },
    {
      n: "03",
      title: "Watch meetings land",
      body: "Alevo works every channel in the background and books qualified calls straight onto your calendar.",
    },
  ],
} as const;

export const stats = {
  title: "The kind of numbers that make your quarter",
  items: [
    { value: "3.4x", label: "more meetings booked per rep" },
    { value: "8 min", label: "average inbound response time → now seconds" },
    { value: "62%", label: "less time spent on manual follow-up" },
    { value: "24/7", label: "always-on across every channel" },
  ],
} as const;

export const testimonials = {
  eyebrow: "From real teams",
  title: "The rep that never sleeps, and never sounds like a robot.",
  items: [
    {
      quote:
        "It booked three meetings the first weekend — from leads we'd written off. My team thought I'd secretly hired someone.",
      name: "Maya Okonkwo",
      role: "Head of Growth, Loomly",
      avatar:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=128&h=128&fit=crop&crop=faces",
      initials: "MO",
    },
    {
      quote:
        "The follow-ups sound like me on my best day. Prospects reply thinking they're talking to a person — because it feels like one.",
      name: "Daniel Reyes",
      role: "Founder, Cadence",
      avatar:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=128&h=128&fit=crop&crop=faces",
      initials: "DR",
    },
    {
      quote:
        "We stopped losing inbound leads to slow replies. Alevo answers in seconds and hands us only the ones worth our time.",
      name: "Priya Nair",
      role: "VP Revenue, Brightwork",
      avatar:
        "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=128&h=128&fit=crop&crop=faces",
      initials: "PN",
    },
  ],
} as const;

export const pricing = {
  eyebrow: "Simple, honest pricing",
  title: "Pay for meetings, not seats.",
  subtitle:
    "Every plan starts with a 90-day free trial. You're not paying for volume — every lead is nurtured and qualified, so you only ever work warm.",
  monthlyLabel: "Monthly",
  annualLabel: "Annual",
  annualNote: "Save 40%",
  trialNote:
    "Every paid plan starts with a 90-day free trial — no credit card required. You only pay once Alevo is booking meetings.",
  tiers: [
    {
      name: "Starter",
      priceMonthly: 1500,
      priceAnnual: 900,
      blurb: "For founders who want warm leads, not cold lists.",
      features: [
        "1 AI rep",
        "Email + forms",
        "Up to 10 nurtured, warm leads / mo",
        "Calendar booking",
        "Community support",
      ],
      cta: { label: "Start 90-day free trial", href: "signup" as const },
      highlighted: false,
    },
    {
      name: "Growth",
      priceMonthly: 2500,
      priceAnnual: 1500,
      blurb: "For teams scaling warm, qualified pipeline.",
      features: [
        "3 AI reps",
        "All four channels",
        "Up to 30 nurtured, warm leads / mo",
        "Voice calls + live hand-off",
        "CRM sync + reporting",
        "Priority support",
      ],
      cta: { label: "Start 90-day free trial", href: "signup" as const },
      highlighted: true,
    },
    {
      name: "Scale",
      priceMonthly: null,
      priceAnnual: null,
      blurb: "For revenue orgs with real volume.",
      features: [
        "Unlimited AI reps",
        "Custom voice + guardrails",
        "Unlimited nurtured, qualified leads",
        "SSO + audit logs",
        "Dedicated success manager",
        "SLA & onboarding",
      ],
      cta: { label: "Talk to us", href: "/contact" },
      highlighted: false,
    },
  ],
} as const;

export const finalCta = {
  title: "Your pipeline is already warm. Let Alevo work it.",
  subtitle:
    "Spin up your AI rep in an afternoon and watch the meetings start landing.",
  primaryCta: { label: "Start for free", href: "signup" as const },
  secondaryCta: { label: "Book a demo", href: "/contact" },
} as const;

export const aboutPage = {
  eyebrow: "Why we built Alevo",
  title: "Selling is human. The busywork isn't.",
  lead: "We spent years watching great reps drown in follow-ups, form fills, and 'just checking in' emails. So we built the teammate we always wanted — one that handles the grind and hands the human moments back to humans.",
  body: [
    "Alevo started with a stubborn belief: prospects can tell when they're being processed. The fix wasn't more automation that sounds like automation — it was a rep with taste. One that writes like a person, listens on a call, and knows when to step back.",
    "We're a small team of people who've carried a quota, shipped the software, and answered the 2 a.m. support chat. We're building the tool we wish we'd had — and we'd love for you to put it to work.",
  ],
  values: [
    {
      title: "Human first, always",
      body: "Every automation has a visible off-ramp to a real person. No dark patterns, no pretending.",
    },
    {
      title: "Earn the reply",
      body: "We optimize for conversations worth having, not vanity send volume.",
    },
    {
      title: "Show our work",
      body: "Every message and decision is logged and readable. Trust is built in the open.",
    },
  ],
  team: [
    {
      name: "Sofia Bianchi",
      role: "Co-founder & CEO",
      avatar:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=faces",
      initials: "SB",
    },
    {
      name: "Marcus Hale",
      role: "Co-founder & CTO",
      avatar:
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=faces",
      initials: "MH",
    },
    {
      name: "Amara Diallo",
      role: "Head of Product",
      avatar:
        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=faces",
      initials: "AD",
    },
  ],
} as const;

export const contactPage = {
  eyebrow: "Let's talk",
  title: "See Alevo work your pipeline.",
  subtitle:
    "Tell us a little about your team and we'll set up a 20-minute walkthrough — no slide deck, just your use case running live.",
  success: "Thanks — we'll be in touch within one business day.",
} as const;

export const notFound = {
  title: "This page went to follow up and never came back.",
  subtitle: "Let's get you somewhere useful.",
  cta: { label: "Back home", href: "/" },
} as const;
