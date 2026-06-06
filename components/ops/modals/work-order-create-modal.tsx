"use client";

import { FormEvent, useMemo, useState } from "react";
import { WORK_ORDER_TYPE_LABELS, WORK_ORDER_TYPES } from "@/lib/types";
import { Modal } from "@/components/ops/ui";
import type { Customer, Technician } from "@/components/ops/types";

export function WorkOrderCreateModal({
  customers,
  technicians,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  customers: Customer[];
  technicians: Technician[];
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
}) {
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    try {
      await onSubmit(event);
      setSelectedCustomerId("");
      onClose();
    } catch {
      // The parent screen owns the visible error banner.
    }
  }

  return (
    <Modal title="Tạo phiếu mới" size="lg" onClose={onClose}>
      <form onSubmit={handleSubmit} aria-busy={isSubmitting} className="grid gap-4">
        <fieldset disabled={isSubmitting} className="contents">
          <div className="grid gap-3 md:grid-cols-2">
            <select name="customerId" className="input md:col-span-2" value={selectedCustomerId} onChange={(event) => setSelectedCustomerId(event.target.value)}>
            <option value="">Khách mới</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>{customer.name} · {customer.phone}</option>
            ))}
            </select>
            {selectedCustomer ? (
              <div className="rounded-md border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-900 md:col-span-2">
                <p className="font-semibold">{selectedCustomer.name} · {selectedCustomer.phone}</p>
                <p className="mt-1">{selectedCustomer.address}</p>
                {selectedCustomer.address_note ? <p className="mt-1 text-cyan-700">{selectedCustomer.address_note}</p> : null}
              </div>
            ) : (
              <>
                <input name="customerName" className="input" placeholder="Tên khách" required />
                <input name="customerPhone" className="input" placeholder="Số điện thoại" required />
                <input name="customerAddress" className="input" placeholder="Địa chỉ" required />
                <input name="addressNote" className="input" placeholder="Ghi chú địa chỉ" />
              </>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <select name="type" className="input" defaultValue="maintenance">
              {WORK_ORDER_TYPES.map((type) => <option key={type} value={type}>{WORK_ORDER_TYPE_LABELS[type]}</option>)}
            </select>
            <select name="priority" className="input" defaultValue="normal">
              <option value="normal">Bình thường</option>
              <option value="urgent">Gấp</option>
            </select>
            <input name="appointmentAt" type="datetime-local" className="input" />
            <select name="technicianId" className="input" defaultValue="">
              <option value="">Lưu chờ phân công</option>
              {technicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.full_name}</option>)}
            </select>
          </div>
          <textarea name="description" className="input min-h-24" placeholder="Mô tả sự cố/yêu cầu" required />
          <input name="internalNote" className="input" placeholder="Ghi chú nội bộ" />
          <div className="flex justify-end gap-2">
            <button className="btn-secondary h-10" onClick={onClose} type="button">Hủy</button>
            <button className="btn-primary h-10" type="submit">{isSubmitting ? "Đang tạo..." : "Tạo phiếu"}</button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
