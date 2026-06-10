"use client";

import { FormEvent, useMemo, useState } from "react";
import { CreditCard, FileText, MapPinned, Phone, Plus, Trash2, Upload, UserRound, type LucideIcon } from "lucide-react";
import { ROLE_LABELS, TECHNICIAN_STATUS_LABELS, WORK_ORDER_TYPE_LABELS } from "@/lib/types";
import { dateTime, money } from "@/components/ops/format";
import { DeadlineBadge, Modal, PendingButton, StatusBadge, ValidatedForm } from "@/components/ops/ui";
import type { AppUser, Customer, CustomerContact, Technician, WorkOrderListItem } from "@/components/ops/types";
import { displayCustomerContacts } from "@/components/ops/app-utils";
import { ModalListControls, clampPage, pageItems } from "@/components/ops/modals/modal-list-controls";
import { ImageUploadField } from "@/components/ops/image-upload-field";

type CustomerTab = "info" | "orders" | "payments";
type CustomerEditTab = "info" | "contacts" | "payments";

const customerTabs: ReadonlyArray<{ id: CustomerTab; label: string; icon: LucideIcon }> = [
  { id: "info", label: "Thông tin", icon: UserRound },
  { id: "orders", label: "Phiếu", icon: FileText },
  { id: "payments", label: "Thanh toán", icon: CreditCard },
];

const customerEditTabs: ReadonlyArray<{ id: CustomerEditTab; label: string; icon: LucideIcon }> = [
  { id: "info", label: "Thông tin", icon: UserRound },
  { id: "contacts", label: "Liên hệ", icon: Phone },
  { id: "payments", label: "Thanh toán", icon: CreditCard },
];

const paymentLabels: Record<string, string> = {
  unpaid: "Chưa thanh toán",
  paid: "Đã thanh toán",
  debt: "Công nợ",
};

