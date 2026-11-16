import Image from "next/image";
import Link from "next/link";

/** Mark + wordmark + the Console chip: the console's identity in the top bar. */
export function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 text-ink no-underline">
      <Image src="/alevo-mark.png" alt="" width={24} height={24} priority className="size-6" />
      <span className="font-display text-[17px] font-semibold tracking-tight">Alevo</span>
      <span className="ml-0.5 inline-flex h-[22px] items-center rounded-full border border-hairline px-[9px] text-[12.5px] font-[550] text-ink">Console</span>
    </Link>
  );
}
