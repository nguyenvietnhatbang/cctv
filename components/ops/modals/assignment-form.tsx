"use client";

import { FormEvent } from "react";
import { TECHNICIAN_STATUS_LABELS } from "@/lib/types";
import { Field, PendingButton, ValidatedForm } from "@/components/ops/ui";
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
    <ValidatedForm onSubmit={onSubmit} aria-busy={isSubmitting} className="modal-panel form-grid">
      <h3 className="section-title">Phân công</h3>
      <fieldset disabled={isSubmitting} className="contents">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Kỹ thuật viên">
          <select name="technicianId" className="input" required defaultValue={detail.workOrder.technician_id ?? ""}>
            <option value="" disabled>Chọn kỹ thuật viên</option>
            {technicians.map((technician) => (
              <option key={technician.id} value={technician.id}>
                {technician.full_name} · {TECHNICIAN_STATUS_LABELS[technician.status]} · {technician.jobs_today} việc
              </option>
            ))}
          </select>
          </Field>
          <Field label="Ghi chú phân công">
            <input name="note" className="input" placeholder="Ghi chú phân công" />
          </Field>
        </div>
        <div className="form-actions">
          <PendingButton className="btn-secondary h-10" type="submit" pending={isSubmitting} pendingLabel="Đang phân công...">Cập nhật</PendingButton>
        </div>
      </fieldset>
    </ValidatedForm>
  );
}
