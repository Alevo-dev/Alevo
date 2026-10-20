"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { cx } from "@/lib/cx";
import { Button } from "./button";
import { Dialog } from "./dialog";

/** Stable string of a form's posted values (hidden inputs included). */
function serialize(form: HTMLFormElement): string {
  const pairs: string[] = [];
  new FormData(form).forEach((v, k) => {
    if (typeof v === "string") pairs.push(`${k}=${v}`);
  });
  return pairs.sort().join("&");
}

/**
 * Tracks whether a form's current values differ from the values it mounted
 * with. Wire `recheck` to the form's `onInput`/`onChange`; custom controls that
 * write a hidden input on their next render call `touch` instead.
 */
export function useFormDirty(formRef: RefObject<HTMLFormElement | null>) {
  const baseline = useRef<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (formRef.current && baseline.current === null) baseline.current = serialize(formRef.current);
  }, [formRef]);

  const recheck = useCallback(() => {
    const form = formRef.current;
    if (!form) return;
    if (baseline.current === null) baseline.current = serialize(form);
    setDirty(serialize(form) !== baseline.current);
  }, [formRef]);

  const touch = useCallback(() => {
    setTimeout(recheck, 0);
  }, [recheck]);

  /** The current values become the new baseline (after a save or a discard). */
  const markClean = useCallback(() => {
    const form = formRef.current;
    baseline.current = form ? serialize(form) : null;
    setDirty(false);
  }, [formRef]);

  return { dirty, recheck, touch, markClean };
}

/**
 * While `dirty`, intercepts in-app link clicks so the page can ask first, and
 * arms the browser's own close-tab guard (the only hook browsers allow there).
 */
export function useLeaveGuard(dirty: boolean) {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname + url.search === location.pathname + location.search) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingHref(url.pathname + url.search + url.hash);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  const stay = useCallback(() => setPendingHref(null), []);
  const leave = useCallback(() => {
    const href = pendingHref;
    setPendingHref(null);
    if (href) router.push(href);
  }, [pendingHref, router]);

  return { pendingHref, stay, leave };
}

/**
 * Everything a "save bar" form needs in one call: dirty tracking, the leave
 * guard, a Discard that remounts the fields (bump `formKey`), and a clean
 * baseline after a successful action. Wire `formRef`, `formKey`, `recheck`
 * to the <form>; `touch` to custom controls; render `UnsavedBar` + `LeaveDialog`.
 */
export function useUnsavedForm(state: { ok?: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [formKey, setFormKey] = useState(0);
  const { dirty, recheck, touch, markClean } = useFormDirty(formRef);
  const guard = useLeaveGuard(dirty);

  useEffect(() => {
    if (state.ok) queueMicrotask(markClean);
  }, [state, markClean]);

  const discard = useCallback(() => {
    setFormKey((k) => k + 1);
    setTimeout(markClean, 0);
  }, [markClean]);

  return { formRef, formKey, dirty, recheck, touch, discard, guard };
}

/** "Leave without saving?" — pair with `useLeaveGuard`. */
export function LeaveDialog({
  open,
  what = "your changes",
  onStay,
  onLeave,
}: {
  open: boolean;
  what?: string;
  onStay: () => void;
  onLeave: () => void;
}) {
  return (
    <Dialog
      open={open}
      title="Leave without saving?"
      description={`If you leave now, ${what} will be lost.`}
      onClose={onStay}
      footer={
        <>
          <Button variant="secondary" onClick={onStay}>
            Stay
          </Button>
          <Button variant="danger" onClick={onLeave}>
            Discard and leave
          </Button>
        </>
      }
    />
  );
}

/**
 * Floating save bar, bottom-right. Render it inside the `<form>`; it slides in
 * while there are unsaved changes and carries the form-level error.
 */
export function UnsavedBar({
  visible,
  pending,
  error,
  saveLabel = "Save changes",
  onDiscard,
}: {
  visible: boolean;
  pending?: boolean;
  error?: string | null;
  saveLabel?: string;
  onDiscard: () => void;
}) {
  return (
    <div
      aria-hidden={!visible}
      className={cx(
        "fixed bottom-6 right-6 z-40 flex max-w-[calc(100vw-3rem)] flex-wrap items-center gap-3 rounded-md border border-hairline bg-surface p-3 pl-4 shadow-float",
        "transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
      )}
    >
      <div className="min-w-0">
        <div className="text-sm font-medium text-ink">Unsaved changes</div>
        {error && <div className="mt-0.5 text-label text-danger">{error}</div>}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" onClick={onDiscard} disabled={pending} tabIndex={visible ? 0 : -1}>
          Discard
        </Button>
        <Button type="submit" variant="primary" loading={pending} tabIndex={visible ? 0 : -1}>
          {pending ? "Saving…" : saveLabel}
        </Button>
      </div>
    </div>
  );
}
