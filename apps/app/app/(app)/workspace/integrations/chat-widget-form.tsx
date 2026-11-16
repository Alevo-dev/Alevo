"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, CornerDownLeft, CornerDownRight, ImagePlus, MessageCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { CodeBox, ScriptTag, scriptText } from "@/components/workspace/code-box";
import { DialogFooter, DialogHeaderRight, useCloseOnSave } from "@/components/workspace/tool-dialog";
import { cx } from "@/lib/cx";
import { AVATAR_SIZE_LABEL, AVATAR_SIZES, type AvatarSize } from "@/lib/chat/avatar";
import { toAvatarWebp } from "@/lib/chat/avatar-client";
import { chatTextColour } from "@/lib/colour";
import { useActionToast } from "@/lib/ui/use-action-toast";
import { saveChatWidget, type ChatWidgetState } from "./actions";

const INITIAL: ChatWidgetState = {};
const FORM_ID = "chat-widget-form";

type Position = "right" | "left";
const POSITIONS: { value: Position; label: string; Icon: typeof CornerDownRight }[] = [
  { value: "left", label: "Bottom left", Icon: CornerDownLeft },
  { value: "right", label: "Bottom right", Icon: CornerDownRight },
];

/** Where the bubble sits: a segmented pair (arrow keys switch). It only changes the code below; nothing is saved. */
function PositionPicker({ value, onChange }: { value: Position; onChange: (p: Position) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div
      role="radiogroup"
      aria-label="Bubble position"
      className="inline-flex rounded-[8px] border border-control bg-sunken p-0.5"
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
            "inline-flex h-[30px] cursor-pointer items-center gap-2 rounded-xs px-3 text-[13.5px] font-[550] outline-none transition-[background-color,color,transform] duration-150 ease-out focus-visible:[box-shadow:var(--ds-focus-ring)] active:scale-[0.97]",
            value === p.value ? "bg-brand-soft text-ink shadow-[inset_0_0_0_1px_var(--ds-brand)]" : "text-ink-muted hover:text-ink",
          )}
        >
          <p.Icon className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
          {p.label}
        </button>
      ))}
    </div>
  );
}

const OPTIONS: { name: string; text: string }[] = [
  { name: "data-position", text: "Which bottom corner the bubble sits in. Set with the picker above." },
  { name: "data-accent", text: "Colour of the bubble, header, visitor messages and send button. Delete it to follow your Brand colour." },
  { name: "data-color", text: "Colour of the text and icons on the accent. Delete it to let the chat pick a readable one." },
  { name: "--alevo-accent, --alevo-color", text: "The same two colours as CSS variables, for a different pair in your dark theme. The attributes win when both are set." },
];

