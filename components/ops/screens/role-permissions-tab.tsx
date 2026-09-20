"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Info, RefreshCw, Save, ShieldAlert, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/components/ops/api";
import { ROLE_LABELS, type Role } from "@/lib/types";

type PermissionItem = {
  id: string;
  code: string;
  name: string;
  module: string;
  description: string | null;
  sort_order: number;
};

type RolePermissionMatrix = Record<Role, string[]>;

type PermissionsResponse = {
  permissions: PermissionItem[];
  matrix: RolePermissionMatrix;
};

const ROLES_ORDER: Role[] = ["admin", "dispatcher", "team_lead", "technician", "accountant"];

export function RolePermissionsTab() {
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [matrix, setMatrix] = useState<RolePermissionMatrix>({
    admin: [],
    dispatcher: [],
    team_lead: [],
    technician: [],
    accountant: [],
  });
  const [initialMatrix, setInitialMatrix] = useState<RolePermissionMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function loadData() {
    setLoading(true);
    setMessage(null);
    try {
      const data = await apiFetch<PermissionsResponse>("/api/permissions");
      setPermissions(data.permissions);
      setMatrix(data.matrix);
      setInitialMatrix(data.matrix);
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Không thể tải danh sách phân quyền",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const groupedPermissions = useMemo(() => {
    const map = new Map<string, PermissionItem[]>();
    for (const p of permissions) {
      const list = map.get(p.module) ?? [];
      list.push(p);
      map.set(p.module, list);
    }
    return Array.from(map.entries()).map(([moduleName, items]) => ({
      moduleName,
      items,
    }));
  }, [permissions]);

  const hasChanges = useMemo(() => {
    if (!initialMatrix) return false;
    for (const role of ROLES_ORDER) {
      if (role === "admin") continue;
      const currentSet = new Set(matrix[role] ?? []);
      const initSet = new Set(initialMatrix[role] ?? []);
      if (currentSet.size !== initSet.size) return true;
      for (const item of currentSet) {
        if (!initSet.has(item)) return true;
      }
    }
    return false;
  }, [initialMatrix, matrix]);

  function togglePermission(role: Role, permCode: string) {
    if (role === "admin") return; // Admin luôn có full quyền

    setMatrix((prev) => {
      const currentList = prev[role] ?? [];
      const hasPerm = currentList.includes(permCode);
      const nextList = hasPerm
        ? currentList.filter((c) => c !== permCode)
        : [...currentList, permCode];

      return {
        ...prev,
        [role]: nextList,
      };
    });
    setMessage(null);
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await apiFetch<{ message: string; matrix: RolePermissionMatrix }>("/api/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matrix }),
      });
      setMatrix(res.matrix);
      setInitialMatrix(res.matrix);
      setMessage({ type: "success", text: "Đã lưu ma trận phân quyền thành công! Thay đổi sẽ có hiệu lực ngay." });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Có lỗi khi lưu cấu hình phân quyền",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="panel flex min-h-[300px] flex-col items-center justify-center gap-3 text-zinc-500">
        <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
        <p className="text-sm font-medium">Đang tải ma trận phân quyền hệ thống...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header hướng dẫn */}
      <div className="panel border-blue-100 bg-blue-50/50 p-4">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold">Cấu hình phân quyền động theo vị trí</p>
            <p className="mt-1 text-blue-800">
              Admin có thể bật/tắt quyền hạn chi tiết cho từng vị trí làm việc.
              Đặc biệt chú ý: <strong>Trưởng nhóm (Team Lead)</strong> mang tính chất kỹ thuật viên hiện trường kết hợp giám sát đội nhóm.
              Các quyền xuất dữ liệu (Export Excel) nên được giới hạn chặt chẽ để bảo vệ thông tin khách hàng và tài nguyên công ty.
            </p>
          </div>
        </div>
      </div>

      {/* Thông báo kết quả lưu */}
      {message && (
        <div
          className={`panel p-4 text-sm font-medium flex items-center gap-2.5 ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          {message.type === "success" ? <ShieldCheck className="h-5 w-5 text-emerald-600" /> : <ShieldAlert className="h-5 w-5 text-red-600" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Thanh hành động lưu */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-zinc-900">Bảng ma trận chức năng</h3>
          <p className="text-xs text-zinc-500 mt-0.5">Tích chọn để cấp quyền cho vai trò tương ứng</p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <button
              onClick={() => {
                if (initialMatrix) setMatrix(initialMatrix);
                setMessage(null);
              }}
              className="btn-secondary h-9 text-xs"
              type="button"
              disabled={saving}
            >
              Hủy thay đổi
            </button>
          )}
          <button
            onClick={handleSave}
            className={`btn-primary h-9 text-xs flex items-center gap-1.5 ${hasChanges ? "ring-2 ring-blue-500 ring-offset-1" : ""}`}
            type="button"
            disabled={saving || !hasChanges}
          >
            {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save size={14} />}
            {saving ? "Đang lưu..." : "Lưu ma trận quyền"}
          </button>
        </div>
      </div>

      {/* Bảng ma trận */}
      <div className="panel overflow-x-auto p-0 shadow-sm border border-zinc-200">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/80 text-xs font-semibold text-zinc-700">
              <th className="py-3.5 px-4 min-w-[260px]">Chức năng / Quyền hạn</th>
              {ROLES_ORDER.map((role) => (
                <th key={role} className="py-3.5 px-3 text-center min-w-[120px]">
                  <div>{ROLE_LABELS[role]}</div>
                  {role === "team_lead" && (
                    <span className="inline-block mt-0.5 text-[10px] font-normal text-amber-700 bg-amber-50 border border-amber-200 px-1 rounded">
                      Kỹ thuật đặc thù
                    </span>
                  )}
                  {role === "admin" && (
                    <span className="inline-block mt-0.5 text-[10px] font-normal text-zinc-500">
                      Toàn quyền
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {groupedPermissions.map((group) => (
              <tr key={group.moduleName} className="contents">
                {/* Dòng tiêu đề module */}
                <tr className="bg-zinc-100/60 font-semibold text-zinc-900">
                  <td colSpan={1 + ROLES_ORDER.length} className="py-2.5 px-4 text-xs uppercase tracking-wider text-zinc-600">
                    {group.moduleName}
                  </td>
                </tr>

                {/* Các quyền trong module */}
                {group.items.map((perm) => {
                  const isExport = perm.code.endsWith(".export");
                  const isDelete = perm.code.endsWith(".delete");

                  return (
                    <tr
                      key={perm.id}
                      className={`hover:bg-zinc-50/70 transition-colors ${
                        isExport ? "bg-amber-50/20" : isDelete ? "bg-red-50/10" : ""
                      }`}
                    >
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-zinc-900 flex items-center gap-2">
                          <span>{perm.name}</span>
                          {isExport && (
                            <span className="text-[10px] bg-amber-100 text-amber-800 font-semibold px-1.5 py-0.2 rounded border border-amber-200">
                              Xuất Excel
                            </span>
                          )}
                        </div>
                        {perm.description && (
                          <div className="text-xs text-zinc-500 mt-0.5">{perm.description}</div>
                        )}
                        <div className="text-[11px] font-mono text-zinc-400 mt-0.5">{perm.code}</div>
                      </td>

                      {ROLES_ORDER.map((role) => {
                        const isChecked = role === "admin" ? true : (matrix[role] ?? []).includes(perm.code);
                        const isDisabled = role === "admin";

                        return (
                          <td key={role} className="py-2.5 px-3 text-center align-middle">
                            <label className="inline-flex items-center justify-center p-1 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                disabled={isDisabled}
                                onChange={() => togglePermission(role, perm.code)}
                                className={`h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 transition ${
                                  isDisabled ? "cursor-not-allowed opacity-75" : "cursor-pointer"
                                }`}
                              />
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Chú thích cuối trang */}
      <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-zinc-500">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-blue-600" />
            <span>Admin luôn sở hữu tất cả các quyền hệ thống</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span>Các quyền Xuất Excel được đánh dấu nổi bật để dễ kiểm soát</span>
          </div>
        </div>
        {hasChanges && (
          <p className="text-amber-600 font-medium flex items-center gap-1">
            <Check size={14} /> Bạn có thay đổi chưa lưu
          </p>
        )}
      </div>
    </div>
  );
}
