"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { At, Attr, CodeBox, Pn, Tg, Vl } from "@/components/workspace/code-box";
import { DialogTabs } from "@/components/workspace/tool-dialog";
import { chatTextColour } from "@/lib/colour";

const TABS = [
  { key: "embed", label: "Embed on your site" },
  { key: "own", label: "Your own form" },
];

const FIELDS: { name: string; required: boolean }[] = [
  { name: "name", required: true },
  { name: "email", required: true },
  { name: "message", required: true },
  { name: "consent", required: true },
  { name: "phone", required: false },
  { name: "company", required: false },
];

const RESPONSES: { code: string; color: string; body: string; text: string }[] = [
  { code: "200", color: "text-success", body: '{ "ok": true }', text: "Accepted. A conversation opens." },
  { code: "400", color: "text-warning", body: '{ "ok": false, "errors": { "email": "…" } }', text: "A field failed validation." },
  { code: "429", color: "text-danger", body: '{ "ok": false, "error": "…" }', text: "Too many requests." },
];

/**
 * The website form's two ways in (the Integrations board): the script that draws our contact card in the page, with
 * its two options (colours follow the Brand colour unless set for this site; the contact details beside the form),
 * and the endpoint for a form the customer already has.
 */
export function EmbedSnippets({ orgId, origin, company, accent, textColor }: { orgId: string; origin: string; company: string; accent: string; textColor: string }) {
  const [tab, setTab] = useState("embed");
  const [follow, setFollow] = useState(true);
  const [details, setDetails] = useState(true);
  const endpoint = `${origin}/api/forms/${orgId}`;
  const text = textColor || chatTextColour(accent);
  const safeCompany = company.replace(/"/g, "&quot;");

  const script = [
    `<div id="alevo-form"></div>`,
    `<script src="${origin}/embed.js" data-org="${orgId}" data-target="#alevo-form" data-company="${safeCompany}"${follow ? "" : ` data-accent="${accent}" data-color="${text}"`}${details ? "" : ` data-details="false"`} async></script>`,
  ].join("\n");
  const request = [
    `POST ${endpoint}`,
    `Content-Type: application/json`,
    ``,
    `{ "name": "Pat Lee", "email": "pat@example.com", "phone": "", "company": "", "message": "Hi", "consent": true }`,
  ].join("\n");

  return (
    <>
      <DialogTabs tabs={TABS} value={tab} onChange={setTab} />

      <div role="tabpanel" hidden={tab !== "embed"} className="flex flex-col gap-5">
        <p className="text-[13.5px] leading-5 text-ink-muted">
          Paste this where the form should appear. It renders a contact card in your page, in your page&apos;s font, and fills the width of the element it sits in.
        </p>
        <CodeBox label="HTML" text={script}>
          <Tg>&lt;div</Tg>
          <Attr name="id" value="alevo-form" />
          <Tg>&gt;&lt;/div&gt;</Tg>
          {"\n"}
          <Tg>&lt;script</Tg>
          <Attr name="src" value={`${origin}/embed.js`} />
          <Attr name="data-org" value={orgId} />
          <Attr name="data-target" value="#alevo-form" />
          <Attr name="data-company" value={safeCompany} />
          {!follow && (
            <>
              <Attr name="data-accent" value={accent} />
              <Attr name="data-color" value={text} />
            </>
          )}
          {!details && <Attr name="data-details" value="false" />}
          <At> async</At>
          <Tg>&gt;&lt;/script&gt;</Tg>
        </CodeBox>

        <div className="flex flex-col">
          <Option label="Colours" description="Panel and button colour, and the text on it. They follow your Brand colour unless you set them for this site.">
            <span className={`flex items-center gap-3 transition-opacity duration-200 ${follow ? "opacity-50" : ""}`}>
              <Chip hex={accent} />
              <Chip hex={text} />
            </span>
            <span className="flex items-center gap-2">
              <span className="text-[13px] text-ink-muted">Use Brand colour</span>
              <Switch checked={follow} onChange={(e) => setFollow(e.target.checked)} aria-label="Use the Brand colour" />
            </span>
          </Option>
          <Option label="Phone, address and hours" description="Show your contact details beside the form.">
            <Switch checked={details} onChange={(e) => setDetails(e.target.checked)} aria-label="Show contact details" />
          </Option>
        </div>

        <details className="group border-t border-hairline pt-3">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-[550] text-ink [&::-webkit-details-marker]:hidden">
            <ChevronRight className="size-3.5 text-ink-muted transition-transform duration-200 group-open:rotate-90" strokeWidth={2} aria-hidden="true" />
            Different colours in light and dark themes
          </summary>
          <div className="pt-2.5 text-[13.5px] leading-5 text-ink-muted">
            Set the two CSS variables in your site&apos;s CSS under each theme. The attributes in the code win when both are set.
            <CodeBox label="CSS" text=".dark { --alevo-accent: #ff8a3d; --alevo-color: #06091a; }" className="mt-2.5">
              <At>.dark</At> <Pn>{"{"}</Pn> <At>--alevo-accent</At>
              <Pn>:</Pn> <Vl>#ff8a3d</Vl>
              <Pn>;</Pn> <At>--alevo-color</At>
              <Pn>:</Pn> <Vl>#06091a</Vl>
              <Pn>;</Pn> <Pn>{"}"}</Pn>
            </CodeBox>
          </div>
        </details>
      </div>

      <div role="tabpanel" hidden={tab !== "own"} className="flex flex-col gap-5">
        <p className="text-[13.5px] leading-5 text-ink-muted">Already have a form? Point it at this endpoint. A plain HTML form post is sent on to the hosted thank-you page.</p>
        <div className="grid items-start gap-[18px] min-[700px]:grid-cols-[minmax(0,1fr)_210px]">
          <CodeBox label="Request" text={request}>
            <At>POST</At> <Vl>{endpoint}</Vl>
            {"\n"}
            <At>Content-Type</At>
            <Pn>:</Pn> application/json{"\n\n"}
            <Pn>{"{"}</Pn> <At>&quot;name&quot;</At>
            <Pn>:</Pn> <Vl>&quot;Pat Lee&quot;</Vl>
            <Pn>,</Pn> <At>&quot;email&quot;</At>
            <Pn>:</Pn> <Vl>&quot;pat@example.com&quot;</Vl>
            <Pn>,</Pn> <At>&quot;phone&quot;</At>
            <Pn>:</Pn> <Vl>&quot;&quot;</Vl>
            <Pn>,</Pn> <At>&quot;company&quot;</At>
            <Pn>:</Pn> <Vl>&quot;&quot;</Vl>
            <Pn>,</Pn> <At>&quot;message&quot;</At>
            <Pn>:</Pn> <Vl>&quot;Hi&quot;</Vl>
            <Pn>,</Pn> <At>&quot;consent&quot;</At>
            <Pn>:</Pn> <Tg>true</Tg> <Pn>{"}"}</Pn>
          </CodeBox>
          <div className="flex flex-col text-[13.5px]">
            <div className="pb-1.5 text-xs font-semibold uppercase tracking-[0.07em] text-ink-muted">Fields</div>
            {FIELDS.map((f) => (
              <div key={f.name} className="flex justify-between gap-2.5 border-t border-hairline py-1.5">
                <b className="font-mono text-[12.5px] font-medium text-ink">{f.name}</b>
                <span className={f.required ? "text-warning" : "text-ink-muted"}>{f.required ? "Required" : "Optional"}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2.5 text-xs font-semibold uppercase tracking-[0.07em] text-ink-muted">Responses</div>
          {RESPONSES.map((r) => (
            <div key={r.code} className="grid grid-cols-[44px_minmax(0,1.5fr)_minmax(0,1fr)] items-center gap-3.5 border-t border-hairline py-2 text-[13.5px] first:border-t-0">
              <span className={`font-mono font-semibold ${r.color}`}>{r.code}</span>
              <code className="font-mono text-[12.5px] text-ink-muted">{r.body}</code>
              <span className="text-ink-muted">{r.text}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function Option({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-hairline py-3 first:border-t-0 first:pt-0">
      <div>
        <span className="font-[550] text-ink">{label}</span>
        <span className="mt-px block text-[13px] leading-[19px] text-ink-muted">{description}</span>
      </div>
      <div className="flex items-center gap-3">{children}</div>
    </div>
  );
}

function Chip({ hex }: { hex: string }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[12.5px] text-ink">
      <i className="inline-block size-[18px] rounded-[5px] border border-control" style={{ background: hex }} aria-hidden="true" />
      {hex}
    </span>
  );
}
