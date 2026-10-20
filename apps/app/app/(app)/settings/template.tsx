import { PageTransition } from "@/components/page-transition";

/** Animates tab switches inside Settings; the title + tabs stay put. */
export default function SettingsTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
