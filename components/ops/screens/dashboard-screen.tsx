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
    },
    {
      title: "Khách hàng",
      description: "Quản lý hồ sơ, liên hệ và lịch sử phiếu.",
      href: "/customers",
      icon: Users,
      stat: "Danh bạ khách",
    },
    {
      title: "Phân công",
      description: "Gán kỹ thuật theo khu vực và tải việc.",
      href: "/dispatch",
      icon: MapPinned,
      stat: `${metrics?.todo ?? "0"} việc chưa làm`,
    },
    {
      title: "DS kỹ thuật",
      description: "Theo dõi nhân sự kỹ thuật, trạng thái và khu vực.",
      href: "/technicians",
      icon: UserCog,
      stat: "Đội hiện trường",
    },
    {
      title: "Thanh toán",
      description: "Xác nhận đã thu, chuyển khoản hoặc công nợ.",
      href: "/payments",
      icon: CreditCard,
      stat: `${money(metrics?.open_debt)} công nợ`,
    },
    {
      title: "Báo cáo",
      description: "Tổng hợp hệ thống, doanh thu, tiến độ, vật tư.",
      href: "/reports",
      icon: ReceiptText,
      stat: `${money(metrics?.paid_today)} đã thu hôm nay`,
    },
    {
      title: "Nhân viên",
      description: "Tạo tài khoản, phân quyền, đặt lại mật khẩu.",
      href: "/users",
      icon: UserCog,
      stat: "Quản trị truy cập",
    },
    {
      title: "Thông báo",
      description: "Xem các cập nhật giao việc và trạng thái.",
      href: "/notifications",
      icon: Bell,
      stat: "Nhắc việc nội bộ",
    },
  ];

  const quickStatuses = [
    { label: "Việc chưa làm", value: metrics?.todo ?? "0", status: "todo" },
    { label: "Đang làm", value: metrics?.doing ?? "0", status: "doing" },
    { label: "Đang làm quá hạn", value: metrics?.doing_overdue ?? "0", status: "doing_overdue" },
    { label: "Hoàn thành", value: metrics?.done ?? "0", status: "done" },
    { label: "Hoàn thành quá hạn", value: metrics?.done_overdue ?? "0", status: "done_overdue" },
  ];

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-zinc-950">Tổng quan</h2>
          <p className="mt-1 text-sm text-zinc-500">Các chức năng quản trị chính và tình hình công việc nhanh.</p>
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
              className="group grid min-h-36 gap-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-zinc-950 text-white transition group-hover:bg-zinc-800">
                  <Icon size={18} />
                </span>
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600">{item.stat}</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-950">{item.title}</h3>
                <p className="mt-1 text-sm leading-6 text-zinc-500">{item.description}</p>
              </div>
            </Link>
          );
        })}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Tình hình nhanh</h2>
            <p className="mt-1 text-sm text-zinc-500">Bấm vào từng trạng thái để mở danh sách công việc tương ứng.</p>
          </div>
          <span>{metrics?.total_today ?? "0"} phiếu hôm nay</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {quickStatuses.map((item) => (
            <button
              key={item.status}
              className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-left transition hover:border-zinc-300 hover:bg-white"
              onClick={() => onOpenOrders(item.status)}
              type="button"
            >
              <p className="text-xs font-bold uppercase text-zinc-500">{item.label}</p>
              <p className="mt-2 text-2xl font-black text-zinc-950">{item.value}</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
