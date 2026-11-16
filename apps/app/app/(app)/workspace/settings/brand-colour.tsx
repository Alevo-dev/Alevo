"use client";

import { Card, CardHeader } from "@/components/ui/card";
import { ColourField } from "@/components/ui/colour-picker";
import { chatTextColour, contrastRatio, normaliseHex } from "@/lib/colour";

const ALEVO_BLUE = "#2e9be6";

/**
 * The workspace's default colours: the brand colour and the font colour that goes on it, used by the website
 * form (the embed and the hosted page) and the chat bubble. Click a swatch for the picker (the hex field is in it).
 * It holds no form of its own: the Brand page's one form posts it (`accent` and `textColor`) and its bottom bar
 * saves and discards. A page can still override both with data-accent / data-color.
 */
export function BrandColour({
  color,
  text,
  onColor,
  onText,
  errors,
}: {
  color: string;
  text: string;
  onColor: (v: string) => void;
  onText: (v: string) => void;
  errors?: { accent?: string; textColor?: string };
}) {
  const liveAccent = normaliseHex(color) ?? ALEVO_BLUE;
  const autoText = chatTextColour(liveAccent);
  const typedText = normaliseHex(text);
  const weak = typedText !== null && contrastRatio(liveAccent, typedText) < 3;

  return (
    <Card as="section" padding="none" aria-label="Brand colour">
      <CardHeader title="Brand colour" hint="The default colours of the website form and the chat bubble." />
      <div className="space-y-5 py-3.5">
        <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
          <ColourField
            id="brandColour"
            name="accent"
            label="Colour"
            hint="Buttons, chat bubble, form panel. Blank: Alevo blue."
            value={color}
            onChange={onColor}
            emptyHex={ALEVO_BLUE}
            error={errors?.accent}
          />
          <ColourField
            id="brandText"
            name="textColor"
            label="Font colour"
            hint="The text on that colour. Blank: white or navy."
            value={text}
            onChange={onText}
            emptyHex={autoText}
            error={errors?.textColor}
          />
        </div>

        {/* A flat strip with a caption, not a button-shaped chip: it only shows the two colours together. */}
        <div>
          <div className="mb-1 text-label text-ink-muted">Preview</div>
          <div className="flex h-12 items-center rounded-xs px-3.5 text-sm font-bold" style={{ background: liveAccent, color: typedText ?? autoText }} aria-hidden="true">
            Text on your brand colour
          </div>
          {weak && typedText && (
            <p role="status" className="mt-2 text-label text-warning">
              Hard to read: this font colour is weak on this colour ({contrastRatio(liveAccent, typedText).toFixed(1)} to 1). Try a lighter or darker one.
            </p>
          )}
        </div>

        <p className="max-w-[640px] text-ink-muted">
          A page can still override them with <code className="font-mono">data-accent</code> and <code className="font-mono">data-color</code>.
        </p>
      </div>
    </Card>
  );
}
