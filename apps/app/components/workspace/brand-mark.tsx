import { BRAND_ICONS, MICROSOFT_SQUARES, SLACK_PIECES, type BrandIcon } from "@/lib/integrations/brand-icons";
import type { ServiceIcon } from "@/lib/integrations/services";

const MARK: Record<Exclude<ServiceIcon, "calendar" | "google" | "microsoft" | "slack" | "calcom">, BrandIcon> = {
  calendly: BRAND_ICONS.calendly,
  resend: BRAND_ICONS.resend,
  twilio: BRAND_ICONS.twilio,
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

/** A brand's real mark in its own colours, on a white tile so dark marks stay visible on navy. */
export function BrandMark({ icon }: { icon: ServiceIcon }) {
  if (icon === "calendar") {
    return (
      <span aria-hidden="true" className={`${TILE} gap-1 p-1.5`}>
        <GoogleCalendar className="size-4" />
        <Microsoft className="size-4" />
      </span>
    );
  }
  if (icon === "google") {
    return (
      <span aria-hidden="true" className={`${TILE} p-2`}>
        <GoogleCalendar className="size-full" />
      </span>
    );
  }
  if (icon === "microsoft") {
    return (
      <span aria-hidden="true" className={`${TILE} p-2`}>
        <Microsoft className="size-full" />
      </span>
    );
  }
  if (icon === "slack") {
    return (
      <span aria-hidden="true" className={`${TILE} p-2`}>
        <svg viewBox="0 0 122.8 122.8" className="size-full" aria-hidden="true" focusable="false">
          {SLACK_PIECES.map((piece) => (
            <path key={piece.fill} d={piece.path} fill={piece.fill} />
          ))}
        </svg>
      </span>
    );
  }
  if (icon === "calcom") {
    // Square tile like the others. The wordmark is wide, so crop to its ink and fill the tile's width.
    return (
      <span aria-hidden="true" className={`${TILE} p-1`}>
        <svg viewBox="0 9.5 24 5" className="w-full" aria-hidden="true" focusable="false">
          <path d={BRAND_ICONS.calcom.path} fill={`#${BRAND_ICONS.calcom.hex}`} />
        </svg>
      </span>
    );
  }
  const mark = MARK[icon];
  return (
    <span aria-hidden="true" className={`${TILE} p-2`}>
      <Glyph path={mark.path} fill={`#${mark.hex}`} className="size-full" />
    </span>
  );
}
