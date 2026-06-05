"use client";

import { FormEvent } from "react";
import { Clock, MapPinned, Phone } from "lucide-react";
import { WORK_ORDER_TYPE_LABELS } from "@/lib/types";
import { dateTime } from "@/components/ops/format";
import { Modal, StatusBadge } from "@/components/ops/ui";
import type { Technician, WorkOrderDetail } from "@/components/ops/types";
import { AssignmentForm } from "@/components/ops/modals/assignment-form";

export function DispatchAssignmentModal({
  detail,
  technicians,
  onClose,
  onSubmit,
}: {
  detail: WorkOrderDetail;
  technicians: Technician[];
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Modal title={`Phân công ${detail.workOrder.code}`} size="lg" onClose={onClose}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="grid gap-4">
          <div className="rounded-md border border-zinc-200 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={detail.workOrder.status} />
              <span className="text-sm font-semibold text-zinc-500">{WORK_ORDER_TYPE_LABELS[detail.workOrder.type]}</span>
            </div>
            <h3 className="mt-3 text-lg font-bold text-zinc-950">{detail.workOrder.customer_name}</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{detail.workOrder.description}</p>
            <div className="mt-4 grid gap-2 text-sm text-zinc-600 md:grid-cols-3">
              <span className="inline-flex items-center gap-2"><Phone size={15} />{detail.workOrder.customer_phone}</span>
              <span className="inline-flex items-center gap-2"><MapPinned size={15} />{detail.workOrder.customer_address}</span>
              <span className="inline-flex items-center gap-2"><Clock size={15} />{dateTime(detail.workOrder.appointment_at)}</span>
            </div>
          </div>

          <AssignmentForm detail={detail} technicians={technicians} onSubmit={onSubmit} />
        </section>

        <aside className="rounded-md border border-zinc-200 p-4">
          <h3 className="section-title">Tải kỹ thuật viên</h3>
          <div className="mt-3 grid gap-2">
            {technicians.map((technician) => (
              <div key={technician.id} className="rounded-md border border-zinc-200 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-zinc-950">{technician.full_name}</p>
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600">
                    {technician.jobs_today}
                  </span>
                </div>
                <p className="mt-1 text-zinc-500">{technician.service_area ?? "Chưa gán khu vực"}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </Modal>
  );
}
