"use client";

import { Edit, Eye, Trash2 } from "lucide-react";
import { EmptyState, TableShell, Toolbar } from "@/components/ops/ui";
import type { Customer } from "@/components/ops/types";

export function CustomersScreen({
  customers,
  isCreating,
  onCreate,
  onView,
  onEdit,
  onDelete,
}: {
  customers: Customer[];
  isCreating: boolean;
  onCreate: (event: React.FormEvent<HTMLFormElement>) => void;
  onView: (item: Customer) => void;
  onEdit: (item: Customer) => void;
  onDelete: (item: Customer) => void;
}) {
  return (
    <>
      <Toolbar title="Khách hàng" subtitle="Tạo mới, sửa thông tin liên hệ và địa chỉ thi công">
        <form onSubmit={onCreate} aria-busy={isCreating} className="grid gap-3 md:grid-cols-[1fr_170px_1fr_1fr_auto]">
          <fieldset disabled={isCreating} className="contents">
            <input name="name" className="input" placeholder="Tên khách" required />
            <input name="phone" className="input" placeholder="Số điện thoại" required />
            <input name="address" className="input" placeholder="Địa chỉ" required />
            <input name="addressNote" className="input" placeholder="Ghi chú địa chỉ" />
            <button className="btn-primary h-11" type="submit">{isCreating ? "Đang tạo..." : "Tạo"}</button>
          </fieldset>
        </form>
      </Toolbar>
      <TableShell>
        {customers.length === 0 ? <EmptyState>Chưa có khách hàng.</EmptyState> : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Tên khách</th>
                <th>Số điện thoại</th>
                <th>Địa chỉ</th>
                <th>Ghi chú</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td className="font-semibold">{customer.name}</td>
                  <td>{customer.phone}</td>
                  <td>{customer.address}</td>
                  <td>{customer.address_note ?? ""}</td>
                  <td>
                    <div className="action-cell">
                      <button className="icon-button" onClick={() => onView(customer)} type="button" aria-label="Xem khách hàng"><Eye size={16} /></button>
                      <button className="icon-button" onClick={() => onEdit(customer)} type="button" aria-label="Sửa"><Edit size={16} /></button>
                      <button className="icon-button" onClick={() => onDelete(customer)} type="button" aria-label="Xóa"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableShell>
    </>
  );
}
