import { WorkspaceSkeleton } from "@/components/skeletons/workspace-skeleton";

/** Every Workspace page shares one loader: see `components/skeletons/workspace-skeleton.tsx`. */
export default function Loading() {
  return <WorkspaceSkeleton />;
}
