import type { Metadata } from "next";
import Image from "next/image";
import { ChooseOrganization } from "@/components/auth/choose-organization";

export const metadata: Metadata = { title: "Choose a workspace" };

/** Clerk `choose-organization` task page (pending sessions land here). */
export default function ChooseOrganizationPage() {
  return (
    <div className="w-full max-w-[400px]">
      <div className="mb-10 flex items-center gap-3">
        <Image src="/alevo-mark.png" alt="" width={32} height={32} className="size-8" />
        <span className="font-display text-xl font-semibold tracking-tight text-ink">Alevo</span>
      </div>
      <h1 className="text-title font-semibold text-ink">Pick a workspace</h1>
      <p className="mt-2 text-[15px] leading-[22px] text-ink-muted">
        Alevo keeps each company&apos;s leads, agent and team in its own workspace.
      </p>
      <div className="mt-7">
        <ChooseOrganization />
      </div>
    </div>
  );
}
