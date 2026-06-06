"use client";

import { Edit, Trash2 } from "lucide-react";
import { ROLE_LABELS } from "@/lib/types";
import { EmptyState, TableShell, Toolbar } from "@/components/ops/ui";
import type { AppUser } from "@/components/ops/types";

export function UsersScreen({
  users,
  isCreating,
  onCreate,
  onEdit,
  onDelete,
}: {
  users: AppUser[];
  isCreating: boolean;
  onCreate: (event: React.FormEvent<HTMLFormElement>) => void;
  onEdit: (item: AppUser) => void;
  onDelete: (item: AppUser) => void;
}) {
  return (
    <>
      <Toolbar title="Nhân viên" subtitle="Quản lý tài khoản nội bộ, không dùng Supabase Auth">
        <form onSubmit={onCreate} aria-busy={isCreating} className="grid gap-3 md:grid-cols-3 xl:grid-cols-[1fr_1fr_160px_160px_160px_1fr_auto]">
          <fieldset disabled={isCreating} className="contents">
            <input name="fullName" className="input" placeholder="Họ tên" required />
            <input name="email" type="email" className="input" placeholder="Email" />
            <input name="phone" className="input" placeholder="Số điện thoại" />
            <input name="password" type="password" className="input" placeholder="Mật khẩu" required minLength={8} />
            <select name="role" className="input" defaultValue="dispatcher">
              {Object.entries(ROLE_LABELS).map(([role, label]) => <option key={role} value={role}>{label}</option>)}
            </select>
            <input name="serviceArea" className="input" placeholder="Khu vực nếu là kỹ thuật" />
            <button className="btn-primary h-11" type="submit">{isCreating ? "Đang tạo..." : "Tạo"}</button>
          </fieldset>
        </form>
      </Toolbar>
      <TableShell>
        {users.length === 0 ? <EmptyState>Chưa có nhân viên.</EmptyState> : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nhân viên</th>
                <th>Liên hệ</th>
                <th>Vai trò</th>
                <th>Trạng thái</th>
                <th>Khu vực</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((item) => (
                <tr key={item.id}>
                  <td className="font-semibold">{item.full_name}</td>
                  <td>{item.email ?? item.phone ?? "Chưa có"}</td>
                  <td>{ROLE_LABELS[item.role]}</td>
                  <td>{item.status === "active" ? "Hoạt động" : "Ngưng"}</td>
                  <td>{item.service_area ?? ""}</td>
                  <td>
                    <div className="action-cell">
                      <button className="icon-button" onClick={() => onEdit(item)} type="button" aria-label="Sửa"><Edit size={16} /></button>
                      <button className="icon-button" onClick={() => onDelete(item)} type="button" aria-label="Xóa"><Trash2 size={16} /></button>
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
