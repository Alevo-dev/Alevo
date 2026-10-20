import { PageTransition } from "@/components/page-transition";

/** Animates navigations between top-level app routes (sidebar). */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
