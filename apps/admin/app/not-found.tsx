import type { Metadata } from "next";
import { StatusAction, StatusScreen } from "@alevo/ui/status-screen";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <StatusScreen
      standalone
      code="404"
      kicker="Page not found"
      title="This page isn't here"
      description="The console only has the one dashboard so far. The link may be old or mistyped."
      actions={<StatusAction href="/dashboard">Back to the console</StatusAction>}
    />
  );
}
