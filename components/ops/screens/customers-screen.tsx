"use client";

import { useState } from "react";
import { Download, Edit, Eye, Trash2, Plus, Search, MapPin, Filter } from "lucide-react";
import { EmptyState, TablePagination, TableShell, clampTablePage, getPageItems } from "@/components/ops/ui";
import type { Customer } from "@/components/ops/types";
import { displayCustomerContacts } from "@/components/ops/app-utils";
import { exportTableToExcel } from "@/components/ops/export-excel";

export function CustomersScreen({
  customers,
  onView,
  onEdit,
  onDelete,
  onTriggerCreate,
}: {
  customers: Customer[];
  isCreating: boolean;
  onCreate: (event: React.FormEvent<HTMLFormElement>) => void;
  onView: (item: Customer) => void;
  onEdit: (item: Customer) => void;
  onDelete: (item: Customer) => void;
  onTriggerCreate: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const filteredCustomers = customers.filter((customer) => {
    return (
      !searchQuery ||
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.phone.includes(searchQuery) ||
      customer.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (customer.address_note && customer.address_note.toLowerCase().includes(searchQuery.toLowerCase())) ||
      displayCustomerContacts(customer).some((contact) => (
        contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.phone.includes(searchQuery)
      ))
    );
  });
  const safePage = clampTablePage(page, filteredCustomers.length);
  const visibleCustomers = getPageItems(filteredCustomers, safePage);

  function exportCustomers() {
    exportTableToExcel({
      title: "Danh sách khách hàng",
      subtitle: `Số dòng: ${filteredCustomers.length}`,
      filename: "danh-sach-khach-hang",
      rows: filteredCustomers,
      emptyText: "Không tìm thấy khách hàng phù hợp.",
      columns: [
        { header: "STT", value: (_customer, index) => index + 1, align: "center" },
        { header: "Tên khách hàng", value: (customer) => customer.name },
        { header: "Số điện thoại chính", value: (customer) => customer.phone },
        { header: "Người liên hệ", value: (customer) => displayCustomerContacts(customer).map((contact) => `${contact.name} - ${contact.phone}${contact.note ? ` (${contact.note})` : ""}`).join("\n") },
        { header: "Địa chỉ", value: (customer) => customer.address },
        { header: "Ghi chú địa chỉ", value: (customer) => customer.address_note ?? "" },
        { header: "Tọa độ", value: (customer) => customer.lat && customer.lng ? `${customer.lat}, ${customer.lng}` : "" },
      ],
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Screen Title & Action Header */}
      <div className="screen-header">
        <div>
          <h2>Khách hàng</h2>
          <p>Quản lý danh sách, liên hệ và địa điểm lắp đặt</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={exportCustomers} className="btn-secondary" type="button">
            <Download size={16} />
            Xuất Excel
          </button>
          <button onClick={onTriggerCreate} className="btn-primary" type="button">
            <Plus size={16} />
            Thêm khách hàng
          </button>
        </div>
      </div>

      {/* Customers Table Shell with Compact Filter Header */}
      <TableShell>
        <div className="table-toolbar">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-500">
              Tổng số: {filteredCustomers.length} khách hàng
            </span>
          </div>
          <div className="table-filter-row">
            <div className="table-search">
              <Search size={13} className="search-field-icon" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="input search-field-input h-9 !w-full py-1 text-xs"
                placeholder="Tìm theo tên, SĐT, địa chỉ..."
              />
            </div>
            <button className="btn-secondary h-9 text-xs px-2.5 flex items-center gap-1.5" type="button">
              <Filter size={13} />
              Lọc
            </button>
          </div>
        </div>

        {filteredCustomers.length === 0 ? (
          <EmptyState>Không tìm thấy khách hàng phù hợp.</EmptyState>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-[250px]">Khách hàng</th>
                <th>Số điện thoại</th>
                <th>Người liên hệ</th>
                <th>Địa chỉ</th>
                <th>Ghi chú địa chỉ</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleCustomers.map((customer) => {
                const initials = customer.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .substring(0, 2)
                  .toUpperCase();

                return (
                  <tr key={customer.id}>
                    <td data-label="Khách hàng">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-zinc-100 text-zinc-800 flex items-center justify-center font-bold text-xs border border-zinc-200 shrink-0">
                          {initials}
                        </div>
                        <div>
                          <p className="font-semibold text-zinc-900 leading-tight">{customer.name}</p>
                          <p className="text-[11px] text-zinc-400 mt-1">ID: #{customer.id.substring(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td data-label="Số điện thoại" className="font-medium text-zinc-700">{customer.phone}</td>
                    <td data-label="Liên hệ">
                      <div className="grid gap-1 text-xs text-zinc-600">
                        {displayCustomerContacts(customer).slice(0, 2).map((contact) => (
                          <p key={contact.id} className="font-medium">
                            {contact.name} · {contact.phone}
                          </p>
                        ))}
                        {displayCustomerContacts(customer).length > 2 ? (
                          <p className="text-zinc-400">+{displayCustomerContacts(customer).length - 2} liên hệ khác</p>
                        ) : null}
                      </div>
                    </td>
                    <td data-label="Địa chỉ">
                      <div className="flex items-center gap-1.5 text-zinc-600 text-sm">
                        <MapPin size={13} className="text-zinc-400 shrink-0" />
                        <span className="truncate max-w-xs">{customer.address}</span>
                      </div>
                    </td>
                    <td data-label="Ghi chú" className="text-zinc-500 text-xs italic">
                      {customer.address_note ?? "Chưa có ghi chú"}
                    </td>
                    <td data-label="">
                      <div className="action-cell">
                        <button
                          className="icon-button"
                          onClick={() => onView(customer)}
                          type="button"
                          aria-label="Xem chi tiết"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          className="icon-button"
                          onClick={() => onEdit(customer)}
                          type="button"
                          aria-label="Sửa"
                        >
                          <Edit size={15} />
                        </button>
                        <button
                          className="icon-button hover:text-red-600 hover:border-red-200"
                          onClick={() => onDelete(customer)}
                          type="button"
                          aria-label="Xóa"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <TablePagination page={safePage} total={filteredCustomers.length} onPageChange={setPage} />
      </TableShell>
    </div>
  );
}
