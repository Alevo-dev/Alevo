import type { useClerk } from "@clerk/nextjs";

type Clerk = ReturnType<typeof useClerk>;

/** Where the task-aware onboarding steps live (also registered as Clerk `taskUrls`). */
export const TASK_URLS = { "choose-organization": "/onboarding/choose-organization" } as const;

/**
 * After `setActive({ session })`: the Clerk instance forces organization
 * selection, so a fresh session is *pending* with a `choose-organization`
 * task until the user picks or creates a workspace. Pending sessions count
 * as signed out everywhere else, so send them to the task page first.
 */
export function nextPathAfterAuth(clerk: Clerk): string {
  const task = clerk.session?.currentTask;
  if (task && task.key in TASK_URLS) return TASK_URLS[task.key as keyof typeof TASK_URLS];
  return "/dashboard";
}
