import "server-only";
import { eq } from "drizzle-orm";
import { getOrgSecret, orgProfiles, withService } from "@alevo/db";
import { cwAuthorization, cwBaseUrl, cwQuote } from "./connectwise-map";
import { vendorFetch } from "@/lib/http/vendor-fetch";

/**
 * ConnectWise Manage REST client (the I/O half). One instance per org per call:
 * the org's keys are decrypted here and never leave the server. Every method
 * is a single request; the orchestration in `writeback.ts` decides what to do.
 *
 * Manage's defaults for required setup-table fields (company status / type,
 * activity type / status) differ per instance, so creates look the default up
 * first and send it when found; a missing default just leaves the field out.
 */

export class ConnectWiseError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ConnectWiseError";
  }
}

type Ref = { id: number; name?: string; identifier?: string };
type Query = Record<string, string | number | undefined>;

export type ConnectWiseClient = ReturnType<typeof createConnectWiseClient>;

export function createConnectWiseClient(cfg: { site: string; companyId: string; publicKey: string; privateKey: string; clientId: string }) {
  const base = cwBaseUrl(cfg.site);
  const headers = {
    Authorization: cwAuthorization(cfg.companyId, cfg.publicKey, cfg.privateKey),
    clientId: cfg.clientId,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  async function request<T>(method: "GET" | "POST", path: string, body?: unknown, query?: Query): Promise<T> {
    const url = new URL(`${base}${path}`);
    for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));
    const res = await vendorFetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }, { timeoutMs: 20_000, idempotent: method === "GET" });
    if (!res.ok) {
      const text = (await res.text().catch(() => "")).slice(0, 400);
      throw new ConnectWiseError(res.status, `ConnectWise ${method} ${path} → ${res.status}${text ? `: ${text}` : ""}`);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  /** The instance's default row in a setup table, when it has one flagged. */
  async function defaultOf(path: string): Promise<Ref | undefined> {
    const rows = await request<Ref[]>("GET", path, undefined, { conditions: "defaultFlag=true", pageSize: 1 }).catch(() => []);
    return rows[0];
  }

  return {
    /** Smoke test: the instance answers with its version. */
    async ping(): Promise<string> {
      const info = await request<{ version?: string; cloudRegion?: string }>("GET", "/system/info");
      return info.version ?? "unknown version";
    },

    async memberExists(identifier: string): Promise<boolean> {
      const rows = await request<Ref[]>("GET", "/system/members", undefined, { conditions: `identifier=${cwQuote(identifier)}`, pageSize: 1 });
      return rows.length > 0;
    },

    async findCompany(name: string, identifier: string): Promise<number | null> {
      const rows = await request<Ref[]>("GET", "/company/companies", undefined, {
        conditions: `name=${cwQuote(name)} or identifier=${cwQuote(identifier)}`,
        pageSize: 1,
      });
      return rows[0]?.id ?? null;
    },

    async createCompany(input: { name: string; identifier: string }): Promise<number> {
      const [status, type] = await Promise.all([defaultOf("/company/companies/statuses"), defaultOf("/company/companies/types")]);
      const created = await request<Ref>("POST", "/company/companies", {
        identifier: input.identifier,
        name: input.name,
        site: { name: "Main" },
        ...(status ? { status: { id: status.id } } : {}),
        ...(type ? { types: [{ id: type.id }] } : {}),
      });
      return created.id;
    },

    async findContactByEmail(email: string): Promise<number | null> {
      const rows = await request<Ref[]>("GET", "/company/contacts", undefined, {
        childConditions: `communicationItems/value=${cwQuote(email)}`,
        pageSize: 1,
      });
      return rows[0]?.id ?? null;
    },

    async createContact(input: { firstName: string; lastName: string; companyId: number; email: string | null; phone: string | null }): Promise<number> {
      const communicationItems = [
        input.email ? { type: { name: "Email" }, value: input.email, defaultFlag: true, communicationType: "Email" } : null,
        input.phone ? { type: { name: "Direct" }, value: input.phone, defaultFlag: true, communicationType: "Phone" } : null,
      ].filter(Boolean);
      const created = await request<Ref>("POST", "/company/contacts", {
        firstName: input.firstName,
        ...(input.lastName ? { lastName: input.lastName } : {}),
        company: { id: input.companyId },
        communicationItems,
      });
      return created.id;
    },

    async createActivity(input: { name: string; notes: string; companyId: number; contactId: number; member: string }): Promise<number> {
      const [type, status] = await Promise.all([defaultOf("/sales/activities/types"), defaultOf("/sales/activities/statuses")]);
      const created = await request<Ref>("POST", "/sales/activities", {
        name: input.name,
        notes: input.notes,
        company: { id: input.companyId },
        contact: { id: input.contactId },
        assignTo: { identifier: input.member },
        ...(type ? { type: { id: type.id } } : {}),
        ...(status ? { status: { id: status.id } } : {}),
      });
      return created.id;
    },

    async createOpportunity(input: { name: string; notes: string; companyId: number; contactId: number; member: string }): Promise<number> {
      const created = await request<Ref>("POST", "/sales/opportunities", {
        name: input.name,
        notes: input.notes,
        company: { id: input.companyId },
        contact: { id: input.contactId },
        primarySalesRep: { identifier: input.member },
        source: "Alevo",
      });
      return created.id;
    },
  };
}

export type ConnectWiseConnection = { client: ConnectWiseClient; member: string; site: string };

/**
 * The org's connection, or null (with the reason) when it isn't complete. Keys
 * are decrypted here only; callers never see them. Platform developer client ID
 * comes from `CONNECTWISE_CLIENT_ID`.
 */
export async function loadConnectWise(orgId: string): Promise<{ ok: true; conn: ConnectWiseConnection } | { ok: false; reason: string }> {
  const clientId = process.env.CONNECTWISE_CLIENT_ID;
  if (!clientId) return { ok: false, reason: "CONNECTWISE_CLIENT_ID isn't set on the server." };

  const [[profile], publicKey, privateKey] = await Promise.all([
    withService((tx) =>
      tx
        .select({ site: orgProfiles.connectwiseSite, companyId: orgProfiles.connectwiseCompanyId, member: orgProfiles.connectwiseMember })
        .from(orgProfiles)
        .where(eq(orgProfiles.orgId, orgId))
        .limit(1),
    ),
    getOrgSecret(orgId, "connectwise_public_key"),
    getOrgSecret(orgId, "connectwise_private_key"),
  ]);
  if (!profile?.site || !profile.companyId || !profile.member || !publicKey || !privateKey) {
    return { ok: false, reason: "ConnectWise isn't fully set up for this workspace." };
  }
  const client = createConnectWiseClient({ site: profile.site, companyId: profile.companyId, publicKey, privateKey, clientId });
  return { ok: true, conn: { client, member: profile.member, site: profile.site } };
}
