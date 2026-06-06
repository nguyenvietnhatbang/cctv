"use client";

import { useState } from "react";
import { Edit, Eye, Trash2, Plus, Search, MapPin, Filter } from "lucide-react";
import { EmptyState, TableShell } from "@/components/ops/ui";
import type { Customer } from "@/components/ops/types";

export function CustomersScreen({
  customers,
  isCreating,
  onCreate,
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

  const filteredCustomers = customers.filter((customer) => {
    return (
      !searchQuery ||
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.phone.includes(searchQuery) ||
      customer.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (customer.address_note && customer.address_note.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Screen Title & Action Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-zinc-900 tracking-tight">Khách hàng</h2>
          <p className="text-xs text-zinc-500 mt-1">Quản lý danh sách, liên hệ và địa điểm lắp đặt</p>
        </div>
        <button onClick={onTriggerCreate} className="btn-primary" type="button">
          <Plus size={16} />
          Thêm khách hàng
        </button>
      </div>

      {/* Customers Table Shell with Compact Filter Header */}
      <TableShell>
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b border-zinc-100 bg-zinc-50/20">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-500">
              Tổng số: {filteredCustomers.length} khách hàng
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex items-center !w-64 shrink-0">
              <Search size={13} className="absolute left-2.5 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-8 h-9 py-1 text-xs !w-full"
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
                <th>Địa chỉ</th>
                <th>Ghi chú địa chỉ</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => {
                const initials = customer.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .substring(0, 2)
                  .toUpperCase();

                return (
                  <tr key={customer.id}>
                    <td>
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
                    <td className="font-medium text-zinc-700">{customer.phone}</td>
                    <td>
                      <div className="flex items-center gap-1.5 text-zinc-600 text-sm">
                        <MapPin size={13} className="text-zinc-400 shrink-0" />
                        <span className="truncate max-w-xs">{customer.address}</span>
                      </div>
                    </td>
                    <td className="text-zinc-500 text-xs italic">
                      {customer.address_note ?? "Chưa có ghi chú"}
                    </td>
                    <td>
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
      </TableShell>
    </div>
  );
}
