"use client";

import { useState } from "react";
import { Download, Edit, History, KeyRound, Trash2, Plus, Search, UserCheck, Filter } from "lucide-react";
import { ROLE_LABELS } from "@/lib/types";
import { EmptyState, TablePagination, TableShell, clampTablePage, getPageItems } from "@/components/ops/ui";
import type { AppUser } from "@/components/ops/types";
import { exportTableToExcel } from "@/components/ops/export-excel";

export function UsersScreen({
  users,
  onEdit,
  onDelete,
  onViewAssignmentHistory,
  onResetPassword,
  onTriggerCreate,
}: {
  users: AppUser[];
  isCreating: boolean;
  onCreate: (event: React.FormEvent<HTMLFormElement>) => void;
  onEdit: (item: AppUser) => void;
  onDelete: (item: AppUser) => void;
  onViewAssignmentHistory: (item: AppUser) => void;
  onResetPassword: (item: AppUser) => void;
  onTriggerCreate: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      !searchQuery ||
      user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.email && user.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (user.phone && user.phone.includes(searchQuery));
    const matchesRole = !roleFilter || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });
  const safePage = clampTablePage(page, filteredUsers.length);
  const visibleUsers = getPageItems(filteredUsers, safePage);

  function exportUsers() {
    exportTableToExcel({
      title: "Danh sách nhân viên",
      subtitle: `Số dòng: ${filteredUsers.length}`,
      filename: "danh-sach-nhan-vien",
      rows: filteredUsers,
      emptyText: "Không tìm thấy nhân viên phù hợp.",
      columns: [
        { header: "STT", value: (_user, index) => index + 1, align: "center" },
        { header: "Họ và tên", value: (user) => user.full_name },
        { header: "Số điện thoại", value: (user) => user.phone ?? "" },
        { header: "Email", value: (user) => user.email ?? "" },
        { header: "Vai trò", value: (user) => ROLE_LABELS[user.role] },
        { header: "Khu vực phụ trách", value: (user) => user.service_area ?? "" },
        { header: "Trạng thái", value: (user) => user.status === "active" ? "Hoạt động" : "Ngưng hoạt động" },
      ],
    });
  }

  return (
    <div className="flex flex-col gap-6 min-w-0">
      {/* Screen Title & Action Header */}
      <div className="screen-header">
        <div>
          <h2>Nhân viên</h2>
          <p>Quản lý tài khoản nội bộ và phân quyền hệ thống</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={exportUsers} className="btn-secondary" type="button">
            <Download size={16} />
            Xuất Excel
          </button>
          <button onClick={onTriggerCreate} className="btn-primary" type="button">
            <Plus size={16} />
            Thêm nhân viên
          </button>
        </div>
      </div>

      {/* Users Table Shell with Compact Filter Header */}
      <TableShell>
        <div className="table-toolbar">
          <div className="table-filter-row">
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="input h-9 bg-white py-1 text-xs"
            >
              <option value="">Tất cả vai trò</option>
              {Object.entries(ROLE_LABELS).map(([role, label]) => (
                <option key={role} value={role}>
                  {label}
                </option>
              ))}
            </select>
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
                placeholder="Tìm theo tên, email, SĐT..."
              />
            </div>
            <button className="btn-secondary h-9 text-xs px-2.5 flex items-center gap-1.5" type="button">
              <Filter size={13} />
              Lọc
            </button>
          </div>
        </div>

        {filteredUsers.length === 0 ? (
          <EmptyState>Không tìm thấy nhân viên phù hợp.</EmptyState>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-[300px]">Nhân viên</th>
                <th>Thông tin liên hệ</th>
                <th>Vai trò</th>
                <th>Khu vực phụ trách</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((item) => {
                const initials = item.full_name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .substring(0, 2)
                  .toUpperCase();

                return (
                  <tr key={item.id}>
                    <td data-label="Nhân viên">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-zinc-100 text-zinc-800 flex items-center justify-center font-bold text-xs border border-zinc-200 shrink-0">
                          {initials}
                        </div>
                        <div>
                          <p className="font-semibold text-zinc-900 leading-tight">{item.full_name}</p>
                          <p className="text-xs text-zinc-400 mt-1">#{item.id.substring(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td data-label="Liên hệ">
                      <p className="text-sm font-medium text-zinc-700">{item.phone ?? "Chưa có SĐT"}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">{item.email ?? "Chưa có email"}</p>
                    </td>
                    <td data-label="Vai trò">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-zinc-100 text-zinc-800">
                        <UserCheck size={11} />
                        {ROLE_LABELS[item.role]}
                      </span>
                    </td>
                    <td data-label="Khu vực" className="text-zinc-600 text-sm">
                      {item.service_area ?? (item.role === "technician" || item.role === "team_lead" ? "Chưa phân khu" : "Không áp dụng")}
                    </td>
                    <td data-label="Trạng thái">
                      {item.status === "active" ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                          Hoạt động
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                          Ngưng hoạt động
                        </span>
                      )}
                    </td>
                    <td data-label="">
                      <div className="action-cell">
                        <button
                          className="icon-button"
                          onClick={() => onEdit(item)}
                          type="button"
                          aria-label="Sửa"
                        >
                          <Edit size={15} />
                        </button>
                        {item.technician_id ? (
                          <button
                            className="icon-button"
                            onClick={() => onViewAssignmentHistory(item)}
                            type="button"
                            aria-label="Xem lịch sử phân công"
                          >
                            <History size={15} />
                          </button>
                        ) : null}
                        <button
                          className="icon-button"
                          onClick={() => onResetPassword(item)}
                          type="button"
                          aria-label="Đặt lại mật khẩu"
                        >
                          <KeyRound size={15} />
                        </button>
                        {item.status === "active" ? (
                          <button
                            className="icon-button hover:text-red-600 hover:border-red-200"
                            onClick={() => onDelete(item)}
                            type="button"
                            aria-label="Ngưng hoạt động"
                          >
                            <Trash2 size={15} />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <TablePagination page={safePage} total={filteredUsers.length} onPageChange={setPage} />
      </TableShell>
    </div>
  );
}
