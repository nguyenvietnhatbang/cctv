"use client";

import { useState, type ReactNode } from "react";
import { CreditCard, FileText, History, MapPinned, Package, Phone, ReceiptText, UserRound, Wrench, type LucideIcon } from "lucide-react";
import { TECHNICIAN_STATUS_LABELS, WORK_ORDER_TYPE_LABELS } from "@/lib/types";
import { dateTime, money } from "@/components/ops/format";
import { Modal, StatusBadge } from "@/components/ops/ui";
import type { Technician, WorkOrderDetail } from "@/components/ops/types";

type DetailTab = "overview" | "customer" | "progress" | "costs" | "resources";

const tabs: ReadonlyArray<{ id: DetailTab; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "Tổng quan", icon: FileText },
  { id: "customer", label: "Khách hàng", icon: UserRound },
  { id: "progress", label: "Tiến độ", icon: History },
  { id: "costs", label: "Chi phí", icon: CreditCard },
  { id: "resources", label: "Tệp & vật tư", icon: Package },
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

export function WorkOrderDetailModal({
  detail,
  technicians,
  onClose,
}: {
  detail: WorkOrderDetail;
  technicians: Technician[];
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const assignedTechnician = technicians.find((technician) => technician.id === detail.workOrder.technician_id) ?? null;
  const signatureFile = detail.files.find((file) => file.purpose === "signature");
  const paymentStatus = detail.workOrder.payment_status
    ? paymentLabels[detail.workOrder.payment_status] ?? detail.workOrder.payment_status
    : "Chưa thanh toán";

  return (
    <Modal title={`Xem chi tiết công việc ${detail.workOrder.code}`} size="xl" onClose={onClose}>
      <div className="modal-stack">
        <section className="modal-hero">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge order={detail.workOrder} />
            <span className="text-sm font-semibold text-zinc-500">{WORK_ORDER_TYPE_LABELS[detail.workOrder.type]}</span>
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <h3 className="text-lg font-bold text-zinc-950">{detail.workOrder.customer_name}</h3>
              <p className="mt-1 text-sm leading-6 text-zinc-600">{detail.workOrder.description}</p>
            </div>
            <div className="text-left lg:text-right">
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Tổng tiền</p>
              <p className="mt-1 text-2xl font-bold text-zinc-950">{money(detail.workOrder.total_amount)}</p>
            </div>
          </div>
        </section>

        <nav className="modal-tabs" aria-label="Xem chi tiết công việc">
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

        {activeTab === "overview" ? (
          <section className="info-grid md:grid-cols-2 xl:grid-cols-4">
            <InfoItem label="Mã công việc">{detail.workOrder.code}</InfoItem>
            <InfoItem label="Loại công việc">{WORK_ORDER_TYPE_LABELS[detail.workOrder.type]}</InfoItem>
            <InfoItem label="Độ ưu tiên">{detail.workOrder.priority === "urgent" ? "Khẩn cấp" : "Bình thường"}</InfoItem>
            <InfoItem label="Thời gian hẹn">{dateTime(detail.workOrder.appointment_at)}</InfoItem>
            <InfoItem label="Ngày tạo">{dateTime(detail.workOrder.created_at)}</InfoItem>
            <InfoItem label="Kỹ thuật viên">{detail.workOrder.technician_name ?? "Chưa phân công"}</InfoItem>
            <InfoItem label="Trạng thái kỹ thuật">{assignedTechnician ? TECHNICIAN_STATUS_LABELS[assignedTechnician.status] : "Chưa gán"}</InfoItem>
            <InfoItem label="Thanh toán">{paymentStatus}</InfoItem>
            <div className="info-card md:col-span-2">
              <p className="info-label">Ghi chú nội bộ</p>
              <p className="info-value whitespace-pre-wrap">{detail.workOrder.internal_note ?? "Không có ghi chú"}</p>
            </div>
            <div className="info-card md:col-span-2">
              <p className="info-label">Ghi chú hoàn thành</p>
              <p className="info-value whitespace-pre-wrap">{detail.workOrder.completion_note ?? "Không có ghi chú"}</p>
            </div>
          </section>
        ) : null}

        {activeTab === "customer" ? (
          <section className="info-grid md:grid-cols-2">
            <InfoItem label="Khách hàng">{detail.workOrder.customer_name}</InfoItem>
            <InfoItem label="Số điện thoại">
              <a className="inline-flex items-center gap-1.5 text-teal-700" href={`tel:${detail.workOrder.customer_phone}`}>
                <Phone size={14} />{detail.workOrder.customer_phone}
              </a>
            </InfoItem>
            <div className="info-card md:col-span-2">
              <p className="info-label">Địa chỉ</p>
              <a
                className="info-value inline-flex items-center gap-1.5 text-teal-700"
                href={`https://maps.google.com/?q=${encodeURIComponent(detail.workOrder.customer_address)}`}
                target="_blank"
                rel="noreferrer"
              >
                <MapPinned size={14} className="shrink-0" />{detail.workOrder.customer_address}
              </a>
            </div>
            <div className="info-card md:col-span-2">
              <p className="info-label">Mô tả công việc</p>
              <p className="info-value whitespace-pre-wrap font-medium text-zinc-700">{detail.workOrder.description}</p>
            </div>
          </section>
        ) : null}

        {activeTab === "progress" ? (
          <section className="modal-panel">
            <h3 className="section-title">Lịch sử trạng thái</h3>
            {detail.history.length === 0 ? (
              <div className="mt-3 rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500">
                Chưa có lịch sử trạng thái.
              </div>
            ) : (
              <div className="relative ml-2 mt-4 grid gap-4 border-l border-zinc-200 pl-6">
                {detail.history.map((item) => (
                  <div key={item.id} className="relative text-sm">
                    <span className="absolute -left-[29px] top-1 h-2 w-2 rounded-full bg-zinc-400 ring-4 ring-white" />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <StatusBadge status={item.to_status} />
                      <span className="font-semibold text-zinc-500">{dateTime(item.changed_at)}</span>
                    </div>
                    <p className="mt-1 font-semibold text-zinc-700">{item.changed_by_name ?? "Hệ thống"}</p>
                    {item.note ? <p className="mt-2 rounded-md border border-zinc-100 bg-zinc-50 p-2 text-zinc-600">{item.note}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {activeTab === "costs" ? (
          <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="modal-panel">
              <h3 className="section-title">Vật tư sử dụng</h3>
              {detail.materials.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-500">Chưa có vật tư sử dụng.</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full divide-y divide-zinc-200 text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-zinc-500">
                        <th className="py-2">Tên vật tư</th>
                        <th className="py-2 text-center">SL</th>
                        <th className="py-2 text-right">Đơn giá</th>
                        <th className="py-2 text-right">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {detail.materials.map((material) => (
                        <tr key={material.id}>
                          <td className="py-2 font-medium text-zinc-900">{material.name}</td>
                          <td className="py-2 text-center text-zinc-700">{material.quantity}</td>
                          <td className="py-2 text-right text-zinc-700">{money(material.unit_price)}</td>
                          <td className="py-2 text-right font-bold text-zinc-900">{money(material.line_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-panel">
              <h3 className="section-title">Thanh toán</h3>
              <div className="mt-3 grid gap-2 text-sm text-zinc-600">
                <div className="flex justify-between gap-3"><span>Tiền công</span><strong className="text-zinc-900">{money(detail.workOrder.labor_cost)}</strong></div>
                <div className="flex justify-between gap-3"><span>Tiền vật tư</span><strong className="text-zinc-900">{money(detail.workOrder.material_amount)}</strong></div>
                <div className="flex justify-between gap-3"><span>Thuế VAT</span><strong className="text-zinc-900">{money(detail.workOrder.vat_amount)}</strong></div>
                <div className="mt-1 flex justify-between gap-3 border-t border-zinc-200 pt-2 text-base font-bold text-zinc-950">
                  <span>Tổng cộng</span>
                  <span>{money(detail.workOrder.total_amount)}</span>
                </div>
              </div>
              <div className="mt-4 grid gap-2">
                <InfoItem label="Trạng thái">{paymentStatus}</InfoItem>
                <InfoItem label="Phương thức">{detail.workOrder.payment_method ?? "Chưa có"}</InfoItem>
                <InfoItem label="Mã giao dịch">{detail.workOrder.transaction_ref ?? "Chưa có"}</InfoItem>
                <InfoItem label="Hạn công nợ">{detail.workOrder.debt_due_date ? dateTime(detail.workOrder.debt_due_date) : "Không có"}</InfoItem>
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "resources" ? (
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="modal-panel">
              <h3 className="section-title">Tệp đính kèm</h3>
              <div className="mt-3 grid gap-2">
                {detail.files.length === 0 ? (
                  <p className="text-sm text-zinc-500">Chưa có tệp.</p>
                ) : detail.files.map((file) => (
                  file.signed_url ? (
                    <a key={file.id} className="truncate text-sm font-semibold text-teal-700 underline" href={file.signed_url} target="_blank" rel="noreferrer">
                      {file.purpose}: {file.original_name}
                    </a>
                  ) : (
                    <span key={file.id} className="truncate text-sm font-semibold text-zinc-500">
                      {file.purpose}: {file.original_name}
                    </span>
                  )
                ))}
              </div>
            </div>
            <div className="modal-panel">
              <h3 className="section-title">Nghiệm thu công việc</h3>
              <div className="mt-3 grid gap-2">
                <a className="btn-secondary h-10 justify-center" href={`/api/work-orders/${detail.workOrder.id}/receipt`} target="_blank" rel="noreferrer">
                  <ReceiptText size={15} />Biên bản nghiệm thu
                </a>
                {signatureFile?.signed_url ? (
                  <a className="btn-secondary h-10 justify-center" href={signatureFile.signed_url} target="_blank" rel="noreferrer">
                    <Wrench size={15} />Xem chữ ký
                  </a>
                ) : (
                  <span className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-center text-sm text-zinc-500">Chưa có chữ ký</span>
                )}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </Modal>
  );
}
