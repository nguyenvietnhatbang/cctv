"use client";

import { useState } from "react";
import { Bell, Eye, Search, MailOpen, Mail } from "lucide-react";
import { dateTime } from "@/components/ops/format";
import { PwaPushSettings } from "@/components/ops/pwa-push-settings";
import { EmptyState, TablePagination, TableShell, clampTablePage, getPageItems } from "@/components/ops/ui";
import type { NotificationItem } from "@/components/ops/types";
import type { PwaPushController } from "@/components/ops/use-pwa-push";

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
}: {
  notifications: NotificationItem[];
  onOpen: (id: string) => void;
  pwaPush: PwaPushController;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

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

  return (
    <div className="flex flex-col gap-6 min-w-0">
      <div className="screen-header">
        <div>
          <h2>Thông báo</h2>
          <p>Mở trang này sẽ tự đánh dấu các thông báo hiện có của bạn là đã đọc</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-100">
            {unreadCount} chưa đọc
          </span>
        </div>
      </div>

      <PwaPushSettings push={pwaPush} />

      <TableShell>
        <div className="table-toolbar">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-500">
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
                <th>Công việc liên kết</th>
                <th>Thời gian</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleNotifications.map((item) => {
                const isUnread = !item.read_at;

                return (
                  <tr
                    key={item.id}
                    className={isUnread ? "bg-zinc-50/50 hover:bg-zinc-50/70" : "hover:bg-zinc-50/30"}
                  >
                    <td data-label="Nội dung">
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${isUnread ? "bg-blue-50 text-blue-600" : "bg-zinc-100 text-zinc-400"}`}
                        >
                          <Bell size={12} />
                        </div>
                        <div>
                          <p className={`text-sm ${isUnread ? "font-semibold text-zinc-900" : "text-zinc-700"}`}>
                            {item.title}
                          </p>
                          <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{item.body}</p>
                        </div>
                      </div>
                    </td>
                    <td data-label="Công việc">
                      {item.work_order_id ? (
                        <button
                          onClick={() => onOpen(item.work_order_id!)}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-zinc-100 text-zinc-800 hover:bg-zinc-200 transition-colors animate-fade-in"
                          type="button"
                        >
                          <Eye size={11} />
                          Xem công việc
                        </button>
                      ) : (
                        <span className="text-xs text-zinc-400">Không có</span>
                      )}
                    </td>
                    <td data-label="Thời gian">
                      <p className="text-xs font-medium text-zinc-700">{timeAgo(item.created_at)}</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">{dateTime(item.created_at)}</p>
                    </td>
                    <td data-label="Trạng thái">
                      {isUnread ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          <Mail size={10} />
                          Chưa đọc
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-50 text-zinc-500 border border-zinc-200">
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
                        ) : null}
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
    </div>
  );
}
