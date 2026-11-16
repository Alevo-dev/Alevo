"use client";

import { useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Syntax colours for the snippets: a tag, an attribute, punctuation, a value. */
export const Tg = ({ children }: { children: ReactNode }) => <span className="text-brand-ink">{children}</span>;
export const At = ({ children }: { children: ReactNode }) => <span className="text-ink">{children}</span>;
export const Pn = ({ children }: { children: ReactNode }) => <span className="text-ink-muted">{children}</span>;
export const Vl = ({ children }: { children: ReactNode }) => <span className="text-warning">{children}</span>;

/** One `name="value"` attribute, coloured. */
export function Attr({ name, value }: { name: string; value: string }) {
  return (
    <>
      {" "}
      <At>{name}</At>
      <Pn>=</Pn>
      <Vl>&quot;{value}&quot;</Vl>
    </>
  );
}

/** The text of a `<script>` tag with one attribute per line (the copied code reads the same as it is shown). */
export function scriptText(attrs: [string, string][], flags: string[] = ["async"]): string {
  return ["<script", ...attrs.map(([n, v]) => `  ${n}="${v}"`), ...flags.map((f) => `  ${f}`), "></script>"].join("\n");
}

/** The same `<script>` tag, coloured: tag, then each attribute on its own indented line. */
export function ScriptTag({ attrs, flags = ["async"] }: { attrs: [string, string][]; flags?: string[] }) {
  return (
    <>
      <Tg>&lt;script</Tg>
      {attrs.map(([n, v]) => (
        <span key={n}>
          {"\n  "}
          <At>{n}</At>
          <Pn>=</Pn>
          <Vl>&quot;{v}&quot;</Vl>
        </span>
      ))}
      {flags.map((f) => (
        <span key={f}>
          {"\n  "}
          <At>{f}</At>
        </span>
      ))}
      {"\n"}
      <Tg>&gt;&lt;/script&gt;</Tg>
    </>
  );
}

/**
 * A copyable code block (the boards' `.code`): a bar with the language and a Copy button, then the code in mono.
 * `text` is what Copy puts on the clipboard; `children` is the same code drawn with colours.
 */
export function CodeBox({ label, text, children, className }: { label: string; text: string; children: ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Select the text and copy it instead.");
    }
  }

  return (
    <div className={`overflow-hidden rounded-[8px] border border-hairline bg-canvas ${className ?? ""}`}>
      <div className="flex items-center gap-2.5 border-b border-hairline bg-sunken py-1.5 pl-3.5 pr-1.5">
        <span className="text-xs font-semibold uppercase tracking-[0.07em] text-ink-muted">{label}</span>
        <span className="flex-1" />
        <Button size="sm" className="h-7 px-2.5 text-[13px]" onClick={copy} aria-label={`Copy the ${label} code`}>
          {copied ? <Check className="size-3.5 text-ink-muted" aria-hidden="true" /> : <Copy className="size-3.5 text-ink-muted" aria-hidden="true" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="m-0 overflow-x-auto whitespace-pre px-4 py-3.5 font-mono text-[12.5px] leading-[1.75] text-ink-muted">
        <code>{children}</code>
      </pre>
    </div>
  );
}
