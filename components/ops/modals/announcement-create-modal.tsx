"use client";

import { useState, FormEvent } from "react";
import { Megaphone, Send, Users, User } from "lucide-react";
import { Modal, PendingButton, ValidatedForm } from "@/components/ops/ui";
import { apiFetch } from "@/components/ops/api";
import type { AppUser } from "@/components/ops/types";

export function AnnouncementCreateModal({
  users,
  onClose,
  onSuccess,
}: {
  users: AppUser[];
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [targetType, setTargetType] = useState<"broadcast" | "specific">("broadcast");
  const [targetUserId, setTargetUserId] = useState<string>("");
  const [priority, setPriority] = useState<"normal" | "high" | "urgent">("normal");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const title = String(formData.get("title") ?? "").trim();
    const content = String(formData.get("content") ?? "").trim();

    if (!title || !content) {
      setError("Vui lòng nhập đầy đủ tiêu đề và nội dung thông báo.");
      return;
    }

    if (targetType === "specific" && !targetUserId) {
      setError("Vui lòng chọn người nhận thông báo.");
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
          targetUserId: targetType === "specific" ? targetUserId : undefined,
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
        <div className="rounded-md border border-violet-200 bg-violet-50 p-3 text-xs leading-5 text-violet-900">
          <strong>Thông báo phát sóng</strong>: Thông báo này sẽ được hiển thị tới người nhận và tự động bật cửa sổ thông báo 1 lần khi người dùng vào hệ thống.
        </div>

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800" role="alert">
            {error}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-xs font-bold uppercase text-zinc-500">Đối tượng nhận</span>
            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value as "broadcast" | "specific")}
              className="input h-10"
              disabled={submitting}
            >
              <option value="broadcast">📢 Toàn bộ nhân sự (Tất cả)</option>
              <option value="specific">👤 Người dùng cụ thể</option>
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-bold uppercase text-zinc-500">Mức độ ưu tiên</span>
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
        </div>

        {targetType === "specific" ? (
          <label className="grid gap-1">
            <span className="text-xs font-bold uppercase text-zinc-500">Chọn người nhận</span>
            <select
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              className="input h-10"
              required
              disabled={submitting}
            >
              <option value="">-- Chọn nhân sự nhận thông báo --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.email} - {u.role})
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="grid gap-1">
          <span className="text-xs font-bold uppercase text-zinc-500">Tiêu đề thông báo</span>
          <input
            name="title"
            className="input h-10"
            placeholder="VD: Cập nhật quy trình bàn giao, lịch bảo trì hệ thống..."
            required
            disabled={submitting}
          />
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-bold uppercase text-zinc-500">Nội dung thông báo</span>
          <textarea
            name="content"
            className="input min-h-36"
            placeholder="Nhập nội dung thông báo đầy đủ..."
            required
            disabled={submitting}
          />
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="btn-secondary h-10 px-4 text-xs"
            type="button"
            disabled={submitting}
          >
            Hủy
          </button>
          <PendingButton
            className="btn-primary h-10 px-5 text-xs inline-flex items-center gap-1.5"
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
