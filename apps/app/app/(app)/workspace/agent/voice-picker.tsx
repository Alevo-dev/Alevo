"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { FieldError, Input } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { StatusDot } from "@/components/ui/pill";
import { PanelRow } from "@/components/workspace/panel-row";
import { cx } from "@/lib/cx";
import { VOICES } from "@/lib/voice/voices";

/**
 * The phone voices as two rows: a row of voices that wraps (a tile toggles it on; several can be on, each call uses one at
 * random, at least one stays on) each with its OWN play button for its sample (public/voices/<id>.mp3, from Vapi's
 * docs), then a name per voice that is on. The chips are
 * plain checkboxes named `voiceNames` and the name boxes stay in the form while hidden, so the
 * surrounding form posts them all and tracks unsaved changes by itself.
 */
export function VoicePicker({
  selected,
  labels,
  error,
  labelErrors,
}: {
  selected: readonly string[];
  labels: Record<string, string>;
  error?: string;
  labelErrors?: Record<string, string>;
}) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [on, setOn] = useState<string[]>(() => VOICES.map((v) => v.id).filter((id) => selected.includes(id)));

  useEffect(() => () => audio.current?.pause(), []);

  /** Play that voice's sample; pressing it again (or another voice) stops the one playing. */
  function sample(id: string) {
    audio.current?.pause();
    if (playing === id) {
      setPlaying(null);
      return;
    }
    const a = new Audio(`/voices/${id}.mp3`);
    a.addEventListener("ended", () => setPlaying((now) => (now === id ? null : now)));
    audio.current = a;
    setPlaying(id);
    a.play().catch(() => setPlaying((now) => (now === id ? null : now)));
  }

  return (
    <>
      <PanelRow label="Voices" hint="Each call uses one at random. Press play to hear a voice." error={error}>
        <div className="flex flex-wrap gap-2">
          {VOICES.map((v) => (
            <div
              key={v.id}
              title={v.gender}
              className={cx(
                "inline-flex h-8 items-center rounded-xs border pl-0.5 pr-0.5 transition-colors duration-150 ease-out focus-within:[box-shadow:var(--ds-focus-ring)]",
                on.includes(v.id) ? "border-brand bg-brand-soft text-ink" : "border-hairline bg-raised text-ink-muted hover:text-ink",
              )}
            >
              <label className="flex h-full cursor-pointer items-center pl-2.5 pr-1.5 text-[13.5px] font-[550]">
                <input
                  type="checkbox"
                  name="voiceNames"
                  value={v.id}
                  className="sr-only"
                  defaultChecked={selected.includes(v.id)}
                  onChange={(ev) => {
                    // At least one voice stays on: the last one cannot be switched off.
                    const form = ev.currentTarget.form;
                    if (form && form.querySelectorAll('input[name="voiceNames"]:checked').length === 0) ev.currentTarget.checked = true;
                    setOn(VOICES.map((x) => x.id).filter((id) => form?.querySelector<HTMLInputElement>(`input[name="voiceNames"][value="${id}"]`)?.checked));
                  }}
                />
                <span className="truncate">{v.id}</span>
              </label>
              <IconButton
                aria-label={playing === v.id ? `Stop the ${v.id} sample` : `Play a sample of ${v.id}`}
                title={playing === v.id ? "Stop" : "Play sample"}
                onClick={() => sample(v.id)}
                className="size-6 rounded-full"
              >
                {playing === v.id ? <Pause className="size-3.5" aria-hidden="true" /> : <Play className="size-3.5" aria-hidden="true" />}
              </IconButton>
            </div>
          ))}
        </div>
        <p role="status" aria-live="polite" className="mt-2 flex h-5 items-center gap-2 text-label text-ink-muted">
          {playing ? (
            <>
              <StatusDot tone="brand" live />
              Now playing: <span className="font-semibold text-ink">{playing}</span>
            </>
          ) : null}
        </p>
      </PanelRow>
      <PanelRow label="Voice names" hint="The agent goes by this name on that voice">
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {VOICES.map((v) => (
          <div key={v.id} hidden={!on.includes(v.id)}>
            <label className="flex items-center gap-2">
              <span className="w-[80px] shrink-0 text-right text-ink-muted">{v.id}</span>
              <Input
                name={`voiceLabel_${v.id}`}
                inline
                className="w-full min-w-0"
                defaultValue={labels[v.id] ?? ""}
                invalid={!!labelErrors?.[v.id]}
                maxLength={30}
                placeholder="Name (optional)"
                aria-label={`Name for ${v.id}`}
              />
            </label>
            <FieldError>{labelErrors?.[v.id]}</FieldError>
          </div>
        ))}
        </div>
      </PanelRow>
    </>
  );
}
