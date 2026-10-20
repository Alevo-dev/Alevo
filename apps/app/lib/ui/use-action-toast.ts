"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Okish = { ok?: boolean };

/**
 * After a successful server action: show a success toast and re-fetch the
 * server-rendered data. Fires once per dispatch (each `useActionState` result
 * is a fresh object), never again on re-renders. Errors stay inline (rule 13).
 */
export function useActionToast(state: Okish, message: string, { refresh = true } = {}) {
  const router = useRouter();
  const last = useRef<Okish | null>(null);
  useEffect(() => {
    if (!state.ok || last.current === state) return;
    last.current = state;
    toast.success(message);
    if (refresh) router.refresh();
  }, [state, message, refresh, router]);
}

export { toast };
