"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { TECHNICIAN_STATUS_LABELS, WORK_ORDER_TYPE_LABELS, WORK_ORDER_TYPES } from "@/lib/types";
import { Modal, PendingButton, ValidatedForm } from "@/components/ops/ui";
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
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [selectedTechnicianIds, setSelectedTechnicianIds] = useState<string[]>([]);
  const [technicianQuery, setTechnicianQuery] = useState("");
  const [technicianDropdownOpen, setTechnicianDropdownOpen] = useState(false);
  const technicianDropdownRef = useRef<HTMLDivElement | null>(null);
  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId],
  );
  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();

    return customers
      .filter((customer) => {
        if (!q) return true;
        return [customer.name, customer.phone, customer.address]
          .some((value) => value.toLowerCase().includes(q));
      })
      .sort((left, right) => left.name.localeCompare(right.name, "vi", { sensitivity: "base" }));
  }, [customerQuery, customers]);
  const filteredTechnicians = useMemo(() => {
    const query = technicianQuery.trim().toLocaleLowerCase("vi");

    return technicians
      .filter((technician) => {
        if (!query) return true;
        return [
          technician.full_name,
          technician.phone ?? "",
          technician.email ?? "",
          technician.service_area ?? "",
        ].some((value) => value.toLocaleLowerCase("vi").includes(query));
      })
      .sort((left, right) => left.full_name.localeCompare(right.full_name, "vi", { sensitivity: "base" }));
  }, [technicianQuery, technicians]);
  const selectedTechnicians = useMemo(
    () => technicians.filter((technician) => selectedTechnicianIds.includes(technician.id)),
    [selectedTechnicianIds, technicians],
  );
  const technicianSelectionLabel = selectedTechnicians.length === 0
    ? "Chưa phân công"
    : selectedTechnicians.length <= 2
      ? selectedTechnicians.map((technician) => technician.full_name).join(", ")
      : `Đã chọn ${selectedTechnicians.length} kỹ thuật viên`;

  useEffect(() => {
    function closeTechnicianDropdown(event: MouseEvent) {
      if (!technicianDropdownRef.current?.contains(event.target as Node)) {
        setTechnicianDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", closeTechnicianDropdown);
    return () => document.removeEventListener("mousedown", closeTechnicianDropdown);
  }, []);

  useEffect(() => {
    if (!technicianDropdownOpen) setTechnicianQuery("");
  }, [technicianDropdownOpen]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    try {
      await onSubmit(event);
      setSelectedCustomerId("");
      setSelectedTechnicianIds([]);
      onClose();
    } catch {
      // The parent screen owns the visible error banner.
    }
  }

  return (
    <Modal title="Tạo phiếu mới" size="lg" onClose={onClose}>
      <ValidatedForm onSubmit={handleSubmit} aria-busy={isSubmitting} className="grid gap-4">
        <fieldset disabled={isSubmitting} className="contents">
          <div className="grid gap-3 md:grid-cols-2">
            <input type="hidden" name="customerId" value={selectedCustomerId} />
            <div className="relative grid gap-1 md:col-span-2">
              <span className="text-xs font-bold uppercase text-zinc-500">Chọn khách hàng</span>
              <button
                type="button"
                className="input flex items-center justify-between gap-3 text-left"
                onClick={() => setCustomerDropdownOpen((open) => !open)}
                aria-expanded={customerDropdownOpen}
              >
                <span className="min-w-0 truncate">
                  {selectedCustomer ? `${selectedCustomer.name} · ${selectedCustomer.phone}` : "Khách mới"}
                </span>
                <span className="text-xs font-semibold text-zinc-500">▾</span>
              </button>
              {customerDropdownOpen ? (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-md border border-zinc-200 bg-white p-2 shadow-lg">
                  <input
                    className="input"
                    value={customerQuery}
                    onChange={(event) => setCustomerQuery(event.target.value)}
                    placeholder="Tìm theo tên, SĐT, địa chỉ..."
                    autoFocus
                  />
                  <div className="mt-2 max-h-56 overflow-y-auto">
                    <button
                      type="button"
                      className={`grid w-full gap-0.5 rounded-md p-2 text-left text-sm hover:bg-zinc-50 ${!selectedCustomerId ? "bg-blue-50 text-blue-900" : ""}`}
                      onClick={() => {
                        setSelectedCustomerId("");
                        setCustomerDropdownOpen(false);
                      }}
                    >
                      <span className="font-semibold">Khách mới</span>
                      <span className="text-xs text-zinc-500">Nhập thông tin khách hàng mới bên dưới</span>
                    </button>
                    {filteredCustomers.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        className={`mt-1 grid w-full gap-0.5 rounded-md p-2 text-left text-sm hover:bg-zinc-50 ${selectedCustomerId === customer.id ? "bg-blue-50 text-blue-900" : ""}`}
                        onClick={() => {
                          setSelectedCustomerId(customer.id);
                          setCustomerDropdownOpen(false);
                        }}
                      >
                        <span className="truncate font-semibold">{customer.name} · {customer.phone}</span>
                        <span className="line-clamp-2 text-xs leading-5 text-zinc-500">{customer.address}</span>
                      </button>
                    ))}
                    {filteredCustomers.length === 0 ? (
                      <p className="rounded-md bg-zinc-50 px-3 py-4 text-center text-sm text-zinc-500">Không tìm thấy khách hàng phù hợp.</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
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
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid min-w-0 content-start gap-1">
              <span className="text-xs font-bold uppercase text-zinc-500">Loại công việc</span>
              <select name="type" className="input" defaultValue="installation">
                {WORK_ORDER_TYPES.map((type) => <option key={type} value={type}>{WORK_ORDER_TYPE_LABELS[type]}</option>)}
              </select>
            </label>
            <label className="grid min-w-0 content-start gap-1">
              <span className="text-xs font-bold uppercase text-zinc-500">Ưu tiên</span>
              <select name="priority" className="input" defaultValue="normal">
                <option value="normal">Bình thường</option>
                <option value="urgent">Gấp</option>
              </select>
            </label>
            <label className="grid min-w-0 content-start gap-1">
              <span className="text-xs font-bold uppercase text-zinc-500">Ngày hẹn khách</span>
              <input name="appointmentAt" type="datetime-local" className="input" />
            </label>
            <div className="relative grid min-w-0 content-start gap-1" ref={technicianDropdownRef}>
              <span className="text-xs font-bold uppercase text-zinc-500">Kỹ thuật viên</span>
              {selectedTechnicianIds.map((technicianId) => (
                <input key={technicianId} type="hidden" name="technicianIds" value={technicianId} />
              ))}
              <button
                type="button"
                className="input flex items-center justify-between gap-3 text-left"
                onClick={() => {
                  setCustomerDropdownOpen(false);
                  setTechnicianDropdownOpen((open) => !open);
                }}
                aria-expanded={technicianDropdownOpen}
                aria-haspopup="dialog"
              >
                <span className="min-w-0 truncate">{technicianSelectionLabel}</span>
                <ChevronDown size={15} className="shrink-0 text-zinc-500" />
              </button>
              {technicianDropdownOpen ? (
                <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-md border border-zinc-200 bg-white shadow-lg">
                  <div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-2 text-zinc-500">
                    <Search size={14} className="shrink-0" />
                    <input
                      value={technicianQuery}
                      onChange={(event) => setTechnicianQuery(event.target.value)}
                      className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-zinc-900 outline-none"
                      placeholder="Tìm tên, SĐT, khu vực..."
                      aria-label="Tìm kỹ thuật viên"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto p-2" role="group" aria-label="Kỹ thuật viên phân công">
                    {filteredTechnicians.map((technician) => {
                      const selected = selectedTechnicianIds.includes(technician.id);
                      return (
                        <label
                          key={technician.id}
                          className={`flex cursor-pointer items-start gap-3 rounded-md px-2.5 py-2 text-sm hover:bg-zinc-50 ${selected ? "bg-blue-50" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => {
                              setSelectedTechnicianIds((current) => (
                                current.includes(technician.id)
                                  ? current.filter((id) => id !== technician.id)
                                  : [...current, technician.id]
                              ));
                            }}
                            className="mt-0.5 h-4 w-4 shrink-0"
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-zinc-900">{technician.full_name}</span>
                            <span className="mt-0.5 block truncate text-xs text-zinc-500">
                              {TECHNICIAN_STATUS_LABELS[technician.status]} · {technician.jobs_today} việc · {technician.service_area ?? "Chưa gán khu vực"}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                    {filteredTechnicians.length === 0 ? (
                      <p className="px-3 py-4 text-center text-sm text-zinc-500">Không tìm thấy kỹ thuật viên.</p>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between border-t border-zinc-200 px-3 py-2">
                    <span className="text-xs font-medium text-zinc-500">Đã chọn {selectedTechnicianIds.length}</span>
                    <button
                      type="button"
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                      onClick={() => setTechnicianDropdownOpen(false)}
                    >
                      Xong
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <textarea name="description" className="input min-h-24" placeholder="Mô tả sự cố/yêu cầu" required />
          <div className="grid gap-1">
            <label className="text-xs font-bold uppercase text-zinc-500" htmlFor="requestDocuments">Tài liệu đính kèm</label>
            <input
              id="requestDocuments"
              name="requestDocuments"
              type="file"
              multiple
              className="input"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
            />
          </div>
          <input name="internalNote" className="input" placeholder="Ghi chú nội bộ" />
          <div className="flex justify-end gap-2">
            <button className="btn-secondary h-10" onClick={onClose} type="button">Hủy</button>
            <PendingButton className="btn-primary h-10" type="submit" pending={isSubmitting} pendingLabel="Đang tạo...">Tạo phiếu</PendingButton>
          </div>
        </fieldset>
      </ValidatedForm>
    </Modal>
  );
}
