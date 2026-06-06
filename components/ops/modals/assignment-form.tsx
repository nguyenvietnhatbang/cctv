"use client";

import { FormEvent } from "react";
import { TECHNICIAN_STATUS_LABELS } from "@/lib/types";
import { PendingButton, ValidatedForm } from "@/components/ops/ui";
import type { Technician, WorkOrderDetail } from "@/components/ops/types";

export function AssignmentForm({
  detail,
  technicians,
  onSubmit,
  isSubmitting = false,
}: {
  detail: WorkOrderDetail;
  technicians: Technician[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSubmitting?: boolean;
}) {
  return (
    <ValidatedForm onSubmit={onSubmit} aria-busy={isSubmitting} className="rounded-md border border-zinc-200 p-4">
      <h3 className="section-title">Phân công</h3>
      <fieldset disabled={isSubmitting} className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
          <select name="technicianId" className="input" required defaultValue={detail.workOrder.technician_id ?? ""}>
            <option value="" disabled>Chọn kỹ thuật viên</option>
            {technicians.map((technician) => (
              <option key={technician.id} value={technician.id}>
                {technician.full_name} · {TECHNICIAN_STATUS_LABELS[technician.status]} · {technician.jobs_today} việc
              </option>
            ))}
          </select>
          <input name="note" className="input" placeholder="Ghi chú phân công" />
          <PendingButton className="btn-secondary h-11" type="submit" pending={isSubmitting} pendingLabel="Đang phân công...">Cập nhật</PendingButton>
      </fieldset>
    </ValidatedForm>
  );
}
