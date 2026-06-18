"use client";

import { useState, type ReactNode } from "react";
import { CreditCard, FileText, History, MapPinned, Package, Phone, ReceiptText, UserRound, Wrench, type LucideIcon } from "lucide-react";
import { filePurposeLabel, TECHNICIAN_STATUS_LABELS, WORK_ORDER_STATUS_DESCRIPTIONS, WORK_ORDER_STATUS_LABELS, WORK_ORDER_TYPE_LABELS } from "@/lib/types";
import { dateTime, money } from "@/components/ops/format";
import { mapSearchUrl } from "@/components/ops/app-utils";
import { DeadlineBadge, Modal, StageBadge, StatusBadge } from "@/components/ops/ui";
import type { Technician, WorkOrderDetail } from "@/components/ops/types";
import { ModalListControls, clampPage, pageItems } from "@/components/ops/modals/modal-list-controls";
import { WorkFileGallery } from "@/components/ops/work-file-gallery";

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
    <div className="detail-card">
      <p className="detail-label">{label}</p>
      <div className="detail-value">{children}</div>
    </div>
  );
}

export function WorkOrderDetailModal({
  detail,
  onClose,
}: {
  detail: WorkOrderDetail;
  technicians: Technician[];
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [resourceQuery, setResourceQuery] = useState("");
  const [materialPage, setMaterialPage] = useState(1);
  const [filePage, setFilePage] = useState(1);
  const assignedTechnicians = detail.workOrder.assigned_technicians ?? [];
  const signatureFile = detail.files.find((file) => file.purpose === "signature");
  const paymentStatus = detail.workOrder.payment_status
    ? paymentLabels[detail.workOrder.payment_status] ?? detail.workOrder.payment_status
    : "Chưa thanh toán";
  const normalizedHistoryQuery = historyQuery.trim().toLowerCase();
  const filteredHistory = detail.history.filter((item) => {
    if (!normalizedHistoryQuery) return true;
    return [
      item.to_status,
      item.changed_by_name ?? "",
      item.note ?? "",
      dateTime(item.changed_at),
    ].some((value) => value.toLowerCase().includes(normalizedHistoryQuery));
  });
  const visibleHistory = pageItems(filteredHistory, clampPage(historyPage, filteredHistory.length));
  const normalizedResourceQuery = resourceQuery.trim().toLowerCase();
  const filteredMaterials = detail.materials.filter((material) => {
    if (!normalizedResourceQuery) return true;
    return [
      material.name,
      String(material.quantity),
      money(material.unit_price),
      money(material.line_total),
    ].some((value) => value.toLowerCase().includes(normalizedResourceQuery));
  });
  const filteredFiles = detail.files.filter((file) => {
    if (!normalizedResourceQuery) return true;
    return [filePurposeLabel(file.purpose), file.original_name].some((value) => value.toLowerCase().includes(normalizedResourceQuery));
  });
  const visibleMaterials = pageItems(filteredMaterials, clampPage(materialPage, filteredMaterials.length));
  const visibleFiles = pageItems(filteredFiles, clampPage(filePage, filteredFiles.length));
  const latestTransaction = detail.paymentTransactions[0];

  return (
    <Modal title={`Xem chi tiết công việc ${detail.workOrder.code}`} size="xl" onClose={onClose}>
      <div className="grid gap-4">
        <section className="modal-summary">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge order={detail.workOrder} />
            <StageBadge status={detail.workOrder.status} />
            <DeadlineBadge order={detail.workOrder} />
            <span className="text-sm font-semibold text-zinc-500">{WORK_ORDER_TYPE_LABELS[detail.workOrder.type]}</span>
            <span className="text-sm font-semibold text-zinc-400">{detail.workOrder.code}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-zinc-950">{detail.workOrder.customer_name}</h3>
              <p className="mt-1 text-sm text-zinc-500">Hẹn: {dateTime(detail.workOrder.appointment_at)}</p>
            </div>
            <p className="text-xl font-bold text-zinc-950">{money(detail.workOrder.total_amount)}</p>
          </div>
        </section>

        <nav className="modal-tabbar" aria-label="Xem chi tiết công việc">
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
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <InfoItem label="Mã công việc">{detail.workOrder.code}</InfoItem>
            <InfoItem label="Loại công việc">{WORK_ORDER_TYPE_LABELS[detail.workOrder.type]}</InfoItem>
            <InfoItem label="Độ ưu tiên">{detail.workOrder.priority === "urgent" ? "Khẩn cấp" : "Bình thường"}</InfoItem>
            <InfoItem label="Thời gian hẹn">{dateTime(detail.workOrder.appointment_at)}</InfoItem>
            <InfoItem label="Ngày tạo">{dateTime(detail.workOrder.created_at)}</InfoItem>
            <InfoItem label="Kỹ thuật viên">
              {assignedTechnicians.length > 0 ? assignedTechnicians.map((technician) => technician.full_name).join(", ") : "Chưa phân công"}
            </InfoItem>
            <InfoItem label="Trạng thái kỹ thuật">
              {assignedTechnicians.length > 0
                ? assignedTechnicians.map((technician) => `${technician.full_name}: ${TECHNICIAN_STATUS_LABELS[technician.status]}`).join(", ")
                : "Chưa gán"}
            </InfoItem>
            <InfoItem label="Thanh toán">{paymentStatus}</InfoItem>
            <div className="detail-card md:col-span-2 xl:col-span-4">
              <p className="detail-label">Mô tả công việc</p>
              <p className="detail-value whitespace-pre-wrap font-normal text-zinc-700">{detail.workOrder.description}</p>
            </div>
          </section>
        ) : null}

        {activeTab === "customer" ? (
          <section className="grid gap-3 md:grid-cols-2">
            <InfoItem label="Khách hàng">{detail.workOrder.customer_name}</InfoItem>
            <InfoItem label="Số điện thoại">
              <a className="inline-flex min-w-0 items-center gap-2 text-teal-700" href={`tel:${detail.workOrder.customer_phone}`}>
                <Phone size={15} className="shrink-0" />{detail.workOrder.customer_phone}
              </a>
            </InfoItem>
            <div className="detail-card md:col-span-2">
              <p className="detail-label">Địa chỉ</p>
              <a
                className="detail-value inline-flex items-start gap-2 text-teal-700"
                href={mapSearchUrl({ address: detail.workOrder.customer_address, lat: detail.workOrder.customer_lat, lng: detail.workOrder.customer_lng })}
                target="_blank"
                rel="noreferrer"
              >
                <MapPinned size={15} className="mt-0.5 shrink-0" />{detail.workOrder.customer_address}
              </a>
            </div>
            <div className="detail-card">
              <p className="detail-label">Ghi chú nội bộ</p>
              <p className="detail-value whitespace-pre-wrap font-normal text-zinc-700">{detail.workOrder.internal_note ?? "Không có ghi chú"}</p>
            </div>
            <div className="detail-card">
              <p className="detail-label">Ghi chú hoàn thành</p>
              <p className="detail-value whitespace-pre-wrap font-normal text-zinc-700">{detail.workOrder.completion_note ?? "Không có ghi chú"}</p>
            </div>
          </section>
        ) : null}

        {activeTab === "progress" ? (
          <section className="grid gap-3">
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={detail.workOrder.status} />
                <span className="font-semibold text-zinc-900">{WORK_ORDER_STATUS_LABELS[detail.workOrder.status]}</span>
              </div>
              <p className="mt-2 leading-6 text-zinc-600">{WORK_ORDER_STATUS_DESCRIPTIONS[detail.workOrder.status]}</p>
            </div>
            <ModalListControls
              query={historyQuery}
              onQueryChange={(nextQuery) => {
                setHistoryQuery(nextQuery);
                setHistoryPage(1);
              }}
              page={clampPage(historyPage, filteredHistory.length)}
              total={filteredHistory.length}
              label="Lọc lịch sử trạng thái"
              placeholder="Lọc theo trạng thái, người đổi, ghi chú..."
              onPageChange={(nextPage) => setHistoryPage(clampPage(nextPage, filteredHistory.length))}
            />
            {filteredHistory.length === 0 ? (
              <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
                Không có lịch sử phù hợp.
              </div>
            ) : (
              <div className="grid gap-3">
                {visibleHistory.map((item) => (
                  <div key={item.id} className="detail-card text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <StatusBadge status={item.to_status} />
                      <span className="font-semibold text-zinc-500">{dateTime(item.changed_at)}</span>
                    </div>
                    <p className="mt-2 font-semibold text-zinc-800">{item.changed_by_name ?? "Hệ thống"}</p>
                    {item.note ? <p className="mt-1 whitespace-pre-wrap text-zinc-600">{item.note}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {activeTab === "costs" ? (
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <InfoItem label="Tiền công">{money(detail.workOrder.labor_cost)}</InfoItem>
            <InfoItem label="Tiền vật tư">{money(detail.workOrder.material_amount)}</InfoItem>
            <InfoItem label="VAT">{money(detail.workOrder.vat_amount)}</InfoItem>
            <InfoItem label="Tổng cộng">{money(detail.workOrder.total_amount)}</InfoItem>
            <InfoItem label="Thanh toán">{paymentStatus}</InfoItem>
            <InfoItem label="Đã thu">{money(detail.workOrder.paid_amount)}</InfoItem>
            <InfoItem label="Còn nợ">{money(detail.workOrder.debt_amount)}</InfoItem>
            <InfoItem label="Phương thức">{detail.workOrder.payment_method ?? "Chưa có"}</InfoItem>
            <InfoItem label="Mã gần nhất">{latestTransaction?.transaction_ref ?? detail.workOrder.transaction_ref ?? "Chưa có"}</InfoItem>
            <InfoItem label="Hạn công nợ">{detail.workOrder.debt_due_date ? dateTime(detail.workOrder.debt_due_date) : "Không có"}</InfoItem>
            <div className="detail-card md:col-span-2 xl:col-span-4">
              <p className="detail-label">Ghi chú thanh toán</p>
              <p className="detail-value whitespace-pre-wrap font-normal text-zinc-700">{detail.workOrder.payment_note ?? "Không có ghi chú"}</p>
            </div>
          </section>
        ) : null}

        {activeTab === "resources" ? (
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="modal-section">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="section-title">Vật tư sử dụng</h3>
                <span className="text-xs font-semibold text-zinc-500">{filteredMaterials.length} mục</span>
              </div>
              <div className="mt-3">
                <ModalListControls
                  query={resourceQuery}
                  onQueryChange={(nextQuery) => {
                    setResourceQuery(nextQuery);
                    setMaterialPage(1);
                    setFilePage(1);
                  }}
                  page={clampPage(materialPage, filteredMaterials.length)}
                  total={filteredMaterials.length}
                  label="Lọc vật tư và tệp"
                  placeholder="Lọc vật tư, tệp, loại ảnh..."
                  onPageChange={(nextPage) => setMaterialPage(clampPage(nextPage, filteredMaterials.length))}
                />
              </div>
              {filteredMaterials.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-500">Không có vật tư phù hợp.</p>
              ) : (
                <div className="mt-3">
                  <table className="data-table data-table-compact">
                    <thead>
                      <tr>
                        <th>Tên vật tư</th>
                        <th>SL</th>
                        <th className="text-right">Đơn giá</th>
                        <th className="text-right">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleMaterials.map((material) => (
                        <tr key={material.id}>
                          <td data-label="Tên vật tư" className="font-medium text-zinc-900">{material.name}</td>
                          <td data-label="SL" className="text-zinc-700">{material.quantity}</td>
                          <td data-label="Đơn giá" className="text-right text-zinc-700">{money(material.unit_price)}</td>
                          <td data-label="Thành tiền" className="text-right font-bold text-zinc-900">{money(material.line_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="grid gap-4">
              <div className="modal-section">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="section-title">Tệp đính kèm</h3>
                  <span className="text-xs font-semibold text-zinc-500">{filteredFiles.length} mục</span>
                </div>
                <div className="mt-3">
                  <ModalListControls
                    query={resourceQuery}
                    onQueryChange={(nextQuery) => {
                      setResourceQuery(nextQuery);
                      setMaterialPage(1);
                      setFilePage(1);
                    }}
                    page={clampPage(filePage, filteredFiles.length)}
                    total={filteredFiles.length}
                    label="Lọc tệp đính kèm"
                    placeholder="Lọc vật tư, tệp, loại ảnh..."
                    onPageChange={(nextPage) => setFilePage(clampPage(nextPage, filteredFiles.length))}
                  />
                </div>
                <div className="mt-3">
                  <WorkFileGallery files={visibleFiles} />
                </div>
              </div>
              <div className="modal-section">
                <h3 className="section-title">Nghiệm thu</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <a className="btn-secondary h-10" href={`/api/work-orders/${detail.workOrder.id}/receipt`} target="_blank" rel="noreferrer">
                    <ReceiptText size={15} />Biên bản
                  </a>
                  {signatureFile?.signed_url ? (
                    <a className="btn-secondary h-10" href={signatureFile.signed_url} target="_blank" rel="noreferrer">
                      <Wrench size={15} />Chữ ký
                    </a>
                  ) : (
                    <span className="inline-flex min-h-10 items-center justify-center rounded-md border border-dashed border-zinc-300 px-3 text-sm font-semibold text-zinc-500">Chưa có chữ ký</span>
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </Modal>
  );
}
