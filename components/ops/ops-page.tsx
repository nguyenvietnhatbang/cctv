import { Suspense } from "react";
import { OpsApp } from "@/components/ops/ops-app";
import { LoadingScreen } from "@/components/ops/ui";

export function OpsPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <OpsApp />
    </Suspense>
  );
}
