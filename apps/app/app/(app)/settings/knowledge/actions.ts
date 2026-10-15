"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { kbDocuments } from "@alevo/db";
import { getCurrentOrg, requireRole, withOrg } from "@alevo/auth";
import { inngest } from "@/lib/inngest/client";
import type { KbSourceType } from "@alevo/db";

export type AddValues = { sourceType: KbSourceType; title: string; text: string; url: string };
export type AddErrors = { title?: string; text?: string; url?: string };
export type ActionState = {
  ok?: boolean;
  error?: string;
  errors?: AddErrors;
  values?: AddValues;
};

function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

async function orgId(): Promise<string> {
  const org = await getCurrentOrg();
  if (!org) throw new Error("No active organization");
  return org.id;
}

async function fireIngest(org: string, documentId: string) {
  try {
    await inngest.send({ name: "kb/document.ingest", data: { orgId: org, documentId } });
  } catch {
    // The doc is saved as 'pending'; it can be re-ingested from the list.
  }
}

/** Add a text or URL source. (PDFs come through addPdfDocument after upload.) */
export async function addDocument(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const sourceType = (String(formData.get("sourceType") ?? "text") as KbSourceType) || "text";
  const title = String(formData.get("title") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const values: AddValues = { sourceType, title, text, url };

  const errors: AddErrors = {};
  if (!title) errors.title = "Give this a title.";
  if (sourceType === "text" && !text) errors.text = "Paste some text to add.";
  if (sourceType === "url") {
    if (!url) errors.url = "Enter a URL.";
    else if (!isHttpUrl(url)) errors.url = "Enter a valid http(s) URL.";
  }
  if (Object.keys(errors).length > 0) return { errors, values };

  try {
    await requireRole("admin");
    const org = await orgId();
    const [doc] = await withOrg((tx) =>
      tx
        .insert(kbDocuments)
        .values({
          orgId: org,
          title,
          sourceType,
          sourceRef: sourceType === "text" ? text : url,
          status: "pending",
        })
        .returning({ id: kbDocuments.id }),
    );
    if (!doc) return { error: "Could not save the document.", values };
    await fireIngest(org, doc.id);
    revalidatePath("/settings/knowledge");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Something went wrong", values };
  }
}

/** Register an already-uploaded PDF (R2 key) and kick off ingestion. */
export async function addPdfDocument(params: {
  title: string;
  r2Key: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireRole("admin");
    const org = await orgId();
    const title = params.title.trim() || "Untitled PDF";
    const [doc] = await withOrg((tx) =>
      tx
        .insert(kbDocuments)
        .values({ orgId: org, title, sourceType: "pdf", sourceRef: params.r2Key, status: "pending" })
        .returning({ id: kbDocuments.id }),
    );
    if (!doc) return { ok: false, error: "Could not save the document." };
    await fireIngest(org, doc.id);
    revalidatePath("/settings/knowledge");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Something went wrong" };
  }
}

/** Re-run ingestion for a document (e.g. after a failure). */
export async function reingestDocument(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireRole("admin");
    const org = await orgId();
    const id = String(formData.get("id") ?? "");
    const [doc] = await withOrg((tx) =>
      tx
        .update(kbDocuments)
        .set({ status: "pending", error: null, updatedAt: new Date() })
        .where(and(eq(kbDocuments.id, id), sql`${kbDocuments.orgId} = (select app.current_org_id())`))
        .returning({ id: kbDocuments.id }),
    );
    if (doc) await fireIngest(org, doc.id);
    revalidatePath("/settings/knowledge");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Something went wrong" };
  }
}

export async function deleteDocument(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireRole("admin");
    await orgId();
    const id = String(formData.get("id") ?? "");
    await withOrg((tx) =>
      tx
        .delete(kbDocuments)
        .where(and(eq(kbDocuments.id, id), sql`${kbDocuments.orgId} = (select app.current_org_id())`)),
    );
    revalidatePath("/settings/knowledge");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Something went wrong" };
  }
}
