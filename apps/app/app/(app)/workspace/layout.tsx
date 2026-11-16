import { JumpHighlight } from "@/components/jump-highlight";

/** Workspace: the organization's setup. Its pages are the sub-links under "Workspace" in the rail; each draws its own title. */
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <JumpHighlight />
      {children}
    </div>
  );
}
