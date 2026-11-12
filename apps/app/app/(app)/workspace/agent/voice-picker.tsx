"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { FieldError, Hint, Input } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Switch } from "@/components/ui/switch";
import { VOICES } from "@/lib/voice/voices";

/**
 * The phone voices: a switch per voice (several can be on; each call uses one at
 * random, at least one stays on) and a play button for its sample
 * (public/voices/<id>.mp3, from Vapi's docs). Plain checkboxes named `voiceNames`,
 * so the surrounding form posts them and tracks unsaved changes by itself.
 */
export function VoicePicker({ selected, labels, errors }: { selected: readonly string[]; labels: Record<string, string>; errors?: Record<string, string> }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => () => audio.current?.pause(), []);

  function toggle(id: string) {
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
    <div>
      <Hint>If you turn on more than one voice, each call uses one of them, picked at random.</Hint>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {VOICES.map((v) => (
          <li key={v.id} className="space-y-2 rounded-md border border-hairline px-3 py-2">
            <div className="flex items-center gap-3">
              <Switch
                name="voiceNames"
                value={v.id}
                aria-label={`Use ${v.id}`}
                defaultChecked={selected.includes(v.id)}
                onChange={(ev) => {
                  // At least one voice stays on: the last one cannot be switched off.
                  const on = ev.currentTarget.form?.querySelectorAll('input[name="voiceNames"]:checked').length ?? 0;
                  if (on === 0) ev.currentTarget.checked = true;
                }}
              />
              <span className="min-w-0 flex-1 text-ink">
                {v.id} <span className="text-ink-muted">· {v.gender}</span>
              </span>
              <IconButton
                onClick={() => toggle(v.id)}
                aria-label={playing === v.id ? `Stop the ${v.id} sample` : `Play a sample of ${v.id}`}
                title={playing === v.id ? "Stop" : "Play sample"}
                className="border border-hairline"
              >
                {playing === v.id ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
              </IconButton>
            </div>
            <Input
              name={`voiceLabel_${v.id}`}
              defaultValue={labels[v.id] ?? ""}
              invalid={!!errors?.[v.id]}
              maxLength={30}
              placeholder="Name callers hear (optional)"
              aria-label={`Name for ${v.id}`}
            />
            <FieldError>{errors?.[v.id]}</FieldError>
          </li>
        ))}
      </ul>
    </div>
  );
}
