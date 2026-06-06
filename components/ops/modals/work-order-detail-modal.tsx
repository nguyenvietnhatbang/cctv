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
  const assignedTechnician = technicians.find((technician) => technician.id === detail.workOrder.technician_id) ?? null;
  const signatureFile = detail.files.find((file) => file.purpose === "signature");
  const paymentStatus = detail.workOrder.payment_status
    ? paymentLabels[detail.workOrder.payment_status] ?? detail.workOrder.payment_status
    : "Chưa thanh toán";

  return (
    <Modal title={`Xem chi tiết công việc ${detail.workOrder.code}`} size="xl" onClose={onClose}>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Left Column: Main Workspace */}
        <div className="flex flex-col gap-5">
          {/* Customer & Description */}
          <section className="rounded-md border border-zinc-200 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Thông tin chung & Khách hàng</h3>
            <div className="grid gap-3 sm:grid-cols-2 mb-4">
              <InfoItem label="Khách hàng">{detail.workOrder.customer_name}</InfoItem>
              <InfoItem label="Số điện thoại">
                <a className="inline-flex items-center gap-1.5 text-teal-700" href={`tel:${detail.workOrder.customer_phone}`}>
                  <Phone size={14} />{detail.workOrder.customer_phone}
                </a>
              </InfoItem>
              <div className="rounded-md border border-zinc-200 p-3 sm:col-span-2">
                <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Địa chỉ</p>
                <a
                  className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 leading-snug"
                  href={`https://maps.google.com/?q=${encodeURIComponent(detail.workOrder.customer_address)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MapPinned size={14} className="shrink-0" />{detail.workOrder.customer_address}
                </a>
              </div>
            </div>

            <div className="rounded-md border border-zinc-200 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Mô tả công việc</p>
              <p className="mt-1 text-sm leading-6 text-zinc-800 whitespace-pre-wrap">{detail.workOrder.description}</p>
            </div>
          </section>

          {/* Materials */}
          <section className="rounded-md border border-zinc-200 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 border-b border-zinc-100 pb-1.5">Vật tư sử dụng</h3>
            {detail.materials.length === 0 ? (
              <p className="text-sm text-zinc-500 py-1">Chưa có vật tư sử dụng.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm divide-y divide-zinc-200">
                  <thead>
                    <tr className="text-left text-xs uppercase text-zinc-400">
                      <th className="py-2">Tên vật tư</th>
                      <th className="py-2 text-center">SL</th>
                      <th className="py-2 text-right">Đơn giá</th>
                      <th className="py-2 text-right">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-150">
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
          </section>

          {/* Resources & Acceptance */}
          <section className="rounded-md border border-zinc-200 p-4 flex flex-col gap-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-100 pb-1.5">Tệp tài liệu & Nghiệm thu</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-md border border-zinc-100 p-3 bg-zinc-50/30">
                <h4 className="text-xs font-bold uppercase text-zinc-500 mb-2">Tệp đính kèm</h4>
                {detail.files.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-1">Chưa có tệp.</p>
                ) : (
                  <div className="grid gap-1.5">
                    {detail.files.map((file) => (
                      file.signed_url ? (
                        <a key={file.id} className="text-xs font-semibold text-teal-700 underline truncate block" href={file.signed_url} target="_blank" rel="noreferrer">
                          {file.purpose}: {file.original_name}
                        </a>
                      ) : (
                        <span key={file.id} className="text-xs font-semibold text-zinc-500 truncate block">
                          {file.purpose}: {file.original_name}
                        </span>
                      )
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-md border border-zinc-100 p-3 bg-zinc-50/30">
                <h4 className="text-xs font-bold uppercase text-zinc-500 mb-2">Nghiệm thu công việc</h4>
                <div className="flex flex-col gap-2">
                  <a className="btn-secondary h-9 text-xs justify-center" href={`/api/work-orders/${detail.workOrder.id}/receipt`} target="_blank" rel="noreferrer">
                    <ReceiptText size={14} />Biên bản nghiệm thu
                  </a>
                  {signatureFile?.signed_url ? (
                    <a className="btn-secondary h-9 text-xs justify-center" href={signatureFile.signed_url} target="_blank" rel="noreferrer">
                      <Wrench size={14} />Xem chữ ký
                    </a>
                  ) : (
                    <span className="text-xs text-zinc-500 text-center py-2 border border-dashed border-zinc-200 rounded-md">Chưa có chữ ký</span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Timeline */}
          <section className="rounded-md border border-zinc-200 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 border-b border-zinc-100 pb-1.5">Lịch sử trạng thái</h3>
            {detail.history.length === 0 ? (
              <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-center text-xs text-zinc-400">
                Chưa có lịch sử trạng thái.
              </div>
            ) : (
              <div className="relative pl-6 border-l border-zinc-200 grid gap-4 ml-2 mt-2">
                {detail.history.map((item) => (
                  <div key={item.id} className="relative text-xs">
                    <span className="absolute -left-[30px] top-0.5 w-2 h-2 rounded-full bg-zinc-400 ring-4 ring-white" />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <StatusBadge status={item.to_status} />
                      <span className="font-semibold text-zinc-400">{dateTime(item.changed_at)}</span>
                    </div>
                    <p className="mt-1 font-semibold text-zinc-700">{item.changed_by_name ?? "Hệ thống"}</p>
                    {item.note ? <p className="mt-1 text-zinc-500 italic bg-zinc-50 p-2 rounded border border-zinc-100">{item.note}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Sidebar */}
        <div className="flex flex-col gap-5">
          {/* Metadata */}
          <section className="rounded-md border border-zinc-200 p-4 flex flex-col gap-3 bg-zinc-50/10">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-100 pb-1.5">Chi tiết công việc</h3>
            <InfoItem label="Trạng thái">
              <StatusBadge order={detail.workOrder} />
            </InfoItem>
            <InfoItem label="Mã công việc">{detail.workOrder.code}</InfoItem>
            <InfoItem label="Loại công việc">{WORK_ORDER_TYPE_LABELS[detail.workOrder.type]}</InfoItem>
            <InfoItem label="Độ ưu tiên">{detail.workOrder.priority === "urgent" ? "Khẩn cấp" : "Bình thường"}</InfoItem>
            <InfoItem label="Thời gian hẹn">{dateTime(detail.workOrder.appointment_at)}</InfoItem>
            <InfoItem label="Ngày tạo">{dateTime(detail.workOrder.created_at)}</InfoItem>
          </section>

          {/* Pricing & Payments */}
          <section className="rounded-md border border-zinc-200 p-4 flex flex-col gap-3 bg-zinc-50/10">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-100 pb-1.5">Chi phí & Thanh toán</h3>
            <InfoItem label="Thanh toán">{paymentStatus}</InfoItem>
            <InfoItem label="Phương thức">{detail.workOrder.payment_method ?? "Chưa có"}</InfoItem>
            <InfoItem label="Mã giao dịch">{detail.workOrder.transaction_ref ?? "Chưa có"}</InfoItem>
            <InfoItem label="Hạn công nợ">{detail.workOrder.debt_due_date ? dateTime(detail.workOrder.debt_due_date) : "Không có"}</InfoItem>
            <InfoItem label="Ghi chú thanh toán">{detail.workOrder.payment_note ?? "Không có"}</InfoItem>
            
            <div className="border-t border-zinc-200 pt-3 flex flex-col gap-1.5 text-xs text-zinc-600">
              <div className="flex justify-between">
                <span>Tiền công:</span>
                <span className="font-semibold text-zinc-850">{money(detail.workOrder.labor_cost)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tiền vật tư:</span>
                <span className="font-semibold text-zinc-850">{money(detail.workOrder.material_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Thuế VAT:</span>
                <span className="font-semibold text-zinc-850">{money(detail.workOrder.vat_amount)}</span>
              </div>
              <div className="flex justify-between border-t border-zinc-200 pt-1.5 text-sm text-zinc-950 font-extrabold">
                <span>Tổng cộng:</span>
                <span>{money(detail.workOrder.total_amount)}</span>
              </div>
            </div>
          </section>

          {/* Technician & Notes */}
          <section className="rounded-md border border-zinc-200 p-4 flex flex-col gap-3 bg-zinc-50/10">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-100 pb-1.5">Nhân viên phụ trách</h3>
            <InfoItem label="Kỹ thuật viên">{detail.workOrder.technician_name ?? "Chưa phân công"}</InfoItem>
            <InfoItem label="Trạng thái">{assignedTechnician ? TECHNICIAN_STATUS_LABELS[assignedTechnician.status] : "Chưa gán"}</InfoItem>
            
            <div className="rounded border border-zinc-150 p-2.5 mt-1 bg-white">
              <p className="text-[10px] font-bold uppercase text-zinc-400">Ghi chú nội bộ</p>
              <p className="mt-1 text-xs text-zinc-700 leading-relaxed whitespace-pre-wrap">{detail.workOrder.internal_note ?? "Không có ghi chú"}</p>
            </div>
            <div className="rounded border border-zinc-150 p-2.5 bg-white">
              <p className="text-[10px] font-bold uppercase text-zinc-400">Ghi chú hoàn thành</p>
              <p className="mt-1 text-xs text-zinc-700 leading-relaxed whitespace-pre-wrap">{detail.workOrder.completion_note ?? "Không có ghi chú"}</p>
            </div>
          </section>
        </div>
      </div>
    </Modal>
  );
}