function CustomerContactFields({ contacts }: { contacts?: CustomerContact[] }) {
  const initialContacts = contacts?.length ? contacts : [{ id: "new-0", name: "", phone: "", note: "" }];
  const [rows, setRows] = useState(() => initialContacts.map((contact, index) => ({
    key: contact.id || `new-${index}`,
    name: contact.name,
    phone: contact.phone,
    note: contact.note ?? "",
  })));

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Người liên hệ</p>
        <button
          className="icon-button"
          onClick={() => setRows((current) => [...current, { key: `new-${Date.now()}`, name: "", phone: "", note: "" }])}
          type="button"
          aria-label="Thêm người liên hệ"
        >
          <Plus size={15} />
        </button>
      </div>
      {rows.map((row, index) => (
        <div key={row.key} className="grid gap-2 rounded-md border border-zinc-200 p-3 md:grid-cols-[1fr_1fr_auto]">
          <input name="contactName" className="input" defaultValue={row.name} placeholder={index === 0 ? "Tên người liên hệ chính" : "Tên người liên hệ"} required={index === 0} />
          <input name="contactPhone" className="input" defaultValue={row.phone} placeholder="SĐT người liên hệ" required={index === 0} />
          <button
            className="icon-button md:self-center"
            onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
            type="button"
            aria-label="Xóa người liên hệ"
            disabled={rows.length === 1}
          >
            <Trash2 size={15} />
          </button>
          <input name="contactNote" className="input md:col-span-3" defaultValue={row.note} placeholder="Ghi chú liên hệ" />
        </div>
      ))}
    </div>
  );
}

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
  const [ordersQuery, setOrdersQuery] = useState("");
  const [ordersPage, setOrdersPage] = useState(1);
  const [paymentsQuery, setPaymentsQuery] = useState("");
  const [paymentsPage, setPaymentsPage] = useState(1);
  const customerOrders = useMemo(
    () => orders.filter((order) => order.customer_id === item.id),
    [item.id, orders],
  );
  const normalizedOrdersQuery = ordersQuery.trim().toLowerCase();
  const filteredCustomerOrders = customerOrders.filter((order) => {
    if (!normalizedOrdersQuery) return true;
    return [order.code, WORK_ORDER_TYPE_LABELS[order.type], order.description, order.technician_name ?? "", dateTime(order.appointment_at ?? order.created_at)]
      .some((value) => value.toLowerCase().includes(normalizedOrdersQuery));
  });
  const visibleCustomerOrders = pageItems(filteredCustomerOrders, clampPage(ordersPage, filteredCustomerOrders.length));
  const normalizedPaymentsQuery = paymentsQuery.trim().toLowerCase();
  const filteredCustomerPayments = customerOrders.filter((order) => {
    if (!normalizedPaymentsQuery) return true;
    return [
      order.code,
      paymentLabels[order.payment_status ?? "unpaid"] ?? order.payment_status ?? "Chưa thanh toán",
      money(order.total_amount),
    ].some((value) => value.toLowerCase().includes(normalizedPaymentsQuery));
  });
  const visibleCustomerPayments = pageItems(filteredCustomerPayments, clampPage(paymentsPage, filteredCustomerPayments.length));
  const paidTotal = customerOrders
    .filter((order) => order.payment_status === "paid")
    .reduce((sum, order) => sum + Number(order.total_amount), 0);
  const debtTotal = customerOrders
    .filter((order) => order.payment_status === "debt" || order.status === "debt")
    .reduce((sum, order) => sum + Number(order.total_amount), 0);
  const contacts = displayCustomerContacts(item);

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

        <nav className="modal-tabbar" aria-label="Thông tin khách hàng">
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
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Người liên hệ</p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {contacts.map((contact) => (
                  <div key={contact.id} className="rounded-md border border-zinc-100 bg-zinc-50 p-3">
                    <p className="text-sm font-semibold text-zinc-900">{contact.name}</p>
                    <a className="mt-1 inline-flex items-center gap-2 text-sm text-teal-700" href={`tel:${contact.phone}`}><Phone size={14} />{contact.phone}</a>
                    {contact.note ? <p className="mt-1 text-xs text-zinc-500">{contact.note}</p> : null}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-md border border-zinc-200 p-3 md:col-span-2 xl:col-span-4">
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Ghi chú địa chỉ</p>
              <p className="mt-1 text-sm leading-6 text-zinc-700">{item.address_note ?? "Chưa có ghi chú"}</p>
            </div>
          </section>
        ) : null}

        {activeTab === "orders" ? (
          <section className="grid gap-2">
            <ModalListControls
              query={ordersQuery}
              onQueryChange={(nextQuery) => {
                setOrdersQuery(nextQuery);
                setOrdersPage(1);
              }}
              page={clampPage(ordersPage, filteredCustomerOrders.length)}
              total={filteredCustomerOrders.length}
              label="Lọc phiếu của khách hàng"
              placeholder="Lọc mã phiếu, loại việc, kỹ thuật..."
              onPageChange={(nextPage) => setOrdersPage(clampPage(nextPage, filteredCustomerOrders.length))}
            />
            {filteredCustomerOrders.length === 0 ? (
              <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
                Không có phiếu phù hợp.
              </div>
            ) : visibleCustomerOrders.map((order) => (
              <div key={order.id} className="rounded-md border border-zinc-200 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-zinc-950">{order.code}</p>
                    <p className="mt-1 text-zinc-500">{WORK_ORDER_TYPE_LABELS[order.type]} · {dateTime(order.appointment_at ?? order.created_at)}</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <StatusBadge order={order} />
                    <DeadlineBadge order={order} />
                  </div>
                </div>
                <p className="mt-2 text-zinc-600">{order.description}</p>
              </div>
            ))}
          </section>
        ) : null}

        {activeTab === "payments" ? (
          <section className="grid gap-2">
            <ModalListControls
              query={paymentsQuery}
              onQueryChange={(nextQuery) => {
                setPaymentsQuery(nextQuery);
                setPaymentsPage(1);
              }}
              page={clampPage(paymentsPage, filteredCustomerPayments.length)}
              total={filteredCustomerPayments.length}
              label="Lọc thanh toán của khách hàng"
              placeholder="Lọc mã phiếu, trạng thái, số tiền..."
              onPageChange={(nextPage) => setPaymentsPage(clampPage(nextPage, filteredCustomerPayments.length))}
            />
            {filteredCustomerPayments.length === 0 ? (
              <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
                Không có dữ liệu thanh toán phù hợp.
              </div>
            ) : visibleCustomerPayments.map((order) => (
              <div key={order.id} className="grid gap-2 rounded-md border border-zinc-200 p-3 text-sm md:grid-cols-[1fr_auto_auto] md:items-center">
                <div>
                  <p className="font-bold text-zinc-950">{order.code}</p>
                  <p className="mt-1 text-zinc-500">{paymentLabels[order.payment_status ?? "unpaid"] ?? order.payment_status ?? "Chưa thanh toán"}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-1.5">
                  <StatusBadge order={order} />
                  <DeadlineBadge order={order} />
                </div>
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
  orders,
  onClose,
  onSubmit,
  onBillUpload,
  isSubmitting = false,
  uploadingBillOrderId = null,
}: {
  item: Customer;
  orders: WorkOrderListItem[];
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onBillUpload: (orderId: string, event: FormEvent<HTMLFormElement>) => void;
  isSubmitting?: boolean;
  uploadingBillOrderId?: string | null;
}) {
  const [activeTab, setActiveTab] = useState<CustomerEditTab>("info");
  const customerOrders = orders.filter((order) => order.customer_id === item.id);
  const paymentOrders = customerOrders.filter((order) => ["completed", "awaiting_payment", "paid", "debt"].includes(order.status));

  return (
    <Modal title="Sửa khách hàng" size="xl" onClose={onClose}>
      <div className="grid gap-4">
        <nav className="modal-tabbar" aria-label="Sửa khách hàng">
          {customerEditTabs.map((tab) => {
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
        ) : null}

        {activeTab === "contacts" ? (
          <ValidatedForm onSubmit={onSubmit} aria-busy={isSubmitting} className="grid gap-3">
            <fieldset disabled={isSubmitting} className="contents">
              <CustomerContactFields contacts={displayCustomerContacts(item)} />
              <div className="flex justify-end gap-2">
                <button className="btn-secondary h-10" onClick={onClose} type="button">Hủy</button>
                <PendingButton className="btn-primary h-10" type="submit" pending={isSubmitting} pendingLabel="Đang lưu...">Lưu liên hệ</PendingButton>
              </div>
            </fieldset>
          </ValidatedForm>
        ) : null}

        {activeTab === "payments" ? (
          <section className="grid gap-2">
            {paymentOrders.length === 0 ? (
              <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
                Khách hàng chưa có phiếu cần thanh toán.
              </div>
            ) : paymentOrders.map((order) => (
              <div key={order.id} className="grid gap-3 rounded-md border border-zinc-200 p-3 text-sm md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <p className="font-bold text-zinc-950">{order.code}</p>
                  <p className="mt-1 text-zinc-500">{paymentLabels[order.payment_status ?? "unpaid"] ?? order.payment_status ?? "Chưa thanh toán"} · {money(order.total_amount)}</p>
                </div>
                <ValidatedForm onSubmit={(event) => onBillUpload(order.id, event)} className="grid gap-2 sm:grid-cols-[minmax(180px,260px)_auto]">
                  <ImageUploadField name="file" className="input h-10" capture="environment" required disabled={uploadingBillOrderId === order.id} aria-label={`Ảnh bill ${order.code}`} previewLabel={`Xem trước ảnh bill ${order.code}`} />
                  <PendingButton className="btn-secondary h-10" type="submit" pending={uploadingBillOrderId === order.id} pendingLabel="Đang tải lên...">
                    <Upload size={15} />Tải bill lên
                  </PendingButton>
                </ValidatedForm>
              </div>
            ))}
          </section>
        ) : null}
      </div>
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

export function CustomerCreateModal({
  onClose,
  onSubmit,
  isSubmitting = false,
}: {
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSubmitting?: boolean;
}) {
  return (
    <Modal title="Tạo khách hàng" onClose={onClose}>
      <ValidatedForm onSubmit={onSubmit} aria-busy={isSubmitting} className="grid gap-3">
        <fieldset disabled={isSubmitting} className="contents">
          <input name="name" className="input" placeholder="Tên khách" required />
          <input name="phone" className="input" placeholder="Số điện thoại" required />
          <input name="address" className="input" placeholder="Địa chỉ" required />
          <input name="addressNote" className="input" placeholder="Ghi chú địa chỉ" />
          <CustomerContactFields />
          <div className="flex justify-end gap-2">
            <button className="btn-secondary h-10" onClick={onClose} type="button">Hủy</button>
            <PendingButton className="btn-primary h-10" type="submit" pending={isSubmitting} pendingLabel="Đang tạo...">Tạo khách hàng</PendingButton>
          </div>
        </fieldset>
      </ValidatedForm>
    </Modal>
  );
}

export function UserCreateModal({
  onClose,
  onSubmit,
  isSubmitting = false,
}: {
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSubmitting?: boolean;
}) {
  const [selectedRole, setSelectedRole] = useState("dispatcher");

  return (
    <Modal title="Tạo nhân viên" onClose={onClose}>
      <ValidatedForm onSubmit={onSubmit} aria-busy={isSubmitting} className="grid gap-3">
        <fieldset disabled={isSubmitting} className="contents">
          <input name="fullName" className="input" placeholder="Họ tên" required />
          <input name="email" type="email" className="input" placeholder="Email" />
          <input name="phone" className="input" placeholder="Số điện thoại" />
          <input name="password" type="password" className="input" placeholder="Mật khẩu (ít nhất 8 ký tự)" required minLength={8} />
          <select 
            name="role" 
            className="input" 
            value={selectedRole} 
            onChange={(e) => setSelectedRole(e.target.value)}
          >
            {Object.entries(ROLE_LABELS).map(([role, label]) => (
              <option key={role} value={role}>{label}</option>
            ))}
          </select>
          {selectedRole === "technician" ? (
            <input name="serviceArea" className="input" placeholder="Khu vực phụ trách (ví dụ: Quận 1, Quận 3)" />
          ) : null}
          <div className="flex justify-end gap-2">
            <button className="btn-secondary h-10" onClick={onClose} type="button">Hủy</button>
            <PendingButton className="btn-primary h-10" type="submit" pending={isSubmitting} pendingLabel="Đang tạo...">Tạo nhân viên</PendingButton>
          </div>
        </fieldset>
      </ValidatedForm>
    </Modal>
  );
}
