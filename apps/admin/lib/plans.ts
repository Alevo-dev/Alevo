import { asc, eq } from "drizzle-orm";
import { plans, withService } from "@alevo/db";

export type PlanOption = { id: string; name: string; key: string };

/** The plans a workspace can be put on, in catalogue order. */
export function activePlans(): Promise<PlanOption[]> {
  return withService((tx) =>
    tx.select({ id: plans.id, name: plans.name, key: plans.key }).from(plans).where(eq(plans.isActive, true)).orderBy(asc(plans.sortOrder)),
  );
}
