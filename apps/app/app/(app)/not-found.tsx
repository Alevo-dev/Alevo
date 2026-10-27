import type { Metadata } from "next";
import { StatusAction, StatusScreen } from "@/components/status-screen";

export const metadata: Metadata = { title: "Page not found" };

/** `notFound()` inside the app shell: a conversation, meeting or tab that isn't there. */
export default function AppNotFound() {
  return (
    <StatusScreen
      code="404"
      kicker="Page not found"
      title="This page isn't here"
      description="The link may be old, or the record was removed. Your leads, meetings and settings are still where you left them."
      actions={
        <>
          <StatusAction href="/dashboard">Back to dashboard</StatusAction>
          <StatusAction href="/conversations" variant="secondary">
            Open conversations
          </StatusAction>
        </>
      }
    />
  );
}
