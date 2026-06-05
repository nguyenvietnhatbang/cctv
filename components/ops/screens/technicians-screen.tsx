"use client";

import { Edit, Trash2 } from "lucide-react";
import { TECHNICIAN_STATUS_LABELS } from "@/lib/types";
import { EmptyState, TableShell, Toolbar } from "@/components/ops/ui";
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
  return (
    <>
      <Toolbar title="Kỹ thuật viên" subtitle="Quản lý trạng thái, khu vực và hồ sơ kỹ thuật" />
      <TableShell>
        {technicians.length === 0 ? <EmptyState>Chưa có kỹ thuật viên.</EmptyState> : (
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
              {technicians.map((technician) => (
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
      </TableShell>
    </>
  );
}
