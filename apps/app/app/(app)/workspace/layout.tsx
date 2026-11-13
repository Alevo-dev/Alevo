import { JumpHighlight } from "@/components/jump-highlight";

/** Workspace: the organization's setup. Its pages are the sub-menu under "Workspace" in the side nav. */
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <h1 className="text-title font-semibold text-ink">Workspace</h1>
      <JumpHighlight />
      <div className="mt-6">{children}</div>
    </div>
  );
}
