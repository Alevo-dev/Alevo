import { AlevoShell } from "@/components/landing/chrome";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AlevoShell>{children}</AlevoShell>;
}
