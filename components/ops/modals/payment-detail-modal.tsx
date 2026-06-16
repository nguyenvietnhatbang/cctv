"use client";

import { useState, type ReactNode } from "react";
import { CreditCard, History, ReceiptText, UserRound, type LucideIcon } from "lucide-react";
import { WORK_ORDER_TYPE_LABELS } from "@/lib/types";
import { dateTime, money } from "@/components/ops/format";
import { DeadlineBadge, Modal, StatusBadge } from "@/components/ops/ui";
import type { WorkOrderDetail } from "@/components/ops/types";
import { ModalListControls, clampPage, pageItems } from "@/components/ops/modals/modal-list-controls";
import { WorkFileGallery } from "@/components/ops/work-file-gallery";

type PaymentTab = "summary" | "customer" | "costs" | "history";

const tabs: ReadonlyArray<{ id: PaymentTab; label: string; icon: LucideIcon }> = [
  { id: "summary", label: "Tổng quan", icon: ReceiptText },
  { id: "customer", label: "Khách hàng", icon: UserRound },
  { id: "costs", label: "Chi phí", icon: CreditCard },
  { id: "history", label: "Lịch sử", icon: History },
];

const paymentLabels: Record<string, string> = {
  unpaid: "Chưa thanh toán",
  paid: "Đã thanh toán",
  debt: "Công nợ",
};

const methodLabels: Record<string, string> = {
  cash: "Tiền mặt",
  bank_transfer: "Chuyển khoản",
  debt: "Công nợ",
};

function InfoItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="detail-card">
      <p className="detail-label">{label}</p>
      <div className="detail-value">{children}</div>
    </div>
  );
}

