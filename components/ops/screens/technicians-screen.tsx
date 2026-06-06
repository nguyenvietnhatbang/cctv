"use client";

import { useState } from "react";
import { Edit, Search, Trash2 } from "lucide-react";
import { TECHNICIAN_STATUS_LABELS } from "@/lib/types";
import { EmptyState, TablePagination, TableShell, Toolbar, clampTablePage, getPageItems } from "@/components/ops/ui";
import type { Technician } from "@/components/ops/types";

export function TechniciansScreen({
  technicians,
  onEdit,
  onDelete,
}: {
  technicians: Technician[];
  onEdit: (item: Technician) => void;
  onDelete: (item: Technician) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const filteredTechnicians = technicians.filter((technician) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      [technician.full_name, technician.phone ?? "", technician.email ?? "", technician.service_area ?? ""]
        .some((value) => value.toLowerCase().includes(q));
    const matchesStatus = !statusFilter || technician.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
  const safePage = clampTablePage(page, filteredTechnicians.length);
  const visibleTechnicians = getPageItems(filteredTechnicians, safePage);

  return (
    <>
      <Toolbar title="Kỹ thuật viên" subtitle="Quản lý trạng thái, khu vực và hồ sơ kỹ thuật" />
      <TableShell>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 bg-zinc-50/20 p-4">
          <span className="text-xs font-semibold text-zinc-500">Tổng số: {filteredTechnicians.length} kỹ thuật viên</span>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
              className="input h-9 !w-40 shrink-0 bg-white py-1 text-xs"
            >
              <option value="">Tất cả trạng thái</option>
              {Object.entries(TECHNICIAN_STATUS_LABELS).map(([status, label]) => (
                <option key={status} value={status}>{label}</option>
              ))}
            </select>
            <div className="relative flex items-center !w-64 shrink-0">
              <Search size={13} className="search-field-icon" />
              <input
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setPage(1);
                }}
                className="input search-field-input h-9 !w-full py-1 text-xs"
                placeholder="Tìm tên, liên hệ, khu vực..."
              />
            </div>
          </div>
        </div>
        {filteredTechnicians.length === 0 ? <EmptyState>Không có kỹ thuật viên phù hợp.</EmptyState> : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Kỹ thuật viên</th>
                <th>Liên hệ</th>
                <th>Khu vực</th>
                <th>Trạng thái</th>
                <th>Việc hôm nay</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleTechnicians.map((technician) => (
                <tr key={technician.id}>
                  <td className="font-semibold">{technician.full_name}</td>
                  <td>{technician.phone ?? technician.email ?? ""}</td>
                  <td>{technician.service_area ?? ""}</td>
                  <td>{TECHNICIAN_STATUS_LABELS[technician.status]}</td>
                  <td>{technician.jobs_today}</td>
                  <td>
                    <div className="action-cell">
                      <button className="icon-button" onClick={() => onEdit(technician)} type="button" aria-label="Sửa">
                        <Edit size={16} />
                      </button>
                      <button className="icon-button" onClick={() => onDelete(technician)} type="button" aria-label="Xóa">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <TablePagination page={safePage} total={filteredTechnicians.length} onPageChange={setPage} />
      </TableShell>
    </>
  );
}
