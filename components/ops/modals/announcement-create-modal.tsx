"use client";

import { useState, useEffect, useMemo, FormEvent } from "react";
import { Send, Users, UserCheck, Search, Check, AlertCircle } from "lucide-react";
import { Modal, PendingButton, ValidatedForm } from "@/components/ops/ui";
import { apiFetch } from "@/components/ops/api";
import { ROLE_LABELS } from "@/lib/types";
import type { AppUser } from "@/components/ops/types";

export function AnnouncementCreateModal({
  users = [],
  onClose,
  onSuccess,
}: {
  users?: AppUser[];
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [targetType, setTargetType] = useState<"broadcast" | "specific">("broadcast");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [priority, setPriority] = useState<"normal" | "high" | "urgent">("normal");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fallback to fetch users directly if not passed from parent
  const [userList, setUserList] = useState<AppUser[]>(users);
  const [loadingUsers, setLoadingUsers] = useState(users.length === 0);

  useEffect(() => {
    if (users && users.length > 0) {
      setUserList(users);
      setLoadingUsers(false);
    } else {
      setLoadingUsers(true);
      apiFetch<{ users: AppUser[] }>("/api/users")
        .then((res) => {
          setUserList(res.users ?? []);
        })
        .catch((err) => {
          console.error("Không tải được danh sách người dùng", err);
        })
        .finally(() => {
          setLoadingUsers(false);
        });
    }
  }, [users]);

  // Active users only, filtered by search term
  const filteredUsers = useMemo(() => {
    const activeList = userList.filter((u) => u.status !== "inactive");
    const q = searchTerm.trim().toLowerCase();
    if (!q) return activeList;
    return activeList.filter((u) => {
      const nameMatch = u.full_name.toLowerCase().includes(q);
      const emailMatch = u.email ? u.email.toLowerCase().includes(q) : false;
      const phoneMatch = u.phone ? u.phone.includes(q) : false;
      const roleLabel = ROLE_LABELS[u.role] ?? u.role;
      const roleMatch = roleLabel.toLowerCase().includes(q);
      return nameMatch || emailMatch || phoneMatch || roleMatch;
    });
  }, [userList, searchTerm]);

  function handleToggleUser(userId: string) {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  function handleSelectAllFiltered() {
    const idsToAdd = filteredUsers.map((u) => u.id);
    setSelectedUserIds((prev) => Array.from(new Set([...prev, ...idsToAdd])));
  }

  function handleDeselectAll() {
    setSelectedUserIds([]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const title = String(formData.get("title") ?? "").trim();
    const content = String(formData.get("content") ?? "").trim();

    if (!title || !content) {
      setError("Vui lòng nhập đầy đồng thời tiêu đề và nội dung thông báo.");
      return;
    }

    if (targetType === "specific" && selectedUserIds.length === 0) {
      setError("Vui lòng chọn ít nhất một người nhận thông báo.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await apiFetch("/api/notifications", {
        method: "POST",
        body: JSON.stringify({
          type: "announcement",
          title,
          body: content,
          priority,
          broadcast: targetType === "broadcast",
          targetUserIds: targetType === "specific" ? selectedUserIds : undefined,
        }),
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tạo thông báo. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Tạo thông báo hệ thống" size="md" onClose={onClose}>
      <ValidatedForm onSubmit={handleSubmit} className="grid gap-4">
        {error ? (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/40 px-3.5 py-2.5 text-xs font-semibold text-red-800 dark:text-red-400" role="alert">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {/* Target Audience Selector - Clean & Professional */}
        <div className="grid gap-1.5">
          <label className="text-xs font-bold uppercase text-zinc-600 dark:text-zinc-400">
            Đối tượng nhận thông báo
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTargetType("broadcast")}
              className={`flex items-center justify-center gap-2 h-10 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                targetType === "broadcast"
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900 shadow-sm"
                  : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-750"
              }`}
            >
              <Users size={15} />
              <span>Toàn bộ nhân sự</span>
            </button>

            <button
              type="button"
              onClick={() => setTargetType("specific")}
              className={`flex items-center justify-center gap-2 h-10 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                targetType === "specific"
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900 shadow-sm"
                  : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-750"
              }`}
            >
              <UserCheck size={15} />
              <span>Người nhận cụ thể</span>
            </button>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            {targetType === "broadcast"
              ? "Thông báo sẽ gửi đến toàn bộ nhân sự đang hoạt động và hiển thị popup 1 lần khi đăng nhập."
              : "Chọn một hoặc nhiều người nhận cụ thể từ danh sách bên dưới."}
          </p>
        </div>

        {/* Multi-Select User Picker */}
        {targetType === "specific" ? (
          <div className="grid gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/60 dark:bg-zinc-850/50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                Đã chọn: <strong className="text-blue-600 dark:text-blue-400 font-bold">{selectedUserIds.length}</strong> người
              </span>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
                >
                  Chọn tất cả ({filteredUsers.length})
                </button>
                <span className="text-zinc-400">·</span>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:underline cursor-pointer"
                >
                  Bỏ chọn
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm nhân sự theo tên, email, vai trò..."
                className="input h-9 w-full pl-9 text-xs"
              />
            </div>

            {/* User Checkbox List */}
            <div className="max-h-48 overflow-y-auto divide-y divide-zinc-200/80 dark:divide-zinc-700/80 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
              {loadingUsers ? (
                <div className="p-4 text-center text-xs text-zinc-500">Đang tải danh sách nhân sự...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-500">Không tìm thấy nhân sự phù hợp.</div>
              ) : (
                filteredUsers.map((u) => {
                  const isChecked = selectedUserIds.includes(u.id);
                  return (
                    <label
                      key={u.id}
                      className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors ${
                        isChecked
                          ? "bg-blue-50/70 dark:bg-blue-950/40"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleUser(u.id)}
                        className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600 text-blue-600 focus:ring-0 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                            {u.full_name}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium shrink-0">
                            {ROLE_LABELS[u.role] ?? u.role}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                          {u.email || u.phone || "Không có email"}
                        </p>
                      </div>
                      {isChecked ? <Check size={14} className="text-blue-600 dark:text-blue-400 shrink-0" /> : null}
                    </label>
                  );
                })
              )}
            </div>
          </div>
        ) : null}

        {/* Priority */}
        <label className="grid gap-1">
          <span className="text-xs font-bold uppercase text-zinc-600 dark:text-zinc-400">Mức độ ưu tiên</span>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as "normal" | "high" | "urgent")}
            className="input h-10"
            disabled={submitting}
          >
            <option value="normal">Thông thường</option>
            <option value="high">Quan trọng (Ưu tiên cao)</option>
            <option value="urgent">Khẩn cấp (Bật chú ý)</option>
          </select>
        </label>

        {/* Title */}
        <label className="grid gap-1">
          <span className="text-xs font-bold uppercase text-zinc-600 dark:text-zinc-400">Tiêu đề thông báo</span>
          <input
            name="title"
            className="input h-10"
            placeholder="VD: Cập nhật quy trình bàn giao, lịch bảo trì hệ thống..."
            required
            disabled={submitting}
          />
        </label>

        {/* Content */}
        <label className="grid gap-1">
          <span className="text-xs font-bold uppercase text-zinc-600 dark:text-zinc-400">Nội dung thông báo</span>
          <textarea
            name="content"
            className="input min-h-32"
            placeholder="Nhập nội dung thông báo đầy đủ..."
            required
            disabled={submitting}
          />
        </label>

        {/* Buttons */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="btn-secondary h-10 px-4 text-xs cursor-pointer"
            type="button"
            disabled={submitting}
          >
            Hủy
          </button>
          <PendingButton
            className="btn-primary h-10 px-5 text-xs inline-flex items-center gap-1.5 cursor-pointer"
            type="submit"
            pending={submitting}
            pendingLabel="Đang gửi..."
          >
            <Send size={14} />
            Phát thông báo
          </PendingButton>
        </div>
      </ValidatedForm>
    </Modal>
  );
}
