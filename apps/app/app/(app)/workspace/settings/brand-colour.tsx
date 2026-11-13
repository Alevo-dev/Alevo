"use client";

import { useActionState, useState } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ColourField } from "@/components/ui/colour-picker";
import { Dialog } from "@/components/ui/dialog";
import { chatTextColour, contrastRatio, normaliseHex } from "@/lib/colour";
import { useActionToast } from "@/lib/ui/use-action-toast";
import { saveBrandColour, type BrandColourState } from "../integrations/actions";

const INITIAL: BrandColourState = {};
const ALEVO_BLUE = "#2e9be6";
const norm = (v: string) => normaliseHex(v) ?? v.trim().toLowerCase();

/** One colour in the summary: the swatch, what it is, and its hex (or "Default" with the colour that applies). */
function Chip({ label, hex, fallbackHex, fallbackName }: { label: string; hex: string; fallbackHex: string; fallbackName: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className={`size-10 shrink-0 rounded-md border-2 ${hex ? "border-hairline" : "border-dashed border-ink-muted"}`}
        style={{ background: hex || fallbackHex }}
      />
      <div>
        <dt className="text-label text-ink-muted">{label}</dt>
        <dd className="font-mono text-sm text-ink">{hex || <span className="font-sans text-ink-muted">Default ({fallbackName})</span>}</dd>
      </div>
    </div>
  );
}

/**
 * The workspace's default colours: the brand colour and the font colour that goes on it, used by the website
 * form (the embed and the hosted page) and the chat bubble. A read-only summary (swatches, not a button-shaped
 * preview) with a gear that opens the dialog where each colour is a swatch + hex field (the swatch opens the
 * picker). A page can still override both with data-accent / data-color.
 */
export function BrandColour({ accent, textColor, canModify }: { accent: string; textColor: string; canModify: boolean }) {
  const [open, setOpen] = useState(false);
  // The action state when the dialog was opened: a newer successful save closes it, with no effect needed.
  const [openedOn, setOpenedOn] = useState<BrandColourState | null>(null);
  const [color, setColor] = useState(accent);
  const [text, setText] = useState(textColor);
  const [state, action, pending] = useActionState(saveBrandColour, INITIAL);
  useActionToast(state, "Brand colours saved.");

  const saved = state.values ?? { accent, textColor };
  const dirty = norm(color) !== saved.accent || norm(text) !== saved.textColor;
  const visible = open && !(state.ok && state !== openedOn);

  function close() {
    setOpen(false);
    setColor(saved.accent);
    setText(saved.textColor);
  }

  // The pair as a button will wear it: live while editing, the saved pair in the summary.
  const savedAccentHex = normaliseHex(saved.accent) ?? "";
  const savedTextHex = normaliseHex(saved.textColor) ?? "";
  const liveAccent = normaliseHex(color) ?? ALEVO_BLUE;
  const autoText = chatTextColour(liveAccent);
  const typedText = normaliseHex(text);
  const weak = typedText !== null && contrastRatio(liveAccent, typedText) < 3;
  const summaryText = savedTextHex || chatTextColour(savedAccentHex || ALEVO_BLUE);
  const err = dirty ? state.errors : undefined;

  return (
    <Card as="section" padding="md" aria-labelledby="brand-colour">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id="brand-colour" className="text-heading font-semibold text-ink">
            Brand colour
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            The default colours of the website form and the chat bubble. A page can still override them with <code className="font-mono">data-accent</code> and{" "}
            <code className="font-mono">data-color</code>.
          </p>
        </div>
        {canModify && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              setOpenedOn(state);
              setOpen(true);
            }}
          >
            <Settings className="size-4" strokeWidth={1.75} aria-hidden="true" />
            <span className="sr-only">Brand colour settings</span>
          </Button>
        )}
      </div>

      <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-4">
        <Chip label="Colour" hex={savedAccentHex} fallbackHex={ALEVO_BLUE} fallbackName="Alevo blue" />
        <Chip label="Font colour" hex={savedTextHex} fallbackHex={summaryText} fallbackName="white or navy" />
      </dl>

      <Dialog
        open={visible}
        onClose={close}
        title="Brand colour"
        description="Used by the website form (the embed and the hosted page) and the chat bubble. Type a hex code like #ff6a00, or click the colour to pick one."
        footer={
          <>
            <Button type="button" variant="ghost" onClick={close} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" form="brand-colour-form" loading={pending} disabled={!dirty}>
              Save
            </Button>
          </>
        }
      >
        <form id="brand-colour-form" action={action} noValidate className="space-y-6">
          <ColourField
            id="brandColour"
            name="accent"
            label="Colour"
            hint="Buttons, the chat bubble and header, the form's coloured panel. Blank: Alevo blue."
            value={color}
            onChange={setColor}
            emptyHex={ALEVO_BLUE}
            error={err?.accent}
          />
          <ColourField
            id="brandText"
            name="textColor"
            label="Font colour"
            hint="The text on that colour. Blank: white or navy, chosen for you."
            value={text}
            onChange={setText}
            emptyHex={autoText}
            error={err?.textColor}
          />

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-hairline pt-5">
            <span className="rounded-md px-4 py-2 text-sm font-semibold" style={{ background: liveAccent, color: typedText ?? autoText }} aria-hidden="true">
              Aa Sample text
            </span>
            {weak && typedText && (
              <p role="status" className="basis-full text-label text-warning">
                Hard to read: this font colour is weak on this colour ({contrastRatio(liveAccent, typedText).toFixed(1)} to 1). Try a lighter or darker one.
              </p>
            )}
          </div>
          {state.error && <p className="text-sm text-danger">{state.error}</p>}
        </form>
      </Dialog>
    </Card>
  );
}
