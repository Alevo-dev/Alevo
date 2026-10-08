"use client";

import { useActionState } from "react";
import { submitDemoRequest, type ContactState } from "@/app/(site)/contact/actions";

const initial: ContactState = { ok: false };

const field: React.CSSProperties = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid rgba(var(--ink),.12)",
  background: "rgba(var(--ink),.02)",
  padding: "12px 14px",
  fontSize: 14,
  fontFamily: "inherit",
  color: "var(--text)",
  outline: "none",
};
const label: React.CSSProperties = { fontSize: 13, color: "var(--dim)", marginBottom: 6, display: "block" };
const err: React.CSSProperties = { fontSize: 13, color: "#f26d6d", marginTop: 6 };

export function ContactForm() {
  const [state, action, pending] = useActionState(submitDemoRequest, initial);

  if (state.ok) {
    return (
      <div style={{ borderRadius: 18, border: "1px solid rgba(61,220,151,.25)", background: "rgba(61,220,151,.08)", padding: 28, textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 600 }}>Thanks — we&rsquo;ll be in touch</div>
        <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 14 }}>{state.message}</p>
      </div>
    );
  }

  return (
    <form action={action} noValidate style={{ display: "flex", flexDirection: "column", gap: 16, borderRadius: 22, border: "1px solid rgba(var(--ink),.08)", background: "rgba(var(--ink),.025)", padding: 24 }}>
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))" }}>
        <div>
          <label style={label} htmlFor="name">Name</label>
          <input id="name" name="name" autoComplete="name" placeholder="Sam Rivera" style={field} aria-invalid={!!state.errors?.name} />
          {state.errors?.name ? <p style={err}>{state.errors.name}</p> : null}
        </div>
        <div>
          <label style={label} htmlFor="email">Work email</label>
          <input id="email" name="email" type="email" autoComplete="email" placeholder="sam@company.com" style={field} aria-invalid={!!state.errors?.email} />
          {state.errors?.email ? <p style={err}>{state.errors.email}</p> : null}
        </div>
      </div>
      <div>
        <label style={label} htmlFor="company">Company</label>
        <input id="company" name="company" autoComplete="organization" placeholder="Northpeak Logistics" style={field} aria-invalid={!!state.errors?.company} />
        {state.errors?.company ? <p style={err}>{state.errors.company}</p> : null}
      </div>
      <div>
        <label style={label} htmlFor="message">What would you like Alevo to handle?</label>
        <textarea id="message" name="message" rows={4} placeholder="We get ~200 inbound leads a month and reply too slowly…" style={{ ...field, resize: "vertical" }} aria-invalid={!!state.errors?.message} />
        {state.errors?.message ? <p style={err}>{state.errors.message}</p> : null}
      </div>
      <button type="submit" disabled={pending} className="btn-grad" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 48, borderRadius: 999, border: 0, fontWeight: 600, fontSize: 15, color: "#06070b", background: "linear-gradient(120deg,#38b6ff,#a06bff)", cursor: pending ? "default" : "pointer", opacity: pending ? 0.7 : 1 }}>
        {pending ? "Sending…" : "Send message"}
      </button>
      <p style={{ fontSize: 12, color: "var(--dim)", margin: 0 }}>By submitting, you agree to be contacted about Alevo. We&rsquo;ll never share your details.</p>
    </form>
  );
}
