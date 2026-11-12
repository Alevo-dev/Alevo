/**
 * The voices an org can pick for phone calls: Vapi built-in voices that support
 * Version 2 (more natural than the original model; Vapi rejects any other id).
 * Each has a short sample in public/voices/<id>.mp3, from Vapi's own docs.
 */
export const VOICES = [
  { id: "Savannah", gender: "female" },
  { id: "Emma", gender: "female" },
  { id: "Clara", gender: "female" },
  { id: "Elliot", gender: "male" },
  { id: "Nico", gender: "male" },
  { id: "Sid", gender: "male" },
] as const;

export type VoiceId = (typeof VOICES)[number]["id"];
export const DEFAULT_VOICE: VoiceId = "Savannah";

export const isVoice = (v: unknown): v is VoiceId => VOICES.some((x) => x.id === v);

/**
 * One of the chosen voices at random (unknown names ignored), skipping `last` (the voice
 * of the previous call) whenever another is left; the default when none is chosen.
 */
export function pickVoice(
  names: readonly string[] | null | undefined,
  random: () => number = Math.random,
  last?: string | null,
): VoiceId {
  const valid = (names ?? []).filter(isVoice);
  const others = valid.filter((v) => v !== last);
  const pool = others.length > 0 ? others : valid;
  return pool[Math.floor(random() * pool.length)] ?? DEFAULT_VOICE;
}

/** The name the org gave each voice (the agent introduces itself by it), by voice id. */
export type VoiceLabels = Partial<Record<VoiceId, string>>;

const LABEL = /^\p{L}[\p{L} .'’-]{0,29}$/u;

/** A name for the agent: letters, spaces and . ' - only, 30 at most. The tidied name, "" for none, null when invalid. */
export function cleanVoiceLabel(raw: string): string | null {
  const name = raw.trim().replace(/ {2,}/g, " ");
  if (name === "") return "";
  return LABEL.test(name) ? name : null;
}

/** The saved name for a voice, or "" (the jsonb column may hold anything). */
export function labelFor(labels: unknown, id: VoiceId): string {
  if (!labels || typeof labels !== "object") return "";
  const v = (labels as Record<string, unknown>)[id];
  return typeof v === "string" ? v : "";
}
