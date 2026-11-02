"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { chatTextColour } from "@/lib/colour";

/**
 * The ways onto a website, each as a copyable block: the script embed (renders
 * our form in the page, inherits its font) and the endpoint for a form the
 * customer already has.
 */
export function EmbedSnippets({ orgId, origin, company, accent, textColor }: { orgId: string; origin: string; company: string; accent: string; textColor: string }) {
  const endpoint = `${origin}/api/forms/${orgId}`;
  const script = [
    `<div id="alevo-form"></div>`,
    `<script src="${origin}/embed.js" data-org="${orgId}" data-target="#alevo-form" data-company="${company.replace(/"/g, "&quot;")}" data-accent="${accent}" data-color="${textColor || chatTextColour(accent)}" async></script>`,
  ].join("\n");
  const api = [
    `POST ${endpoint}`,
    `Content-Type: application/json`,
    ``,
    `{ "name": "Pat Lee", "email": "pat@example.com", "phone": "", "company": "", "message": "Hi", "consent": true }   // name, email, message and consent are required`,
    ``,
    `200 { "ok": true }    400 { "ok": false, "errors": { "email": "…" } }    429 { "ok": false, "error": "…" }`,
  ].join("\n");

  return (
    <div className="space-y-5">
      <Snippet
        title="Embed on your site"
        hint={`Renders a contact card inside your page, in its font: a coloured panel with your phone, email, address and hours beside the form. It fills the width of the element it sits in. data-accent is the panel and button colour and data-color the text on it (they start as your Brand colour and font colour: change them here for one site, or delete them to follow the Brand colour). The form's own text and background follow your page, including its light / dark theme. Add data-details="false" to drop the phone / address list. For different colours in light and dark themes, set --alevo-accent and --alevo-color in your CSS under each theme.`}
        code={script}
      />
      <Snippet
        title="Your own form"
        hint="Point an existing form at this endpoint. A plain HTML form post is sent on to the hosted thank-you page."
        code={api}
      />
      <p className="text-label text-ink-muted">
        Every path runs the same spam checks (hidden field, fill time, rate limits). Submissions arrive under Conversations as web-form leads.
      </p>
    </div>
  );
}

export function Snippet({ title, hint, code }: { title: string; hint: string; code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Copied.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Select the text and copy it instead.");
    }
  }

  return (
    <section className="rounded-md border border-hairline">
      <div className="px-4 pt-4">
        <h3 className="font-sans text-sm font-semibold text-ink">{title}</h3>
        {/* The subtitle on the left, the Copy button across from it on the right. */}
        <div className="mt-1 flex items-start justify-between gap-4">
          <p className="min-w-0 flex-1 text-label text-ink-muted">{hint}</p>
          <Button type="button" size="sm" variant="secondary" className="shrink-0" onClick={copy} aria-label={`Copy ${title.toLowerCase()} snippet`}>
            {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>
      <pre className="mt-3 overflow-x-auto border-t border-hairline bg-raised px-4 py-3 font-mono text-label leading-relaxed text-ink">
        <code>{code}</code>
      </pre>
    </section>
  );
}
