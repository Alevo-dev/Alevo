import Image from "next/image";
import { BRAND_ICONS, LETTER_MARKS, MICROSOFT_SQUARES, SLACK_PIECES, type BrandIcon } from "@/lib/integrations/brand-icons";
import type { ServiceIcon } from "@/lib/integrations/services";

const MARK: Record<Exclude<ServiceIcon, "alevo" | "calendar" | "google" | "microsoft" | "slack" | "calcom" | "autotask" | "zendesk" | "connectwise" | "halopsa" | keyof typeof LETTER_MARKS>, BrandIcon> = {
  calendly: BRAND_ICONS.calendly,
  resend: BRAND_ICONS.resend,
  twilio: BRAND_ICONS.twilio,
  hubspot: BRAND_ICONS.hubspot,
  zoho: BRAND_ICONS.zoho,
};

function Glyph({ path, fill, className }: { path: string; fill: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path d={path} fill={fill} />
    </svg>
  );
}

function GoogleCalendar({ className }: { className: string }) {
  return <Glyph path={BRAND_ICONS.googleCalendar.path} fill={`#${BRAND_ICONS.googleCalendar.hex}`} className={className} />;
}

function Microsoft({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      {MICROSOFT_SQUARES.map((sq) => (
        <rect key={sq.fill} x={sq.x} y={sq.y} width="9" height="9" fill={sq.fill} />
      ))}
    </svg>
  );
}

const TILE = "inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-white";
/** The 30px row mark of the Integrations list (boards: 30px, 8px radius, hairline). */
const TILE_SM = "inline-flex size-[30px] shrink-0 items-center justify-center rounded-[8px] border border-hairline bg-white";

/** A brand's real mark in its own colours, on a white tile so dark marks stay visible on navy. */
export function BrandMark({ icon, size = "md" }: { icon: ServiceIcon; size?: "sm" | "md" }) {
  const sm = size === "sm";
  const tile = sm ? TILE_SM : TILE;
  if (icon === "alevo") {
    return (
      <span aria-hidden="true" className={`${tile} ${sm ? "p-[5px]" : "p-2"}`}>
        <Image src="/alevo-mark.png" alt="" width={24} height={24} className="size-full object-contain" />
      </span>
    );
  }
  if (icon === "calendar") {
    return (
      <span aria-hidden="true" className={`${tile} gap-1 ${sm ? "p-1" : "p-1.5"}`}>
        <GoogleCalendar className="size-4" />
        <Microsoft className="size-4" />
      </span>
    );
  }
  if (icon === "google") {
    return (
      <span aria-hidden="true" className={`${tile} ${sm ? "p-[5px]" : "p-2"}`}>
        <GoogleCalendar className="size-full" />
      </span>
    );
  }
  if (icon === "microsoft") {
    return (
      <span aria-hidden="true" className={`${tile} ${sm ? "p-[5px]" : "p-2"}`}>
        <Microsoft className="size-full" />
      </span>
    );
  }
  if (icon === "slack") {
    return (
      <span aria-hidden="true" className={`${tile} ${sm ? "p-[5px]" : "p-2"}`}>
        <svg viewBox="0 0 122.8 122.8" className="size-full" aria-hidden="true" focusable="false">
          {SLACK_PIECES.map((piece) => (
            <path key={piece.fill} d={piece.path} fill={piece.fill} />
          ))}
        </svg>
      </span>
    );
  }
  if (icon === "autotask") {
    // The supplied logo is a full red square: let it fill the tile.
    return (
      <span aria-hidden="true" className={`${tile} overflow-hidden`}>
        <Image src="/integrations/autotask.png" alt="" width={80} height={80} className="size-full object-cover" />
      </span>
    );
  }
  if (icon === "halopsa") {
    // A red circle on white: a 2px inset keeps it off the tile edge.
    return (
      <span aria-hidden="true" className={`${tile} overflow-hidden p-[2px]`}>
        <Image src="/integrations/halopsa.jpg" alt="" width={80} height={80} className="size-full object-contain" />
      </span>
    );
  }
  if (icon === "connectwise") {
    // The owl on a white square: enlarge it so it fills the tile like the other marks.
    return (
      <span aria-hidden="true" className={`${tile} relative overflow-hidden`}>
        <Image src="/integrations/connectwise.jpg" alt="" width={200} height={200} className="absolute max-w-none" style={{ width: "150%", left: "-25%", top: "-25%" }} />
      </span>
    );
  }
  if (icon === "zendesk") {
    // The supplied image is the mark above the wordmark: crop to the mark and centre it in the tile.
    return (
      <span aria-hidden="true" className={`${tile} relative overflow-hidden`}>
        <Image src="/integrations/zendesk.jpg" alt="" width={443} height={451} className="absolute max-w-none" style={{ width: "130%", left: "-14.6%", top: "1.7%", clipPath: "inset(0 0 38% 0)" }} />
      </span>
    );
  }
  if (icon === "calcom") {
    // Square tile like the others. The wordmark is wide, so crop to its ink and fill the tile's width.
    return (
      <span aria-hidden="true" className={`${tile} ${sm ? "p-[3px]" : "p-1"}`}>
        <svg viewBox="0 9.5 24 5" className="w-full" aria-hidden="true" focusable="false">
          <path d={BRAND_ICONS.calcom.path} fill={`#${BRAND_ICONS.calcom.hex}`} />
        </svg>
      </span>
    );
  }
  if (icon in LETTER_MARKS) {
    const { text, fill } = LETTER_MARKS[icon as keyof typeof LETTER_MARKS];
    return (
      <span aria-hidden="true" className={tile} style={{ backgroundColor: fill }}>
        <span className="font-display text-sm font-bold leading-none text-white">{text}</span>
      </span>
    );
  }
  const mark = MARK[icon as keyof typeof MARK];
  // A tool with no mark yet gets a neutral lettered tile, never a crash.
  if (!mark) {
    return (
      <span aria-hidden="true" className={tile}>
        <span className="font-display text-sm font-bold leading-none text-ink-muted">{icon.slice(0, 1).toUpperCase()}</span>
      </span>
    );
  }
  return (
    <span aria-hidden="true" className={`${tile} ${sm ? "p-[5px]" : "p-2"}`}>
      <Glyph path={mark.path} fill={`#${mark.hex}`} className="size-full" />
    </span>
  );
}
