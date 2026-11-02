import { Clock, Mail, MapPin, Phone, type LucideIcon } from "lucide-react";
import { telHref } from "@/lib/leads/present";
import type { ContactDetails } from "@/lib/leads/contact-details";

function Row({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-soft text-link">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 pt-px">
        <p className="text-label text-ink-muted">{label}</p>
        <div className="mt-0.5 whitespace-pre-line break-words text-sm text-ink">{children}</div>
      </div>
    </li>
  );
}

/** The business beside the form: phone, email, address and hours. Renders nothing when none are set. */
export function ContactInfo({ details }: { details: ContactDetails }) {
  const { phone, email, address, hours } = details;
  if (!phone && !email && !address && !hours) return null;
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.replace(/\s*\n\s*/g, ", "))}`;
  return (
    <ul className="space-y-5">
      {phone && (
        <Row icon={Phone} label="Call us">
          <a href={telHref(phone)} className="inline-block py-1.5 font-medium">
            {phone}
          </a>
        </Row>
      )}
      {email && (
        <Row icon={Mail} label="Email us">
          <a href={`mailto:${email}`} className="inline-block py-1.5 font-medium">
            {email}
          </a>
        </Row>
      )}
      {address && (
        <Row icon={MapPin} label="Visit us">
          <a href={maps} target="_blank" rel="noopener noreferrer" className="inline-block py-1.5 text-ink no-underline hover:underline">
            {address}
          </a>
        </Row>
      )}
      {hours && <Row icon={Clock} label="Hours">{hours}</Row>}
    </ul>
  );
}