/** A scaled-down copy of what visitors see: a page, the chat window and the bubble, in the workspace's colours. */
function Preview({ name, greeting, accent, text, position, on, avatar, avatarPx }: { name: string; greeting: string; accent: string; text: string; position: Position; on: boolean; avatar: string | null; avatarPx: number }) {
  const self = position === "right" ? "self-end" : "self-start";
  return (
    <div className={cx("flex h-[420px] flex-col gap-2.5 overflow-hidden rounded-[10px] border border-hairline bg-canvas p-3.5 transition-opacity duration-200", !on && "opacity-40")}>
      {/* The page behind the chat: it gives way first when the window grows, so the window itself is never clipped. */}
      <div className="flex min-h-0 shrink flex-col gap-1.5 overflow-hidden" aria-hidden="true">
        {["55%", "80%", "38%"].map((w) => (
          <i key={w} className="block h-[7px] rounded bg-raised" style={{ width: w }} />
        ))}
      </div>
      <div className={cx("mt-auto w-[244px] max-w-full shrink-0 overflow-hidden rounded-xl bg-[#f6f8fc] shadow-[0_10px_30px_rgba(0,0,0,.35)] transition-[align-self]", self)}>
        <div className="flex items-center gap-2 px-3 py-[9px] text-[13px] font-semibold" style={{ background: accent, color: text }}>
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element -- a local or same-origin preview, not an optimised page image
            <img src={avatar} alt="" className="shrink-0 rounded-full object-contain" style={{ width: avatarPx, height: avatarPx }} />
          ) : (
            <span className="flex shrink-0 items-center justify-center rounded-full bg-black/15 text-[11px]" style={{ width: avatarPx, height: avatarPx }}>
              {name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="min-w-0 truncate">
            {name}
            <small className="block text-[11px] font-medium leading-3 opacity-80">Online</small>
          </span>
        </div>
        <div className="flex flex-col gap-1.5 px-3 py-2.5 text-[12.5px] leading-[17px] text-[#17213a]">
          <div className="max-w-[84%] rounded-[10px_10px_10px_3px] bg-[#e3e9f4] px-[9px] py-[5px]">{greeting}</div>
          <div className="max-w-[84%] self-end rounded-[10px_10px_3px_10px] px-[9px] py-[5px]" style={{ background: accent, color: text }}>
            Do you cover Ottawa?
          </div>
          <div className="max-w-[84%] rounded-[10px_10px_10px_3px] bg-[#e3e9f4] px-[9px] py-[5px]">Yes, we do. Want me to book a call?</div>
        </div>
        <div className="mx-3 mb-2.5 rounded-[8px] border border-[#cbd5e6] px-[9px] py-[5px] text-[12.5px] text-[#6b7690]">Type a message</div>
      </div>
      <div className={cx("flex size-11 items-center justify-center rounded-full shadow-[0_8px_20px_rgba(0,0,0,.4)] transition-[align-self]", self)} style={{ background: accent, color: text }} aria-hidden="true">
        <MessageCircle className="size-5" strokeWidth={2} />
      </div>
    </div>
  );
}

/**
 * The chat widget's window (the Integrations board): the on / off switch beside the close button, the two
 * fields and the bubble position on the left, a live preview on the right, then the one install snippet with
 * what each setting in it does. One Save: while something is unsaved the footer shows "N unsaved changes",
 * Discard and Save changes in place of the note and Done.
 */
export function ChatWidgetForm({
  enabled,
  greeting,
  agentName,
  avatarUrl,
  avatarSize,
  company,
  src,
  orgId,
  accent,
  textColor,
  canModify,
}: {
  enabled: boolean;
  greeting: string;
  agentName: string;
  /** The saved picture (served by this app), or null. */
  avatarUrl: string | null;
  avatarSize: AvatarSize;
  /** The name the window shows while no agent name is set. */
  company: string;
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
  const [size, setSize] = useState<AvatarSize>(avatarSize);
  // A picture chosen and not saved yet (already shrunk), and whether the saved one is to be removed.
  const [picked, setPicked] = useState<{ url: string } | null>(null);
  const [removed, setRemoved] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const pickRef = useRef<HTMLInputElement>(null);
  const [state, action, pending] = useActionState(saveChatWidget, INITIAL);
  useActionToast(state, "Chat widget saved.");
  useCloseOnSave(state);

  const saved = state.values ?? { enabled, greeting, agentName, avatarSize };
  const changed = [
    on !== saved.enabled && "Chat bubble",
    name.trim() !== saved.agentName && "Agent name",
    text.trim() !== saved.greeting && "Greeting",
    (picked || removed) && "Avatar",
    size !== saved.avatarSize && "Avatar size",
  ].filter(Boolean) as string[];
  const shownAvatar = picked?.url ?? (removed ? null : avatarUrl);
  const dirty = changed.length > 0;
  const ink = textColor || chatTextColour(accent);
  const shownName = name.trim() || company;
  const shownGreeting = text.trim() || "Hi! How can we help today?";
  const attrs: [string, string][] = [
    ["src", src],
    ["data-org", orgId],
    ["data-position", position],
    ["data-accent", accent],
    ["data-color", ink],
  ];
  const code = scriptText(attrs);

  function clearPick() {
    if (picked) URL.revokeObjectURL(picked.url);
    setPicked(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  /** Shrink the chosen image, put the result in the form's file field and show it. */
  async function pickFile(file: File | undefined) {
    if (!file) return;
    setAvatarError("");
    try {
      const small = await toAvatarWebp(file);
      const transfer = new DataTransfer();
      transfer.items.add(small);
      if (fileRef.current) fileRef.current.files = transfer.files;
      if (picked) URL.revokeObjectURL(picked.url);
      setPicked({ url: URL.createObjectURL(small) });
      setRemoved(false);
    } catch {
      setAvatarError("That image could not be read. Try a PNG, JPEG or WebP picture.");
    }
  }

  function discard() {
    setOn(saved.enabled);
    setText(saved.greeting);
    setName(saved.agentName);
    setSize(saved.avatarSize);
    setRemoved(false);
    setAvatarError("");
    clearPick();
  }

  return (
    <>
      <DialogHeaderRight>
        <span className="text-[13px] text-ink-muted">Show chat bubble</span>
        <span aria-hidden="true" className="min-w-5 text-[13px] font-[550] text-ink">
          {on ? "On" : "Off"}
        </span>
        <Switch form={FORM_ID} name="enabled" aria-label="Show the chat bubble" checked={on} onChange={(e) => setOn(e.target.checked)} disabled={!canModify} />
      </DialogHeaderRight>

      <div className="grid gap-7 min-[760px]:grid-cols-[minmax(0,1fr)_290px]">
        <form id={FORM_ID} action={action} noValidate className="flex min-w-0 flex-col gap-4">
          <div>
            <label htmlFor="agentName" className="mb-0.5 block font-semibold text-ink">
              Agent name
            </label>
            <p className="mb-2 text-[13px] leading-[19px] text-ink-muted">Shown at the top of the chat window. The agent uses it when it introduces itself.</p>
            <Input id="agentName" name="agentName" value={name} onChange={(e) => setName(e.target.value)} invalid={!!state.errors?.agentName} disabled={!canModify} placeholder={company} maxLength={40} />
            <FieldError>{state.errors?.agentName}</FieldError>
          </div>
          <div>
            <div className="mb-0.5 font-semibold text-ink">Avatar</div>
            <p className="mb-2 text-[13px] leading-[19px] text-ink-muted">A picture at the top of the chat window instead of the first letter, shown in a circle with a transparent background. We resize and compress it for you, and never stretch it. Best: a square picture (1:1), at least 256 × 256 px. PNG, JPEG or WebP.</p>
            <div className="flex items-center gap-3">
              {shownAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element -- a local or same-origin preview
                <img src={shownAvatar} alt="Current avatar" className="size-14 shrink-0 rounded-full border border-hairline object-contain" />
              ) : (
                <span className="flex size-14 shrink-0 items-center justify-center rounded-full border border-hairline bg-raised text-lg font-semibold text-ink-muted" aria-hidden="true">
                  {shownName.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" onClick={() => pickRef.current?.click()} disabled={!canModify}>
                  <ImagePlus className="size-3.5 text-ink-muted" strokeWidth={1.75} aria-hidden="true" />
                  {shownAvatar ? "Replace image" : "Upload image"}
                </Button>
                {shownAvatar && canModify && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      clearPick();
                      setRemoved(true);
                    }}
                  >
                    <Trash2 className="size-3.5 text-ink-muted" strokeWidth={1.75} aria-hidden="true" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
            {/* The file the form posts: set from the shrunk copy above. The picker is separate so the original never uploads. */}
            <input ref={fileRef} type="file" name="avatar" className="sr-only" tabIndex={-1} aria-hidden="true" />
            <input ref={pickRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ""; }} />
            <input type="hidden" name="removeAvatar" value={removed ? "1" : ""} />
            <input type="hidden" name="avatarSize" value={size} />
            <FieldError>{avatarError || state.errors?.avatar}</FieldError>
            <div className="mt-3">
              <div className="mb-1.5 text-[13px] text-ink-muted">Size in the chat header</div>
              <div role="radiogroup" aria-label="Avatar size" className="inline-flex rounded-[8px] border border-control bg-sunken p-0.5">
                {(Object.keys(AVATAR_SIZES) as AvatarSize[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={size === s}
                    disabled={!canModify}
                    onClick={() => setSize(s)}
                    className={cx(
                      "inline-flex h-[30px] cursor-pointer items-center rounded-xs px-3 text-[13.5px] font-[550] outline-none transition-[background-color,color,transform] duration-150 ease-out focus-visible:[box-shadow:var(--ds-focus-ring)] active:scale-[0.97]",
                      size === s ? "bg-brand-soft text-ink shadow-[inset_0_0_0_1px_var(--ds-brand)]" : "text-ink-muted hover:text-ink",
                    )}
                  >
                    {AVATAR_SIZE_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label htmlFor="greeting" className="mb-0.5 flex items-center font-semibold text-ink">
              Greeting
              <span className="ml-auto text-[12.5px] font-normal text-ink-muted">{text.length} of 200</span>
            </label>
            <p className="mb-2 text-[13px] leading-[19px] text-ink-muted">The first line visitors see when they open the chat.</p>
            <Input id="greeting" name="greeting" value={text} onChange={(e) => setText(e.target.value)} invalid={!!state.errors?.greeting} disabled={!canModify} placeholder="Hi! How can we help today?" maxLength={200} />
            <FieldError>{state.errors?.greeting}</FieldError>
          </div>
          <div>
            <div className="mb-0.5 font-semibold text-ink">Bubble position</div>
            <p className="mb-2 text-[13px] leading-[19px] text-ink-muted">Which corner the bubble sits in. This changes the code below and is not saved.</p>
            <PositionPicker value={position} onChange={setPosition} />
          </div>
          {state.error && <p className="text-sm text-danger">{state.error}</p>}
        </form>

        <div className="flex flex-col">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.07em] text-ink-muted">Preview</span>
            <Link href="/workspace/settings" className="text-[13px] font-[550]">
              Colours: Brand colour
            </Link>
          </div>
          <Preview name={shownName} greeting={shownGreeting} accent={accent} text={ink} position={position} on={on} avatar={shownAvatar} avatarPx={shownAvatar ? AVATAR_SIZES[size] : 40} />
        </div>
      </div>

      <div>
        <div className="mb-2.5 text-xs font-semibold uppercase tracking-[0.07em] text-ink-muted">Add to your site</div>
        <p className="mb-2.5 text-[13.5px] leading-5 text-ink-muted">
          Paste before <span className="font-mono text-ink">&lt;/body&gt;</span> on every page where the bubble should appear. Position and colours are already in it.
        </p>
        <CodeBox label="HTML" text={code}>
          <ScriptTag attrs={attrs} />
        </CodeBox>
      </div>

      <details className="group border-t border-hairline pt-3">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-[550] text-ink [&::-webkit-details-marker]:hidden">
          <ChevronRight className="size-3.5 text-ink-muted transition-transform duration-200 group-open:rotate-90" strokeWidth={2} aria-hidden="true" />
          What each setting in the code does
        </summary>
        <dl className="grid gap-x-4 gap-y-2.5 pt-2.5 text-[13.5px] leading-5 text-ink-muted min-[700px]:grid-cols-[200px_minmax(0,1fr)]">
          {OPTIONS.map((o) => (
            <div key={o.name} className="contents">
              <dt className="font-mono text-[12.5px] text-ink">{o.name}</dt>
              <dd className="m-0">{o.text}</dd>
            </div>
          ))}
        </dl>
      </details>

      {canModify && dirty && (
        <DialogFooter>
          <span role="region" aria-label="Unsaved changes" className="inline-flex items-center gap-2 font-[550] text-warning">
            <i className="size-[7px] rounded-full bg-warning" aria-hidden="true" />
            {dirty && `${changed.length} unsaved ${changed.length === 1 ? "change" : "changes"}`}
          </span>
          <span className="truncate text-ink-muted">{changed.join(", ")}</span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={discard}
            disabled={pending}
            className="cursor-pointer rounded-xs px-1.5 font-[550] text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:[box-shadow:var(--ds-focus-ring)] disabled:opacity-50"
          >
            Discard
          </button>
          <Button type="submit" form={FORM_ID} variant="primary" loading={pending}>
            {!pending && <Check className="size-3.5" strokeWidth={2} aria-hidden="true" />}
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      )}
    </>
  );
}
