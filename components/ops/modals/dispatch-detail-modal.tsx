"use client";

import { useState, type ReactNode } from "react";
import { FileText, History, MapPinned, Package, Phone, UserRound, Wrench, type LucideIcon } from "lucide-react";
import { TECHNICIAN_STATUS_LABELS, WORK_ORDER_TYPE_LABELS } from "@/lib/types";
import { dateTime, money } from "@/components/ops/format";
import { Modal, StatusBadge } from "@/components/ops/ui";
import type { Technician, WorkOrderDetail } from "@/components/ops/types";

type DispatchDetailTab = "work" | "customer" | "technician" | "history" | "resources";

const tabs: ReadonlyArray<{ id: DispatchDetailTab; label: string; icon: LucideIcon }> = [
  { id: "work", label: "Phiếu việc", icon: FileText },
  { id: "customer", label: "Khách hàng", icon: UserRound },
  { id: "technician", label: "Kỹ thuật", icon: Wrench },
  { id: "history", label: "Lịch sử", icon: History },
  { id: "resources", label: "Vật tư & tệp", icon: Package },
];

const paymentLabels: Record<string, string> = {
  unpaid: "Chưa thanh toán",
  paid: "Đã thanh toán",
  debt: "Công nợ",
};

function InfoItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-zinc-200 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">{label}</p>
      <div className="mt-1 text-sm font-semibold text-zinc-900">{children}</div>
    </div>
  );
}

export function DispatchDetailModal({
  detail,
  technicians,
  onClose,
}: {
  detail: WorkOrderDetail;
  technicians: Technician[];
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<DispatchDetailTab>("work");
  const assignedTechnician = technicians.find((technician) => technician.id === detail.workOrder.technician_id) ?? null;
  const paymentStatus = detail.workOrder.payment_status
    ? paymentLabels[detail.workOrder.payment_status] ?? detail.workOrder.payment_status
    : "Chưa thanh toán";

  return (
    <Modal title={`Xem ${detail.workOrder.code}`} size="xl" onClose={onClose}>
      <div className="grid gap-4">
        <section className="rounded-md border border-zinc-200 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={detail.workOrder.status} />
            <span className="text-sm font-semibold text-zinc-500">{WORK_ORDER_TYPE_LABELS[detail.workOrder.type]}</span>
          </div>
          <h3 className="mt-3 text-lg font-bold text-zinc-950">{detail.workOrder.customer_name}</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-600">{detail.workOrder.description}</p>
        </section>

        <nav className="flex gap-2 overflow-x-auto" aria-label="Thông tin phiếu phân công">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`tab-button gap-2 ${activeTab === tab.id ? "tab-button-active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
                type="button"
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {activeTab === "work" ? (
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <InfoItem label="Mã phiếu">{detail.workOrder.code}</InfoItem>
            <InfoItem label="Ưu tiên">{detail.workOrder.priority === "urgent" ? "Gấp" : "Bình thường"}</InfoItem>
            <InfoItem label="Hẹn xử lý">{dateTime(detail.workOrder.appointment_at)}</InfoItem>
            <InfoItem label="Ngày tạo">{dateTime(detail.workOrder.created_at)}</InfoItem>
            <InfoItem label="Công">{money(detail.workOrder.labor_cost)}</InfoItem>
            <InfoItem label="Vật tư">{money(detail.workOrder.material_amount)}</InfoItem>
            <InfoItem label="VAT">{money(detail.workOrder.vat_amount)}</InfoItem>
            <InfoItem label="Tổng">{money(detail.workOrder.total_amount)}</InfoItem>
            <div className="rounded-md border border-zinc-200 p-3 md:col-span-2 xl:col-span-4">
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Ghi chú nội bộ</p>
              <p className="mt-1 text-sm leading-6 text-zinc-700">{detail.workOrder.internal_note ?? "Chưa có ghi chú"}</p>
            </div>
          </section>
        ) : null}

        {activeTab === "customer" ? (
          <section className="grid gap-3 md:grid-cols-2">
            <InfoItem label="Khách hàng">{detail.workOrder.customer_name}</InfoItem>
            <InfoItem label="Số điện thoại">
              <a className="inline-flex items-center gap-2 text-teal-700" href={`tel:${detail.workOrder.customer_phone}`}>
                <Phone size={15} />{detail.workOrder.customer_phone}
              </a>
            </InfoItem>
            <div className="rounded-md border border-zinc-200 p-3 md:col-span-2">
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Địa chỉ</p>
              <a
                className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-teal-700"
                href={`https://maps.google.com/?q=${encodeURIComponent(detail.workOrder.customer_address)}`}
                target="_blank"
                rel="noreferrer"
              >
                <MapPinned size={15} />{detail.workOrder.customer_address}
              </a>
            </div>
          </section>
        ) : null}

        {activeTab === "technician" ? (
          <section className="grid gap-3 md:grid-cols-2">
            <InfoItem label="Kỹ thuật được gán">{detail.workOrder.technician_name ?? "Chưa phân công"}</InfoItem>
            <InfoItem label="Lịch hôm nay">{assignedTechnician ? `${assignedTechnician.jobs_today} việc` : "Chưa có dữ liệu"}</InfoItem>
            <InfoItem label="Trạng thái">
              {assignedTechnician ? TECHNICIAN_STATUS_LABELS[assignedTechnician.status] : "Chưa phân công"}
            </InfoItem>
            <InfoItem label="Khu vực">{assignedTechnician?.service_area ?? "Chưa gán khu vực"}</InfoItem>
          </section>
        ) : null}

        {activeTab === "history" ? (
          <section className="grid gap-2">
            {detail.history.length === 0 ? (
              <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
                Chưa có lịch sử trạng thái.
              </div>
            ) : detail.history.map((item) => (
              <div key={item.id} className="rounded-md border border-zinc-200 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <StatusBadge status={item.to_status} />
                  <span className="font-semibold text-zinc-500">{dateTime(item.changed_at)}</span>
                </div>
                <p className="mt-2 text-zinc-700">{item.changed_by_name ?? "Hệ thống"}</p>
                {item.note ? <p className="mt-1 text-zinc-500">{item.note}</p> : null}
              </div>
            ))}
          </section>
        ) : null}

        {activeTab === "resources" ? (
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-md border border-zinc-200 p-4">
              <h3 className="section-title">Vật tư</h3>
              <div className="mt-3 grid gap-2">
                {detail.materials.length === 0 ? <p className="text-sm text-zinc-500">Chưa có vật tư.</p> : detail.materials.map((material) => (
                  <div key={material.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-zinc-800">{material.name} x {material.quantity}</span>
                    <span className="text-zinc-600">{money(material.line_total)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-md border border-zinc-200 p-4">
              <h3 className="section-title">Tệp liên quan</h3>
              <div className="mt-3 grid gap-2">
                {detail.files.length === 0 ? <p className="text-sm text-zinc-500">Chưa có tệp.</p> : detail.files.map((file) => (
                  file.signed_url ? (
                    <a
                      key={file.id}
                      className="text-sm font-semibold text-teal-700 underline"
                      href={file.signed_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {file.original_name}
                    </a>
                  ) : (
                    <span key={file.id} className="text-sm font-semibold text-zinc-500">
                      {file.original_name}
                    </span>
                  )
                ))}
              </div>
            </div>
            <InfoItem label="Thanh toán">{paymentStatus}</InfoItem>
            <InfoItem label="Hạn công nợ">{detail.workOrder.debt_due_date ? dateTime(detail.workOrder.debt_due_date) : "Không có"}</InfoItem>
          </section>
        ) : null}
      </div>
    </Modal>
  );
}
