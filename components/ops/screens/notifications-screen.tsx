"use client";

import { useState } from "react";
import { Bell, Eye, Search, MailOpen, Mail, MessageSquarePlus, Megaphone, MessageSquare, ClipboardList, Info } from "lucide-react";
import { dateTime } from "@/components/ops/format";
import { PwaPushSettings } from "@/components/ops/pwa-push-settings";
import { EmptyState, TablePagination, TableShell, clampTablePage, getPageItems } from "@/components/ops/ui";
import type { NotificationItem, AppUser, Role } from "@/components/ops/types";
import type { PwaPushController } from "@/components/ops/use-pwa-push";
import { NotificationDetailModal } from "@/components/ops/modals/notification-detail-modal";
import { FeedbackCreateModal } from "@/components/ops/modals/feedback-create-modal";
import { AnnouncementCreateModal } from "@/components/ops/modals/announcement-create-modal";

function timeAgo(dateString: string) {
  try {
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Vừa xong";
    if (diffMins < 60) return `${diffMins} phút trước`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs} giờ trước`;
    const diffDays = Math.floor(diffHrs / 24);
    return `${diffDays} ngày trước`;
  } catch {
    return dateTime(dateString);
  }
}

export function NotificationsScreen({
  notifications,
  onOpen,
  pwaPush,
  userRole,
  users = [],
  onRefresh,
}: {
  notifications: NotificationItem[];
  onOpen: (id: string) => void;
  pwaPush: PwaPushController;
  userRole?: Role;
  users?: AppUser[];
  onRefresh?: () => void | Promise<unknown>;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const filteredNotifications = notifications.filter((item) => {
    return (
      !searchQuery ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.body.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });
  const safePage = clampTablePage(page, filteredNotifications.length);
  const visibleNotifications = getPageItems(filteredNotifications, safePage);

  const unreadCount = notifications.filter((item) => !item.read_at).length;

  function handleSuccess(msg: string) {
    setSuccessMessage(msg);
    if (onRefresh) onRefresh();
    setTimeout(() => setSuccessMessage(null), 4000);
  }

  return (
    <div className="flex flex-col gap-6 min-w-0">
      <div className="screen-header">
        <div>
          <h2>Thông báo</h2>
          <p>Mở trang này sẽ tự đánh dấu các thông báo hiện có của bạn là đã đọc</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-100 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/60">
            {unreadCount} chưa đọc
          </span>
          <button
            onClick={() => setShowFeedbackModal(true)}
            className="btn-primary h-9 text-xs inline-flex items-center gap-1.5 cursor-pointer"
            type="button"
          >
            <MessageSquarePlus size={14} />
            Gửi phản hồi cho Dev
          </button>
          {userRole === "admin" ? (
            <button
              onClick={() => setShowAnnouncementModal(true)}
              className="btn-secondary h-9 text-xs inline-flex items-center gap-1.5 cursor-pointer"
              type="button"
            >
              <Megaphone size={14} />
              Tạo thông báo
            </button>
          ) : null}
        </div>
      </div>

      {successMessage ? (
        <div className="rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 text-sm font-semibold text-emerald-800 dark:text-emerald-300" role="status">
          {successMessage}
        </div>
      ) : null}

      <PwaPushSettings push={pwaPush} />

      <TableShell>
        <div className="table-toolbar">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              Tổng số: {filteredNotifications.length} thông báo
            </span>
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
                placeholder="Tìm kiếm thông báo..."
              />
            </div>
          </div>
        </div>

        {filteredNotifications.length === 0 ? (
          <EmptyState>Chưa có thông báo nào.</EmptyState>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-[380px]">Nội dung</th>
                <th>Phân loại</th>
                <th>Liên kết / Chi tiết</th>
                <th>Thời gian</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleNotifications.map((item) => {
                const isUnread = !item.read_at;
                const isAnnouncement = item.type === "announcement";
                const isFeedback = item.type === "feedback";

                return (
                  <tr
                    key={item.id}
                    className={isUnread ? "bg-zinc-50/50 dark:bg-zinc-800/30 hover:bg-zinc-50/70" : "hover:bg-zinc-50/30"}
                  >
                    <td data-label="Nội dung">
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                            isAnnouncement
                              ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                              : isFeedback
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                              : isUnread
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400"
                              : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"
                          }`}
                        >
                          {isAnnouncement ? <Megaphone size={12} /> : isFeedback ? <MessageSquare size={12} /> : <Bell size={12} />}
                        </div>
                        <div>
                          <p className={`text-sm ${isUnread ? "font-semibold text-zinc-900 dark:text-zinc-100" : "text-zinc-700 dark:text-zinc-300"}`}>
                            {item.title}
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed line-clamp-2">{item.body}</p>
                        </div>
                      </div>
                    </td>
                    <td data-label="Phân loại">
                      {isAnnouncement ? (
                        <span className="inline-flex items-center gap-1 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
                          <Megaphone size={10} />
                          Hệ thống
                        </span>
                      ) : isFeedback ? (
                        <span className="inline-flex items-center gap-1 rounded border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                          <MessageSquare size={10} />
                          Góp ý Dev
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 text-[11px] font-semibold text-blue-800 dark:text-blue-300">
                          <ClipboardList size={10} />
                          Công việc
                        </span>
                      )}
                    </td>
                    <td data-label="Liên kết">
                      {item.work_order_id ? (
                        <button
                          onClick={() => onOpen(item.work_order_id!)}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                          type="button"
                        >
                          <Eye size={11} />
                          Xem công việc
                        </button>
                      ) : (
                        <button
                          onClick={() => setSelectedNotification(item)}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                          type="button"
                        >
                          <Info size={11} />
                          Xem nội dung
                        </button>
                      )}
                    </td>
                    <td data-label="Thời gian">
                      <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{timeAgo(item.created_at)}</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">{dateTime(item.created_at)}</p>
                    </td>
                    <td data-label="Trạng thái">
                      {isUnread ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          <Mail size={10} />
                          Chưa đọc
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                          <MailOpen size={10} />
                          Đã đọc
                        </span>
                      )}
                    </td>
                    <td data-label="">
                      <div className="action-cell">
                        {item.work_order_id ? (
                          <button
                            onClick={() => onOpen(item.work_order_id!)}
                            className="icon-button"
                            type="button"
                            title="Mở công việc"
                          >
                            <Eye size={15} />
                          </button>
                        ) : (
                          <button
                            onClick={() => setSelectedNotification(item)}
                            className="icon-button"
                            type="button"
                            title="Xem chi tiết thông báo"
                          >
                            <Info size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <TablePagination page={safePage} total={filteredNotifications.length} onPageChange={setPage} />
      </TableShell>

      {/* Modal xem chi tiết thông báo */}
      {selectedNotification ? (
        <NotificationDetailModal
          notification={selectedNotification}
          onClose={() => setSelectedNotification(null)}
        />
      ) : null}

      {/* Modal gửi phản hồi cho Dev */}
      {showFeedbackModal ? (
        <FeedbackCreateModal
          onClose={() => setShowFeedbackModal(false)}
          onSuccess={() => handleSuccess("Đã gửi phản hồi thành công tới lập trình viên (Dev)! Cảm ơn đóng góp của bạn.")}
        />
      ) : null}

      {/* Modal tạo thông báo hệ thống (Admin only) */}
      {showAnnouncementModal ? (
        <AnnouncementCreateModal
          users={users}
          onClose={() => setShowAnnouncementModal(false)}
          onSuccess={() => handleSuccess("Đã phát thông báo hệ thống thành công!")}
        />
      ) : null}
    </div>
  );
}
