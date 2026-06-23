"use client";

import Link from "next/link";
import {
  BarChart3,
  Bell,
  ClipboardList,
  CreditCard,
  MapPinned,
  ReceiptText,
  UserCog,
  Users,
} from "lucide-react";
import { money } from "@/components/ops/format";
import type { Metrics, WorkOrderListItem } from "@/components/ops/types";
import { DISPLAY_STATUS_LABELS, DISPLAY_STATUS_ORDER, DISPLAY_STATUS_TONE, type DisplayStatus } from "@/lib/types";

export function DashboardScreen({
  metrics,
  orders,
  onOpenOrders,
}: {
  metrics: Metrics | null;
  orders: WorkOrderListItem[];
  onOpenOrders: (status: string) => void;
}) {
  const functionCards = [
    {
      title: "Công việc",
      description: "Tạo phiếu, theo dõi và xử lý trạng thái.",
      href: "/orders",
      icon: ClipboardList,
      stat: `${orders.length} phiếu đang hiển thị`,
      tone: "blue",
    },
    {
      title: "Khách hàng",
      description: "Quản lý hồ sơ, liên hệ và lịch sử phiếu.",
      href: "/customers",
      icon: Users,
      stat: "Danh bạ khách",
      tone: "violet",
    },
    {
      title: "Phân công",
      description: "Gán kỹ thuật theo khu vực và tải việc.",
      href: "/dispatch",
      icon: MapPinned,
      stat: `${metrics?.todo ?? "0"} việc chưa làm`,
      tone: "orange",
    },
    {
      title: "DS kỹ thuật",
      description: "Theo dõi nhân sự kỹ thuật, trạng thái và khu vực.",
      href: "/technicians",
      icon: UserCog,
      stat: "Đội hiện trường",
      tone: "cyan",
    },
    {
      title: "Thanh toán",
      description: "Xác nhận đã thu, chuyển khoản hoặc công nợ.",
      href: "/payments",
      icon: CreditCard,
      stat: `${money(metrics?.open_debt)} công nợ`,
      tone: "emerald",
    },
    {
      title: "Báo cáo",
      description: "Tổng hợp hệ thống, doanh thu, tiến độ, vật tư.",
      href: "/reports",
      icon: ReceiptText,
      stat: `${money(metrics?.paid_today)} đã thu hôm nay`,
      tone: "rose",
    },
    {
      title: "Nhân viên",
      description: "Tạo tài khoản, phân quyền, đặt lại mật khẩu.",
      href: "/users",
      icon: UserCog,
      stat: "Quản trị truy cập",
      tone: "indigo",
    },
    {
      title: "Thông báo",
      description: "Xem các cập nhật giao việc và trạng thái.",
      href: "/notifications",
      icon: Bell,
      stat: "Nhắc việc nội bộ",
      tone: "amber",
    },
  ];

  const quickStatuses = DISPLAY_STATUS_ORDER.map((status) => ({
    label: DISPLAY_STATUS_LABELS[status],
    value: metrics?.[status] ?? "0",
    status,
  }));

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-normal text-slate-950">Tổng quan</h2>
          <p className="mt-1 text-sm text-slate-500">Các chức năng quản trị chính và tình hình công việc nhanh.</p>
        </div>
        <Link className="btn-primary h-10" href="/reports">
          <BarChart3 size={15} />Xem báo cáo hệ thống
        </Link>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {functionCards.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.title}
              href={item.href}
              className="dashboard-function-card group grid min-h-36 gap-4 rounded-lg border p-4 shadow-sm transition hover:shadow-md"
              data-tone={item.tone}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="dashboard-function-icon inline-flex h-10 w-10 items-center justify-center rounded-md border transition">
                  <Icon size={18} />
                </span>
                <span className="dashboard-function-stat rounded-full border px-2.5 py-1 text-xs font-semibold">{item.stat}</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-950">{item.title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">{item.description}</p>
              </div>
            </Link>
          );
        })}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Tình hình nhanh!</h2>
            <p className="mt-1 text-sm text-slate-500">Bấm vào từng trạng thái để mở danh sách công việc tương ứng.</p>
          </div>
          <span>{metrics?.total_today ?? "0"} phiếu hẹn hôm nay</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {quickStatuses.map((item) => (
            <button
              key={item.status}
              className="rounded-md border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-blue-200 hover:bg-white"
              onClick={() => onOpenOrders(item.status)}
              type="button"
            >
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${DISPLAY_STATUS_TONE[item.status as DisplayStatus]}`}>
                {item.label}
              </span>
              <p className="mt-2 text-2xl font-black text-slate-950">{item.value}</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
