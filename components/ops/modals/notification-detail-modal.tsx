"use client";

import { Megaphone, MessageSquare, Bell, Clock, CheckCircle2 } from "lucide-react";
import { dateTime } from "@/components/ops/format";
import { Modal } from "@/components/ops/ui";
import type { NotificationItem } from "@/components/ops/types";

export function NotificationDetailModal({
  notification,
  onClose,
  isOneTimePopup = false,
}: {
  notification: NotificationItem;
  onClose: () => void;
  isOneTimePopup?: boolean;
}) {
  const isAnnouncement = notification.type === "announcement";
  const isFeedback = notification.type === "feedback";

  const priorityBadge = {
    urgent: { label: "Khẩn cấp", className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800" },
    high: { label: "Quan trọng", className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800" },
    normal: { label: "Thông thường", className: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700" },
  }[notification.priority] ?? { label: "Thông thường", className: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-750" };

  return (
    <Modal
      title={isAnnouncement ? "Thông báo hệ thống" : isFeedback ? "Góp ý & Phản hồi" : "Chi tiết thông báo"}
      size="md"
      onClose={onClose}
    >
      <div className="grid gap-4">
        {isOneTimePopup ? (
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-850 p-3 text-xs leading-5 text-zinc-700 dark:text-zinc-300">
            <strong className="text-zinc-900 dark:text-white font-semibold">Thông báo mới từ Ban quản trị</strong>: Đây là thông báo phát sóng quan trọng tới nhân sự trong hệ thống.
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {isAnnouncement ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              <Megaphone size={12} />
              Thông báo hệ thống
            </span>
          ) : isFeedback ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
              <MessageSquare size={12} />
              Góp ý Dev
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40 px-2.5 py-0.5 text-xs font-semibold text-blue-800 dark:text-blue-300">
              <Bell size={12} />
              Công việc
            </span>
          )}

          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${priorityBadge.className}`}>
            {priorityBadge.label}
          </span>

          <span className="inline-flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
            <Clock size={12} />
            {dateTime(notification.created_at)}
          </span>
        </div>

        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-850/60 p-4">
          <h3 className="text-base font-bold text-zinc-950 dark:text-white mb-2 leading-snug">
            {notification.title}
          </h3>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {notification.body}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="btn-primary h-10 px-5 text-sm inline-flex items-center gap-1.5 cursor-pointer"
            type="button"
          >
            <CheckCircle2 size={16} />
            {isOneTimePopup ? "Đã hiểu & Đóng" : "Đóng"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
