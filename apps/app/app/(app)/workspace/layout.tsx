import { WorkspaceTabs } from "@/components/workspace-tabs";

/** Workspace: the organization's setup — profile, agent, knowledge, team, connections. */
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <h1 className="text-title font-semibold text-ink">Workspace</h1>
      <WorkspaceTabs />
      <div className="mt-8">{children}</div>
    </div>
  );
}
