"use client";

import { FormEvent, useMemo, useState } from "react";
import { CreditCard, FileText, MapPinned, Phone, UserRound, type LucideIcon } from "lucide-react";
import { ROLE_LABELS, TECHNICIAN_STATUS_LABELS, WORK_ORDER_TYPE_LABELS } from "@/lib/types";
import { dateTime, money } from "@/components/ops/format";
import { Modal, PendingButton, StatusBadge, ValidatedForm } from "@/components/ops/ui";
import type { AppUser, Customer, Technician, WorkOrderListItem } from "@/components/ops/types";

type CustomerTab = "info" | "orders" | "payments";

const customerTabs: ReadonlyArray<{ id: CustomerTab; label: string; icon: LucideIcon }> = [
  { id: "info", label: "Thông tin", icon: UserRound },
  { id: "orders", label: "Phiếu", icon: FileText },
  { id: "payments", label: "Thanh toán", icon: CreditCard },
];

const paymentLabels: Record<string, string> = {
  unpaid: "Chưa thanh toán",
  paid: "Đã thanh toán",
  debt: "Công nợ",
};

export function CustomerDetailModal({
  item,
  orders,
  onClose,
}: {
  item: Customer;
  orders: WorkOrderListItem[];
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<CustomerTab>("info");
  const customerOrders = useMemo(
    () => orders.filter((order) => order.customer_id === item.id),
    [item.id, orders],
  );
  const paidTotal = customerOrders
    .filter((order) => order.payment_status === "paid")
    .reduce((sum, order) => sum + Number(order.total_amount), 0);
  const debtTotal = customerOrders
    .filter((order) => order.payment_status === "debt" || order.status === "debt")
    .reduce((sum, order) => sum + Number(order.total_amount), 0);

  return (
    <Modal title={`Xem khách hàng ${item.name}`} size="xl" onClose={onClose}>
      <div className="grid gap-4">
        <section className="rounded-md border border-zinc-200 p-4">
          <h3 className="text-lg font-bold text-zinc-950">{item.name}</h3>
          <div className="mt-3 grid gap-2 text-sm text-zinc-600 md:grid-cols-2">
            <a className="inline-flex items-center gap-2 text-teal-700" href={`tel:${item.phone}`}><Phone size={15} />{item.phone}</a>
            <a
              className="inline-flex items-center gap-2 text-teal-700"
              href={`https://maps.google.com/?q=${encodeURIComponent(item.address)}`}
              target="_blank"
              rel="noreferrer"
            >
              <MapPinned size={15} />{item.address}
            </a>
          </div>
        </section>

        <nav className="flex gap-2 overflow-x-auto" aria-label="Thông tin khách hàng">
          {customerTabs.map((tab) => {
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

        {activeTab === "info" ? (
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-md border border-zinc-200 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Ngày tạo</p>
              <p className="mt-1 text-sm font-semibold text-zinc-900">{dateTime(item.created_at)}</p>
            </div>
            <div className="rounded-md border border-zinc-200 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Số phiếu</p>
              <p className="mt-1 text-sm font-semibold text-zinc-900">{customerOrders.length}</p>
            </div>
            <div className="rounded-md border border-zinc-200 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Đã thu</p>
              <p className="mt-1 text-sm font-semibold text-zinc-900">{money(paidTotal)}</p>
            </div>
            <div className="rounded-md border border-zinc-200 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Công nợ</p>
              <p className="mt-1 text-sm font-semibold text-zinc-900">{money(debtTotal)}</p>
            </div>
            <div className="rounded-md border border-zinc-200 p-3 md:col-span-2 xl:col-span-4">
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Ghi chú địa chỉ</p>
              <p className="mt-1 text-sm leading-6 text-zinc-700">{item.address_note ?? "Chưa có ghi chú"}</p>
            </div>
          </section>
        ) : null}

        {activeTab === "orders" ? (
          <section className="grid gap-2">
            {customerOrders.length === 0 ? (
              <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
                Khách hàng chưa có phiếu.
              </div>
            ) : customerOrders.map((order) => (
              <div key={order.id} className="rounded-md border border-zinc-200 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-zinc-950">{order.code}</p>
                    <p className="mt-1 text-zinc-500">{WORK_ORDER_TYPE_LABELS[order.type]} · {dateTime(order.appointment_at ?? order.created_at)}</p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
                <p className="mt-2 text-zinc-600">{order.description}</p>
              </div>
            ))}
          </section>
        ) : null}

        {activeTab === "payments" ? (
          <section className="grid gap-2">
            {customerOrders.length === 0 ? (
              <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
                Chưa có dữ liệu thanh toán.
              </div>
            ) : customerOrders.map((order) => (
              <div key={order.id} className="grid gap-2 rounded-md border border-zinc-200 p-3 text-sm md:grid-cols-[1fr_auto_auto] md:items-center">
                <div>
                  <p className="font-bold text-zinc-950">{order.code}</p>
                  <p className="mt-1 text-zinc-500">{paymentLabels[order.payment_status ?? "unpaid"] ?? order.payment_status ?? "Chưa thanh toán"}</p>
                </div>
                <StatusBadge status={order.status} />
                <p className="font-bold text-zinc-950 md:text-right">{money(order.total_amount)}</p>
              </div>
            ))}
          </section>
        ) : null}
      </div>
    </Modal>
  );
}

export function CustomerEditModal({
  item,
  onClose,
  onSubmit,
  isSubmitting = false,
}: {
  item: Customer;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSubmitting?: boolean;
}) {
  return (
    <Modal title="Sửa khách hàng" onClose={onClose}>
      <ValidatedForm onSubmit={onSubmit} aria-busy={isSubmitting} className="grid gap-3">
        <fieldset disabled={isSubmitting} className="contents">
          <input name="name" className="input" defaultValue={item.name} placeholder="Tên khách" required />
          <input name="phone" className="input" defaultValue={item.phone} placeholder="Số điện thoại" required />
          <input name="address" className="input" defaultValue={item.address} placeholder="Địa chỉ" required />
          <input name="addressNote" className="input" defaultValue={item.address_note ?? ""} placeholder="Ghi chú địa chỉ" />
          <div className="flex justify-end gap-2">
            <button className="btn-secondary h-10" onClick={onClose} type="button">Hủy</button>
            <PendingButton className="btn-primary h-10" type="submit" pending={isSubmitting} pendingLabel="Đang lưu...">Lưu</PendingButton>
          </div>
        </fieldset>
      </ValidatedForm>
    </Modal>
  );
}

export function UserEditModal({
  item,
  onClose,
  onSubmit,
  isSubmitting = false,
}: {
  item: AppUser;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSubmitting?: boolean;
}) {
  return (
    <Modal title="Sửa nhân viên" onClose={onClose}>
      <ValidatedForm onSubmit={onSubmit} aria-busy={isSubmitting} className="grid gap-3">
        <fieldset disabled={isSubmitting} className="contents">
          <input name="fullName" className="input" defaultValue={item.full_name} placeholder="Họ tên" required />
          <input name="email" type="email" className="input" defaultValue={item.email ?? ""} placeholder="Email" />
          <input name="phone" className="input" defaultValue={item.phone ?? ""} placeholder="Số điện thoại" />
          <select name="role" className="input" defaultValue={item.role}>
            {Object.entries(ROLE_LABELS).map(([role, label]) => <option key={role} value={role}>{label}</option>)}
          </select>
          <select name="status" className="input" defaultValue={item.status}>
            <option value="active">Hoạt động</option>
            <option value="inactive">Ngưng</option>
          </select>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary h-10" onClick={onClose} type="button">Hủy</button>
            <PendingButton className="btn-primary h-10" type="submit" pending={isSubmitting} pendingLabel="Đang lưu...">Lưu</PendingButton>
          </div>
        </fieldset>
      </ValidatedForm>
    </Modal>
  );
}

export function TechnicianEditModal({
  item,
  onClose,
  onSubmit,
  isSubmitting = false,
}: {
  item: Technician;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSubmitting?: boolean;
}) {
  return (
    <Modal title="Sửa kỹ thuật viên" onClose={onClose}>
      <ValidatedForm onSubmit={onSubmit} aria-busy={isSubmitting} className="grid gap-3">
        <fieldset disabled={isSubmitting} className="contents">
          <input className="input" value={item.full_name} disabled />
          <input name="serviceArea" className="input" defaultValue={item.service_area ?? ""} placeholder="Khu vực phụ trách" />
          <select name="status" className="input" defaultValue={item.status}>
            {Object.entries(TECHNICIAN_STATUS_LABELS).map(([status, label]) => <option key={status} value={status}>{label}</option>)}
          </select>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary h-10" onClick={onClose} type="button">Hủy</button>
            <PendingButton className="btn-primary h-10" type="submit" pending={isSubmitting} pendingLabel="Đang lưu...">Lưu</PendingButton>
          </div>
        </fieldset>
      </ValidatedForm>
    </Modal>
  );
}
