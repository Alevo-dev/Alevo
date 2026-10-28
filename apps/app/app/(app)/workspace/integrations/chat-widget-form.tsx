"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { SettingRow } from "@/components/ui/setting-row";
import { Switch } from "@/components/ui/switch";
import { useActionToast } from "@/lib/ui/use-action-toast";
import { saveChatWidget, type ChatWidgetState } from "./actions";
import { Snippet } from "./embed-snippets";

const INITIAL: ChatWidgetState = {};
const HEX = /^#[0-9a-f]{6}$/i;

/**
 * The chat widget in one place: on/off, greeting, colour (one Save + Cancel,
 * shown once something changed) and the one-line snippet for the site.
 */
export function ChatWidgetForm({
  enabled,
  greeting,
  accent,
  snippet,
  canModify,
}: {
  enabled: boolean;
  greeting: string;
  accent: string;
  snippet: string;
  canModify: boolean;
}) {
  const [on, setOn] = useState(enabled);
  const [text, setText] = useState(greeting);
  const [color, setColor] = useState(accent);
  const [state, action, pending] = useActionState(saveChatWidget, INITIAL);
  useActionToast(state, "Chat widget saved.");

  const saved = state.values ?? { enabled, greeting, accent };
  const dirty = on !== saved.enabled || text.trim() !== saved.greeting || color.trim().toLowerCase() !== saved.accent;

  return (
    <div className="space-y-6">
      <form action={action} noValidate>
        <SettingRow label="Show the chat bubble" htmlFor="chatEnabled" hint="Off hides the bubble on your site without touching the script.">
          <Switch id="chatEnabled" name="enabled" checked={on} onChange={(e) => setOn(e.target.checked)} disabled={!canModify} />
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
        <SettingRow
          label="Colour"
          htmlFor="accent"
          hint="The bubble and buttons. A hex colour like #2e9be6; blank keeps Alevo blue."
          error={state.errors?.accent}
        >
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="size-9 shrink-0 rounded-sm border border-hairline"
              style={{ background: HEX.test(color.trim()) ? color.trim() : "var(--color-brand)" }}
            />
            <Input
              id="accent"
              name="accent"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              invalid={!!state.errors?.accent}
              disabled={!canModify}
              placeholder="#2e9be6"
              className="max-w-40 font-mono"
            />
          </div>
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
                setColor(saved.accent);
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

      <Snippet
        title="Add to your site"
        hint='Paste before </body> on every page where the bubble should appear. Add data-position="left" to move it.'
        code={snippet}
      />
      <p className="text-label text-ink-muted">
        Each chat opens a conversation the agent works, counted like any other inbound conversation. Once the visitor shares an email and leaves the
        page, replies carry on by email.
      </p>
    </div>
  );
}
