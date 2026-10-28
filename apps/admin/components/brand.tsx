import Image from "next/image";
import Link from "next/link";
import { Pill } from "@alevo/ui/pill";

/** Mark + wordmark + the Admin pill: the console's identity, in the sidebar and the phone top bar. */
export function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-3 text-ink no-underline">
      <Image src="/alevo-mark.png" alt="" width={28} height={28} priority className="size-7" />
      <span className="font-display text-lg font-semibold tracking-tight">Alevo</span>
      <Pill tone="violet">Admin</Pill>
    </Link>
  );
}
