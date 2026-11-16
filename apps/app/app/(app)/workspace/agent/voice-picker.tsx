"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input } from "@/components/ui/field";
import { PanelRow } from "@/components/workspace/panel-row";
import { cx } from "@/lib/cx";
import { VOICES } from "@/lib/voice/voices";

/**
 * The phone voices as two rows: a chip per voice (several can be on; each call uses one at
 * random, at least one stays on) with one Play sample button for the voice you touched last
 * (public/voices/<id>.mp3, from Vapi's docs), then a name per voice that is on. The chips are
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
  const [focus, setFocus] = useState<string>(() => on[0] ?? VOICES[0].id);

  useEffect(() => () => audio.current?.pause(), []);

  function sample() {
    audio.current?.pause();
    if (playing) {
      setPlaying(null);
      return;
    }
    const id = focus;
    const a = new Audio(`/voices/${id}.mp3`);
    a.addEventListener("ended", () => setPlaying((now) => (now === id ? null : now)));
    audio.current = a;
    setPlaying(id);
    a.play().catch(() => setPlaying((now) => (now === id ? null : now)));
  }

  return (
    <>
      <PanelRow label="Voices" hint="Each call uses one at random" error={error}>
        {VOICES.map((v) => (
          <label key={v.id} title={v.gender} className="cursor-pointer">
            <input
              type="checkbox"
              name="voiceNames"
              value={v.id}
              className="peer sr-only"
              defaultChecked={selected.includes(v.id)}
              onChange={(ev) => {
                // At least one voice stays on: the last one cannot be switched off.
                const form = ev.currentTarget.form;
                if (form && form.querySelectorAll('input[name="voiceNames"]:checked').length === 0) ev.currentTarget.checked = true;
                setOn(VOICES.map((x) => x.id).filter((id) => form?.querySelector<HTMLInputElement>(`input[name="voiceNames"][value="${id}"]`)?.checked));
                setFocus(v.id);
              }}
            />
            <span
              className={cx(
                "inline-flex h-[22px] items-center rounded-[5px] border px-2 text-[13px] transition-colors duration-150 ease-out peer-focus-visible:[box-shadow:var(--ds-focus-ring)]",
                on.includes(v.id) ? "border-brand bg-brand-soft text-ink" : "border-hairline bg-raised text-ink-muted hover:text-ink",
              )}
            >
              {v.id}
            </span>
          </label>
        ))}
        <Button size="sm" onClick={sample} aria-label={playing ? `Stop the ${focus} sample` : `Play a sample of ${focus}`}>
          {playing ? <Pause className="size-3.5" aria-hidden="true" /> : <Play className="size-3.5" aria-hidden="true" />}
          {playing ? "Stop" : "Play sample"}
        </Button>
      </PanelRow>
      <PanelRow label="Voice names" hint="The agent goes by this name on that voice">
        {VOICES.map((v) => (
          <div key={v.id} hidden={!on.includes(v.id)}>
            <label className="flex items-center gap-1.5">
              <span className="text-ink-muted">{v.id}</span>
              <Input
                name={`voiceLabel_${v.id}`}
                inline
                className="w-40"
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
      </PanelRow>
    </>
  );
}
