"use client";

import { useState } from "react";
import { Download, Edit, Search, Trash2 } from "lucide-react";
import { TECHNICIAN_STATUS_LABELS } from "@/lib/types";
import { EmptyState, TablePagination, TableShell, Toolbar, clampTablePage, getPageItems } from "@/components/ops/ui";
import type { Technician } from "@/components/ops/types";
import { exportTableToExcel } from "@/components/ops/export-excel";

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

  function exportTechnicians() {
    exportTableToExcel({
      title: "Danh sách kỹ thuật viên",
      subtitle: `Số dòng: ${filteredTechnicians.length}`,
      filename: "danh-sach-ky-thuat-vien",
      rows: filteredTechnicians,
      emptyText: "Không có kỹ thuật viên phù hợp.",
      columns: [
        { header: "STT", value: (_technician, index) => index + 1, align: "center" },
        { header: "Kỹ thuật viên", value: (technician) => technician.full_name },
        { header: "Số điện thoại", value: (technician) => technician.phone ?? "" },
        { header: "Email", value: (technician) => technician.email ?? "" },
        { header: "Khu vực phụ trách", value: (technician) => technician.service_area ?? "" },
        { header: "Trạng thái", value: (technician) => TECHNICIAN_STATUS_LABELS[technician.status] },
        { header: "Việc hôm nay", value: (technician) => technician.jobs_today, align: "right" },
      ],
    });
  }

  return (
    <>
      <Toolbar title="Kỹ thuật viên" subtitle="Quản lý trạng thái, khu vực và hồ sơ kỹ thuật">
        <div className="mt-4 flex justify-end">
          <button className="btn-secondary" onClick={exportTechnicians} type="button">
            <Download size={16} />
            Xuất Excel
          </button>
        </div>
      </Toolbar>
      <TableShell>
        <div className="table-toolbar">
          <span className="text-xs font-semibold text-zinc-500">Tổng số: {filteredTechnicians.length} kỹ thuật viên</span>
          <div className="table-filter-row">
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
              className="input h-9 bg-white py-1 text-xs"
            >
              <option value="">Tất cả trạng thái</option>
              {Object.entries(TECHNICIAN_STATUS_LABELS).map(([status, label]) => (
                <option key={status} value={status}>{label}</option>
              ))}
            </select>
            <div className="table-search">
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
                  <td data-label="Kỹ thuật viên" className="font-semibold">{technician.full_name}</td>
                  <td data-label="Liên hệ">{technician.phone ?? technician.email ?? ""}</td>
                  <td data-label="Khu vực">{technician.service_area ?? ""}</td>
                  <td data-label="Trạng thái">{TECHNICIAN_STATUS_LABELS[technician.status]}</td>
                  <td data-label="Việc hôm nay">{technician.jobs_today}</td>
                  <td data-label="">
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
