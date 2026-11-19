import "server-only";
import { getPlatformSecret } from "@alevo/db";

/**
 * Which model answers WEB CHATS: Claude (the default) or ChatGPT, set by the switch under Admin console → Settings →
 * Web chat model. Read at most every 15 seconds, so a change takes effect within that; a run already working keeps
 * the model it started with. An unreadable setting means Claude. Email, texts, forms and phone calls are never affected.
 */
export type ChatModel = "claude" | "chatgpt";

let cached: { at: number; model: ChatModel } | null = null;

export async function webChatModel(now = Date.now()): Promise<ChatModel> {
  if (cached && now - cached.at < 15_000) return cached.model;
  let model: ChatModel = "claude";
  try {
    if ((await getPlatformSecret("web_chat_model")) === "chatgpt") model = "chatgpt";
  } catch {
    // keep Claude
  }
  cached = { at: now, model };
  return model;
}
