import { Suspense } from "react";
import { OpsApp } from "@/components/ops/ops-app";

export function OpsPage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center bg-zinc-100 text-zinc-700">Đang tải...</div>}>
      <OpsApp />
    </Suspense>
  );
}
