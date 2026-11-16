import { PageTransition } from "@/components/page-transition";

/** Animates tab switches inside Workspace; the title + tabs stay put. */
export default function WorkspaceTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
