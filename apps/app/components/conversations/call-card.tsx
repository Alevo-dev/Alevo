"use client";

import { useState, useTransition } from "react";
import { Phone } from "lucide-react";
import type { CallOutcome } from "@alevo/db";
import { recordingUrl } from "@/app/(app)/conversations/[id]/recording-actions";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { fmtDuration, fmtTime } from "@/lib/format";
import { CALL_OUTCOME } from "@/lib/ui/status";

export type CallCardData = {
  id: string;
  startedAt: Date | null;
  durationSec: number | null;
  outcome: CallOutcome;
  summary: string | null;
  transcript: string | null;
  hasRecording: boolean;
  /** The agent took a message on this call (a `call:<ref>:message` row exists). */
  messageTaken: boolean;
};

/**
 * One phone call in the thread: when, how long, how it ended, the summary, and —
 * for admins — the recording and transcript. Lives between the messages of the
 * conversation the call opened.
 */
export function CallCard({ call, tz, canPlay }: { call: CallCardData; tz: string; canPlay: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const outcome = CALL_OUTCOME[call.outcome] ?? CALL_OUTCOME.none;

  function play() {
    setError(null);
    start(async () => {
      const r = await recordingUrl(call.id);
      if ("url" in r) setUrl(r.url);
      else setError(r.error);
    });
  }

  return (
    <li className="flex max-w-[720px] flex-col self-start">
      <div className="mb-1.5 text-label text-ink-muted">Phone call{call.startedAt ? `, ${fmtTime(call.startedAt, tz)}` : ""}</div>
      <div className="rounded-md border border-hairline bg-surface p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-sm bg-raised text-ink-muted">
            <Phone className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold text-ink">Phone call</span>
          <span className="tabular font-mono text-label text-ink-muted">{fmtDuration(call.durationSec)}</span>
          <Pill tone={outcome.tone}>{outcome.label}</Pill>
          {call.messageTaken && <Pill tone="muted">Message taken</Pill>}
        </div>
        <p className="mt-3 whitespace-pre-wrap text-base leading-6 text-ink">{call.summary?.trim() || "No summary"}</p>
        {(call.hasRecording || call.transcript) && (
          <div className="mt-4 flex flex-col gap-3">
            {call.hasRecording && canPlay && !url && (
              <Button size="sm" variant="secondary" loading={pending} onClick={play} className="self-start">
                {error ? "Try again" : "Play recording"}
              </Button>
            )}
            {url && <audio controls preload="none" src={url} className="w-full" aria-label="Call recording" />}
            {error && <p className="text-label text-ink-muted">{error}</p>}
            {call.transcript && (
              <details className="text-sm">
                <summary className="cursor-pointer text-label font-medium text-ink-muted hover:text-ink">Transcript</summary>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-5 text-ink-muted">{call.transcript}</pre>
              </details>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
