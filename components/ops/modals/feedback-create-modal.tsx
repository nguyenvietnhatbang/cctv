"use client";

import { useState, FormEvent } from "react";
import { MessageSquarePlus, Send, X } from "lucide-react";
import { Modal, PendingButton, ValidatedForm } from "@/components/ops/ui";
import { apiFetch } from "@/components/ops/api";

export function FeedbackCreateModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [category, setCategory] = useState("bug");
  const [priority, setPriority] = useState<"normal" | "urgent">("normal");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryLabels: Record<string, string> = {
    bug: "Báo lỗi phần mềm",
    feature: "Đề xuất tính năng mới",
    ui: "Góp ý giao diện / hiển thị",
    other: "Hỗ trợ kỹ thuật khác",
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const title = String(formData.get("title") ?? "").trim();
    const content = String(formData.get("content") ?? "").trim();

    if (!title || !content) {
      setError("Vui lòng nhập đầy đủ tiêu đề và nội dung.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const fullTitle = `[${categoryLabels[category] ?? "Góp ý"}] ${title}`;
      await apiFetch("/api/notifications", {
        method: "POST",
        body: JSON.stringify({
          type: "feedback",
          title: fullTitle,
          body: content,
          priority: priority === "urgent" ? "urgent" : "normal",
        }),
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gửi được phản hồi. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Gửi phản hồi / Yêu cầu cho Dev" size="md" onClose={onClose}>
      <ValidatedForm onSubmit={handleSubmit} className="grid gap-4">
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-900">
          <strong>Kênh phản hồi trực tiếp tới lập trình viên (Dev)</strong>: Ý kiến đóng góp, báo lỗi hoặc đề xuất tính năng sẽ được gửi riêng cho tài khoản Dev để xử lý và cải thiện hệ thống.
        </div>

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800" role="alert">
            {error}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-xs font-bold uppercase text-zinc-500">Phân loại yêu cầu</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input h-10"
              disabled={submitting}
            >
              <option value="bug">Báo lỗi phần mềm (Bug)</option>
              <option value="feature">Đề xuất tính năng mới</option>
              <option value="ui">Góp ý giao diện / hiển thị</option>
              <option value="other">Hỗ trợ kỹ thuật khác</option>
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-bold uppercase text-zinc-500">Mức độ ưu tiên</span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as "normal" | "urgent")}
              className="input h-10"
              disabled={submitting}
            >
              <option value="normal">Bình thường</option>
              <option value="urgent">Khẩn cấp / Ảnh hưởng công việc</option>
            </select>
          </label>
        </div>

        <label className="grid gap-1">
          <span className="text-xs font-bold uppercase text-zinc-500">Tiêu đề vắn tắt</span>
          <input
            name="title"
            className="input h-10"
            placeholder="VD: Nút check-in bị chậm khi mạng yếu, cần thêm cột ghi chú..."
            required
            disabled={submitting}
          />
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-bold uppercase text-zinc-500">Nội dung chi tiết</span>
          <textarea
            name="content"
            className="input min-h-32"
            placeholder="Mô tả cụ thể vấn đề hoặc ý kiến đề xuất của bạn..."
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
            Gửi tới Dev
          </PendingButton>
        </div>
      </ValidatedForm>
    </Modal>
  );
}
