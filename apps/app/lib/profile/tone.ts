import type { SelectOption } from "@/components/ui/select";

export type ToneOption = { key: string; label: string; description: string };

/** Voice presets for the agent. The key is what `org_profiles.tone` stores. */
export const TONES: readonly ToneOption[] = [
  { key: "friendly", label: "Friendly & conversational", description: "Friendly and conversational: relaxed, plain words, like a helpful neighbour. Contractions are fine." },
  { key: "professional", label: "Professional & polished", description: "Professional and polished: courteous, precise and well structured, with no slang." },
  { key: "consultative", label: "Warm & consultative", description: "Warm and consultative: curious, asks good questions, and advises rather than sells." },
  { key: "direct", label: "Direct & concise", description: "Direct and concise: short sentences, gets to the point, no filler or small talk." },
  { key: "energetic", label: "Confident & energetic", description: "Confident and energetic: upbeat, enthusiastic and decisive, while staying honest." },
];

export const TONE_KEYS: readonly string[] = TONES.map((t) => t.key);

/** What the prompt should say: a preset's description, or the legacy free text as written. */
export function toneForPrompt(stored: string | null | undefined): string | null {
  const v = stored?.trim();
  if (!v) return null;
  return TONES.find((t) => t.key === v)?.description ?? v;
}

/** Presets for the dropdown, plus the saved value as "Custom: …" when it is old free text. */
export function toneOptions(stored: string): SelectOption[] {
  const opts: SelectOption[] = TONES.map((t) => ({ value: t.key, label: t.label }));
  if (stored && !TONE_KEYS.includes(stored)) {
    opts.push({ value: stored, label: `Custom: ${stored.length > 40 ? `${stored.slice(0, 40)}…` : stored}` });
  }
  return opts;
}