export function PaymentDetailModal({
  detail,
  onClose,
}: {
  detail: WorkOrderDetail;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<PaymentTab>("summary");
  const [materialQuery, setMaterialQuery] = useState("");
  const [materialPage, setMaterialPage] = useState(1);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const paymentStatus = detail.workOrder.payment_status
    ? paymentLabels[detail.workOrder.payment_status] ?? detail.workOrder.payment_status
    : "Chưa thanh toán";
  const paymentMethod = detail.workOrder.payment_method
    ? methodLabels[detail.workOrder.payment_method] ?? detail.workOrder.payment_method
    : "Chưa có";
  const normalizedMaterialQuery = materialQuery.trim().toLowerCase();
  const filteredMaterials = detail.materials.filter((material) => {
    if (!normalizedMaterialQuery) return true;
    return [material.name, String(material.quantity), money(material.line_total)]
      .some((value) => value.toLowerCase().includes(normalizedMaterialQuery));
  });
  const visibleMaterials = pageItems(filteredMaterials, clampPage(materialPage, filteredMaterials.length));
  const normalizedHistoryQuery = historyQuery.trim().toLowerCase();
  const filteredHistory = detail.history.filter((item) => {
    if (!normalizedHistoryQuery) return true;
    return [item.to_status, item.changed_by_name ?? "", item.note ?? "", dateTime(item.changed_at)]
      .some((value) => value.toLowerCase().includes(normalizedHistoryQuery));
  });
  const visibleHistory = pageItems(filteredHistory, clampPage(historyPage, filteredHistory.length));
  const billFiles = detail.files.filter((file) => file.purpose === "bill");

  return (
    <Modal title={`Xem thanh toán ${detail.workOrder.code}`} size="xl" onClose={onClose}>
      <div className="grid gap-4">
        <section className="modal-summary">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge order={detail.workOrder} />
            <DeadlineBadge order={detail.workOrder} />
            <span className="text-sm font-semibold text-zinc-500">{WORK_ORDER_TYPE_LABELS[detail.workOrder.type]}</span>
            <span className="text-sm font-semibold text-zinc-400">{detail.workOrder.code}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-zinc-950">{detail.workOrder.customer_name}</h3>
              <p className="mt-1 text-sm text-zinc-500">{paymentStatus}</p>
            </div>
            <p className="text-2xl font-bold text-zinc-950">{money(detail.workOrder.total_amount)}</p>
          </div>
        </section>

        <nav className="modal-tabbar" aria-label="Thông tin thanh toán">
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

        {activeTab === "summary" ? (
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <InfoItem label="Mã công việc">{detail.workOrder.code}</InfoItem>
            <InfoItem label="Thanh toán">{paymentStatus}</InfoItem>
            <InfoItem label="Phương thức">{paymentMethod}</InfoItem>
            <InfoItem label="Mã giao dịch">{detail.workOrder.transaction_ref ?? "Chưa có"}</InfoItem>
            <InfoItem label="Hạn công nợ">{detail.workOrder.debt_due_date ? dateTime(detail.workOrder.debt_due_date) : "Không có"}</InfoItem>
            <InfoItem label="Ngày hẹn">{dateTime(detail.workOrder.appointment_at)}</InfoItem>
            <InfoItem label="Ngày tạo">{dateTime(detail.workOrder.created_at)}</InfoItem>
            <div className="detail-card md:col-span-2">
              <p className="detail-label">Ghi chú thanh toán</p>
              <p className="detail-value whitespace-pre-wrap font-normal text-zinc-700">{detail.workOrder.payment_note ?? "Chưa có ghi chú"}</p>
            </div>
            <div className="detail-card md:col-span-2">
              <p className="detail-label">Ảnh bill</p>
              <div className="mt-2 grid gap-2">
                {billFiles.length === 0 ? <p className="detail-value">Chưa có ảnh bill</p> : <WorkFileGallery files={billFiles} />}
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "customer" ? (
          <section className="grid gap-3 md:grid-cols-2">
            <InfoItem label="Khách hàng">{detail.workOrder.customer_name}</InfoItem>
            <InfoItem label="Số điện thoại">{detail.workOrder.customer_phone}</InfoItem>
            <div className="detail-card md:col-span-2">
              <p className="detail-label">Địa chỉ</p>
              <p className="detail-value">{detail.workOrder.customer_address}</p>
            </div>
          </section>
        ) : null}

        {activeTab === "costs" ? (
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <InfoItem label="Tiền công">{money(detail.workOrder.labor_cost)}</InfoItem>
            <InfoItem label="Vật tư">{money(detail.workOrder.material_amount)}</InfoItem>
            <InfoItem label="VAT">{money(detail.workOrder.vat_amount)}</InfoItem>
            <InfoItem label="Tổng">{money(detail.workOrder.total_amount)}</InfoItem>
            <div className="modal-section md:col-span-2 xl:col-span-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="section-title">Vật tư</h3>
                <span className="text-xs font-semibold text-zinc-500">{filteredMaterials.length} mục</span>
              </div>
              <div className="mt-3">
                <ModalListControls
                  query={materialQuery}
                  onQueryChange={(nextQuery) => {
                    setMaterialQuery(nextQuery);
                    setMaterialPage(1);
                  }}
                  page={clampPage(materialPage, filteredMaterials.length)}
                  total={filteredMaterials.length}
                  label="Lọc vật tư thanh toán"
                  placeholder="Lọc vật tư, số lượng, thành tiền..."
                  onPageChange={(nextPage) => setMaterialPage(clampPage(nextPage, filteredMaterials.length))}
                />
              </div>
              <div className="mt-3 grid gap-2">
                {filteredMaterials.length === 0 ? <p className="text-sm text-zinc-500">Không có vật tư phù hợp.</p> : visibleMaterials.map((material) => (
                  <div key={material.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-zinc-800">{material.name} x {material.quantity}</span>
                    <span className="text-zinc-600">{money(material.line_total)}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "history" ? (
          <section className="grid gap-2">
            <ModalListControls
              query={historyQuery}
              onQueryChange={(nextQuery) => {
                setHistoryQuery(nextQuery);
                setHistoryPage(1);
              }}
              page={clampPage(historyPage, filteredHistory.length)}
              total={filteredHistory.length}
              label="Lọc lịch sử thanh toán"
              placeholder="Lọc theo trạng thái, người đổi, ghi chú..."
              onPageChange={(nextPage) => setHistoryPage(clampPage(nextPage, filteredHistory.length))}
            />
            {filteredHistory.length === 0 ? (
              <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
                Không có lịch sử phù hợp.
              </div>
            ) : visibleHistory.map((item) => (
              <div key={item.id} className="detail-card text-sm">
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
      </div>
    </Modal>
  );
}
