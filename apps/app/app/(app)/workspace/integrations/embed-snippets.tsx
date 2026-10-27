"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * The three ways onto a website, each as a copyable block: the hosted link, the
 * script embed (renders our form in the page, inherits its font), the iframe
 * (for site builders), and the endpoint for a form the customer already has.
 */
export function EmbedSnippets({ orgId, origin, company }: { orgId: string; origin: string; company: string }) {
  const hosted = `${origin}/f/${orgId}`;
  const endpoint = `${origin}/api/forms/${orgId}`;
  const script = [
    `<div id="alevo-form"></div>`,
    `<script src="${origin}/embed.js" data-org="${orgId}" data-target="#alevo-form" data-company="${company.replace(/"/g, "&quot;")}" async></script>`,
  ].join("\n");
  const iframe = [
    `<iframe id="alevo-frame" src="${hosted}?embed=1&theme=light" title="Contact form" style="width:100%;height:560px;border:0"></iframe>`,
    `<script>addEventListener("message",function(e){if(e.origin==="${origin}"&&e.data&&e.data.type==="alevo:resize"){document.getElementById("alevo-frame").style.height=e.data.height+"px"}})</script>`,
  ].join("\n");
  const api = [
    `POST ${endpoint}`,
    `Content-Type: application/json`,
    ``,
    `{ "name": "Pat Lee", "email": "pat@example.com", "phone": "", "company": "", "message": "Hi", "consent": true }`,
    ``,
    `200 { "ok": true }    400 { "ok": false, "errors": { "email": "…" } }    429 { "ok": false, "error": "…" }`,
  ].join("\n");

  return (
    <div className="space-y-5">
      <Snippet title="Hosted page" hint="A ready-made page you can link to from anywhere." code={hosted} />
      <Snippet
        title="Embed on your site"
        hint="Renders the form inside your page, in your font. Change the button colour with data-accent."
        code={script}
      />
      <Snippet
        title="Iframe"
        hint="For site builders that only allow HTML blocks. The frame grows to fit; use theme=dark for dark pages."
        code={iframe}
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

function Snippet({ title, hint, code }: { title: string; hint: string; code: string }) {
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
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4">
        <div>
          <h3 className="font-sans text-sm font-semibold text-ink">{title}</h3>
          <p className="mt-1 text-label text-ink-muted">{hint}</p>
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={copy} aria-label={`Copy ${title.toLowerCase()} snippet`}>
          {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="mt-3 overflow-x-auto border-t border-hairline bg-raised px-4 py-3 font-mono text-label leading-relaxed text-ink">
        <code>{code}</code>
      </pre>
    </section>
  );
}
