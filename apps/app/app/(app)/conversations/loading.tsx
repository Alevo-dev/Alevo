import { OperationsSkeleton } from "@/components/skeletons/operations-skeleton";

/** Operations pages share one loader: see `components/skeletons/operations-skeleton.tsx`. */
export default function Loading() {
  return <OperationsSkeleton />;
}
