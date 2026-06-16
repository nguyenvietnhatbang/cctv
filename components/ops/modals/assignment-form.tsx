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
  const assignedIds = new Set((detail.workOrder.assigned_technicians ?? []).map((technician) => technician.id));

  return (
    <ValidatedForm onSubmit={onSubmit} aria-busy={isSubmitting} className="modal-section">
      <h3 className="section-title">Phân công</h3>
      <fieldset disabled={isSubmitting} className="mt-3 grid gap-3">
        <div className="grid max-h-72 gap-2 overflow-auto rounded-md border border-zinc-200 p-2 md:grid-cols-2">
          {technicians.map((technician) => (
            <label key={technician.id} className="flex items-start gap-3 rounded-md border border-zinc-100 bg-white p-3 text-sm">
              <input
                name="technicianIds"
                type="checkbox"
                value={technician.id}
                defaultChecked={assignedIds.has(technician.id)}
                className="mt-1 h-4 w-4"
              />
              <span className="min-w-0">
                <span className="block font-semibold text-zinc-900">{technician.full_name}</span>
                <span className="mt-0.5 block text-xs text-zinc-500">
                  {TECHNICIAN_STATUS_LABELS[technician.status]} · {technician.jobs_today} việc · {technician.service_area ?? "Chưa gán khu vực"}
                </span>
              </span>
            </label>
          ))}
        </div>
        <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_auto]">
          <input name="note" className="input" placeholder="Ghi chú phân công" />
          <PendingButton className="btn-secondary h-10 xl:h-11" type="submit" pending={isSubmitting} pendingLabel="Đang phân công...">Cập nhật</PendingButton>
        </div>
      </fieldset>
    </ValidatedForm>
  );
}
