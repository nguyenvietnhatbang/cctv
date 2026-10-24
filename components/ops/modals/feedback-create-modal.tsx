"use client";

import { useState, FormEvent } from "react";
import { MessageSquarePlus, Send, AlertCircle } from "lucide-react";
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
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-850 p-3 text-xs leading-5 text-zinc-700 dark:text-zinc-300">
          <strong className="text-zinc-900 dark:text-white font-semibold">Kênh phản hồi trực tiếp tới lập trình viên (Dev)</strong>: Ý kiến đóng góp, báo lỗi hoặc đề xuất tính năng sẽ được gửi riêng cho tài khoản Dev để xử lý và cải thiện hệ thống.
        </div>

        {error ? (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/40 px-3.5 py-2.5 text-xs font-semibold text-red-800 dark:text-red-400" role="alert">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-xs font-bold uppercase text-zinc-600 dark:text-zinc-400">Phân loại yêu cầu</span>
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
            <span className="text-xs font-bold uppercase text-zinc-600 dark:text-zinc-400">Mức độ ưu tiên</span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as "normal" | "urgent")}
              className="input h-10"
              disabled={submitting}
            >
              <option value="normal">Bình thường</option>
              <option value="urgent">Gấp / Khẩn cấp</option>
            </select>
          </label>
        </div>

        <label className="grid gap-1">
          <span className="text-xs font-bold uppercase text-zinc-600 dark:text-zinc-400">Tiêu đề phản hồi</span>
          <input
            name="title"
            className="input h-10"
            placeholder="Tóm tắt ngắn gọn vấn đề hoặc đề xuất..."
            required
            disabled={submitting}
          />
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-bold uppercase text-zinc-600 dark:text-zinc-400">Mô tả chi tiết</span>
          <textarea
            name="content"
            className="input min-h-32"
            placeholder="Mô tả cụ thể: Các bước gặp lỗi, mong muốn xử lý ra sao..."
            required
            disabled={submitting}
          />
        </label>

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
            Gửi phản hồi
          </PendingButton>
        </div>
      </ValidatedForm>
    </Modal>
  );
}
