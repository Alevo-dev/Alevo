"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { SettingRow } from "@/components/ui/setting-row";
import { Switch } from "@/components/ui/switch";
import { cx } from "@/lib/cx";
import { chatTextColour } from "@/lib/colour";
import { useActionToast } from "@/lib/ui/use-action-toast";
import { saveChatWidget, type ChatWidgetState } from "./actions";
import { Snippet } from "./embed-snippets";

const INITIAL: ChatWidgetState = {};

type Position = "right" | "left";
const POSITIONS: { value: Position; label: string }[] = [
  { value: "right", label: "Bottom right" },
  { value: "left", label: "Bottom left" },
];

/** Where the bubble sits: two options, so a small radio group (arrow keys switch). Only changes the code below; nothing is saved. */
function PositionPicker({ value, onChange }: { value: Position; onChange: (p: Position) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div
      role="radiogroup"
      aria-label="Bubble position"
      className="inline-flex rounded-md border border-hairline p-0.5"
      onKeyDown={(e) => {
        if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
        e.preventDefault();
        const next = POSITIONS.findIndex((p) => p.value !== value);
        onChange(POSITIONS[next]!.value);
        refs.current[next]?.focus();
      }}
    >
      {POSITIONS.map((p, i) => (
        <button
          key={p.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={value === p.value}
          tabIndex={value === p.value ? 0 : -1}
          onClick={() => onChange(p.value)}
          className={cx(
            "rounded px-3 py-1.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ink",
            value === p.value ? "bg-brand text-on-brand" : "text-ink-muted hover:text-ink",
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

const OPTIONS: { name: string; text: string }[] = [
  { name: "data-position", text: '"right" or "left": which bottom corner the bubble sits in. Set with the picker above.' },
  {
    name: "data-accent",
    text: "Colour of the bubble, the header, your visitors' messages and the send button. Starts as your Brand colour; change it here for this site, or delete it to follow the Brand colour as it changes.",
  },
  {
    name: "data-color",
    text: "Colour of the text and icons on those. Starts as your font colour (top of this page), else white, or navy when the accent is light; delete it to let the chat choose.",
  },
  {
    name: "--alevo-accent / --alevo-color",
    text: "The same two colours as CSS variables in your site's CSS, for example a different pair under your dark theme (.dark { --alevo-accent: #ff8a3d; }). The attributes win when both are set.",
  },
];

/** What each part of the code does, so the snippet can be edited without guessing. */
function ChatOptions() {
  return (
    <section className="rounded-md border border-hairline px-4 py-4">
      <h3 className="font-sans text-sm font-semibold text-ink">What the settings in the code do</h3>
      <dl className="mt-3 grid gap-x-4 gap-y-3 text-label sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]">
        {OPTIONS.map((o) => (
          <div key={o.name} className="contents">
            <dt className="font-mono text-ink">{o.name}</dt>
            <dd className="text-ink-muted">{o.text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * The chat widget in one place: on/off, greeting (one Save + Cancel, shown once
 * something changed), the bubble position, and ONE install snippet that already
 * carries position, accent and text colour, so nothing is left to look up.
 * `accent` is the colour the chat uses today (Brand colour, else Alevo blue).
 */
export function ChatWidgetForm({
  enabled,
  greeting,
  agentName,
  src,
  orgId,
  accent,
  textColor,
  canModify,
}: {
  enabled: boolean;
  greeting: string;
  agentName: string;
  src: string;
  orgId: string;
  accent: string;
  /** The font colour saved with the Brand colour, or "" for automatic. */
  textColor: string;
  canModify: boolean;
}) {
  const [on, setOn] = useState(enabled);
  const [text, setText] = useState(greeting);
  const [name, setName] = useState(agentName);
  const [position, setPosition] = useState<Position>("right");
  const [state, action, pending] = useActionState(saveChatWidget, INITIAL);
  useActionToast(state, "Chat widget saved.");

  const saved = state.values ?? { enabled, greeting, agentName };
  const dirty = on !== saved.enabled || text.trim() !== saved.greeting || name.trim() !== saved.agentName;

  return (
    <div className="space-y-6">
      <form action={action} noValidate>
        {/* The on / off switch lives in the dialog's top-right corner, on the title line. No ancestor here is positioned, so
            it is placed against the dialog panel; it is still inside this form, so Save and Cancel cover it. */}
        <div className="absolute right-6 top-6 flex h-7 items-center gap-2">
          <span aria-hidden="true" className="text-label text-ink-muted">
            {on ? "On" : "Off"}
          </span>
          <Switch
            id="chatEnabled"
            name="enabled"
            aria-label="Show the chat bubble"
            checked={on}
            onChange={(e) => setOn(e.target.checked)}
            disabled={!canModify}
          />
        </div>
        <SettingRow
          label="Agent name"
          htmlFor="agentName"
          hint="The name at the top of the chat window, instead of your company name. The agent uses it too when it introduces itself."
          error={state.errors?.agentName}
        >
          <Input
            id="agentName"
            name="agentName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            invalid={!!state.errors?.agentName}
            disabled={!canModify}
            placeholder="Your company name"
            maxLength={40}
          />
        </SettingRow>
        <SettingRow label="Greeting" htmlFor="greeting" hint="The first line visitors see when they open the chat." error={state.errors?.greeting}>
          <Input
            id="greeting"
            name="greeting"
            value={text}
            onChange={(e) => setText(e.target.value)}
            invalid={!!state.errors?.greeting}
            disabled={!canModify}
            placeholder="Hi! How can we help today?"
            maxLength={200}
          />
        </SettingRow>
        {state.error && <p className="mt-4 text-sm text-danger">{state.error}</p>}

        {canModify && dirty && (
          <div className="mt-5 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setOn(saved.enabled);
                setText(saved.greeting);
                setName(saved.agentName);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Save
            </Button>
          </div>
        )}
      </form>

      <div className="space-y-4">
        <SettingRow label="Bubble position" hint="Where the bubble sits on your site. The code below changes to match; this is not saved.">
          <PositionPicker value={position} onChange={setPosition} />
        </SettingRow>
        <Snippet
          title="Add to your site"
          hint="Paste before </body> on every page where the bubble should appear. It already has your position and colours in it: change them in the code for one site."
          code={`<script src="${src}" data-org="${orgId}" data-position="${position}" data-accent="${accent}" data-color="${textColor || chatTextColour(accent)}" async></script>`}
        />
      </div>
      <ChatOptions />
      <p className="text-label text-ink-muted">
        The bubble and buttons use your Brand colour (top of this page). Each chat opens a conversation the agent works, counted like any other inbound conversation. Once the visitor shares an email and leaves the
        page, replies carry on by email.
      </p>
    </div>
  );
}
