"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/ops/ui";
import { money } from "@/components/ops/format";
import type { Metrics, WorkOrderListItem } from "@/components/ops/types";
import { ChevronDown, Filter, TrendingUp } from "lucide-react";

export function DashboardScreen({
  metrics,
  orders,
  onOpenOrders,
}: {
  metrics: Metrics | null;
  orders: WorkOrderListItem[];
  onOpenOrders: (status: string) => void;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(5); // Default to June

  const cards = [
    ["Công việc hôm nay", metrics?.total_today ?? "0", ""],
    ["Việc chưa làm", metrics?.todo ?? "0", "todo"],
    ["Đang làm", metrics?.doing ?? "0", "doing"],
    ["Đang làm quá hạn", metrics?.doing_overdue ?? "0", "doing_overdue"],
    ["Hoàn thành", metrics?.done ?? "0", "done"],
    ["Hoàn thành quá hạn", metrics?.done_overdue ?? "0", "done_overdue"],
    ["Đã thu hôm nay", money(metrics?.paid_today), ""],
    ["Công nợ mở", money(metrics?.open_debt), "debt"],
  ] as const;

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const incomingData = [120, 150, 130, 170, 160, 210, 180, 200, 190, 230, 220, 260];
  const outgoingData = [90, 110, 100, 140, 130, 170, 140, 160, 150, 190, 180, 210];

  const getSvgPath = (data: number[]) => {
    return data
      .map((val, i) => {
        const x = 50 + i * (700 / 11);
        const y = 200 - (val / 300) * 160;
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  };

  const getSvgAreaPath = (data: number[]) => {
    const linePath = getSvgPath(data);
    const firstX = 50;
    const lastX = 50 + 11 * (700 / 11);
    return `${linePath} L ${lastX} 200 L ${firstX} 200 Z`;
  };

  return (
    <div className="grid gap-6">
      {/* Metric Cards Grid */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, status]) => (
          <button
            key={label}
            className="metric-card bg-white border border-zinc-200 rounded-lg p-4 text-left shadow-sm hover:border-zinc-300 hover:shadow-md transition-all duration-200"
            onClick={() => onOpenOrders(status)}
            type="button"
          >
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{label}</span>
            <strong className="block text-2xl font-bold text-zinc-900 mt-2 leading-none">{value}</strong>
          </button>
        ))}
      </div>

      {/* Main Content Layout: Chart & Active Work Orders */}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Analytics Chart Card */}
        <div className="panel bg-white border border-zinc-200 rounded-lg p-5 shadow-sm relative flex flex-col justify-between min-h-[360px]">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-1.5">
                <TrendingUp size={16} className="text-zinc-500" />
                Tổng quan hiệu suất vận hành
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">Biểu đồ so sánh công việc nhận và hoàn thành năm 2026</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-4 text-xs font-semibold mr-2">
                <p className="flex items-center gap-1.5 text-zinc-600">
                  <span className="w-2.5 h-2.5 rounded bg-indigo-500 inline-block" />
                  Công việc nhận
                </p>
                <p className="flex items-center gap-1.5 text-zinc-600">
                  <span className="w-2.5 h-2.5 rounded bg-orange-500 inline-block" />
                  Hoàn thành
                </p>
              </div>
              <button className="btn-secondary min-h-[2rem] px-2.5 text-xs py-1" type="button">
                Hàng tháng <ChevronDown size={12} className="ml-1" />
              </button>
              <button className="btn-secondary min-h-[2rem] px-2.5 text-xs py-1" type="button">
                <Filter size={12} className="mr-1" /> Lọc
              </button>
            </div>
          </div>

          {/* SVG Chart Area */}
          <div className="relative flex-1 min-h-[200px]">
            <svg viewBox="0 0 800 240" className="w-full h-full overflow-visible">
              {/* Gradients definitions */}
              <defs>
                <linearGradient id="areaIncoming" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="areaOutgoing" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#f97316" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid lines */}
              <line x1="50" y1="40" x2="750" y2="40" stroke="#f1f5f9" strokeWidth={1} strokeDasharray="3 3" />
              <line x1="50" y1="80" x2="750" y2="80" stroke="#f1f5f9" strokeWidth={1} strokeDasharray="3 3" />
              <line x1="50" y1="120" x2="750" y2="120" stroke="#f1f5f9" strokeWidth={1} strokeDasharray="3 3" />
              <line x1="50" y1="160" x2="750" y2="160" stroke="#f1f5f9" strokeWidth={1} strokeDasharray="3 3" />
              <line x1="50" y1="200" x2="750" y2="200" stroke="#e2e8f0" strokeWidth={1} />

              {/* Shaded Areas under paths */}
              <path d={getSvgAreaPath(incomingData)} fill="url(#areaIncoming)" />
              <path d={getSvgAreaPath(outgoingData)} fill="url(#areaOutgoing)" />

              {/* Main Line paths */}
              <path d={getSvgPath(incomingData)} fill="none" stroke="#6366f1" strokeWidth={2.5} strokeLinecap="round" />
              <path d={getSvgPath(outgoingData)} fill="none" stroke="#f97316" strokeWidth={2.5} strokeLinecap="round" />

              {/* Dotted indicator line for active month */}
              {hoveredIdx !== null && (
                <line
                  x1={50 + hoveredIdx * (700 / 11)}
                  y1={30}
                  x2={50 + hoveredIdx * (700 / 11)}
                  y2={200}
                  stroke="#cbd5e1"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
              )}

              {/* Circles on vertices for active month */}
              {hoveredIdx !== null && (
                <>
                  <circle
                    cx={50 + hoveredIdx * (700 / 11)}
                    cy={200 - (incomingData[hoveredIdx] / 300) * 160}
                    r={5}
                    fill="#6366f1"
                    stroke="#ffffff"
                    strokeWidth={2}
                  />
                  <circle
                    cx={50 + hoveredIdx * (700 / 11)}
                    cy={200 - (outgoingData[hoveredIdx] / 300) * 160}
                    r={5}
                    fill="#f97316"
                    stroke="#ffffff"
                    strokeWidth={2}
                  />
                </>
              )}

              {/* Monthly text labels */}
              {months.map((month, i) => {
                const x = 50 + i * (700 / 11);
                const isHovered = hoveredIdx === i;
                return (
                  <text
                    key={month}
                    x={x}
                    y={220}
                    textAnchor="middle"
                    className={`text-[11px] font-semibold transition-colors ${isHovered ? "fill-zinc-950 font-bold" : "fill-zinc-400"}`}
                  >
                    {month}
                  </text>
                );
              })}

              {/* Invisible interactive columns */}
              {months.map((_, i) => {
                const x = 50 + i * (700 / 11);
                return (
                  <rect
                    key={i}
                    x={x - 20}
                    y={20}
                    width={40}
                    height={180}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(i)}
                  />
                );
              })}
            </svg>

            {/* Custom Tooltip Card Overlay */}
            {hoveredIdx !== null && (
              <div
                className="absolute bg-white rounded-lg shadow-md border border-zinc-200/80 p-2 text-xs pointer-events-none transition-all duration-200"
                style={{
                  left: `${(50 + hoveredIdx * (700 / 11)) / 8}%`, // map percentage coordinate
                  transform: `translateX(-50%)`,
                  bottom: "190px",
                }}
              >
                <p className="font-semibold text-zinc-500 mb-1">{months[hoveredIdx]} - 2026</p>
                <div className="flex flex-col gap-1">
                  <p className="flex items-center gap-1.5 font-bold text-zinc-900 leading-none">
                    <span className="w-2 h-2 rounded bg-indigo-500 inline-block" />
                    Công việc nhận: {incomingData[hoveredIdx]}
                  </p>
                  <p className="flex items-center gap-1.5 font-bold text-zinc-900 leading-none">
                    <span className="w-2 h-2 rounded bg-orange-500 inline-block" />
                    Hoàn thành: {outgoingData[hoveredIdx]}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Việc cần xử lý Panel */}
        <section className="panel bg-white border border-zinc-200 rounded-lg p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="panel-heading mb-4 border-b border-zinc-100 pb-2">
              <div>
                <h2 className="text-sm font-bold text-zinc-900">Việc cần xử lý</h2>
                <p className="text-[11px] text-zinc-500 mt-0.5">Danh sách các công việc đang hoạt động</p>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-800">
                {orders.length} việc
              </span>
            </div>
            <div className="grid gap-2 max-h-[260px] overflow-y-auto pr-1">
              {orders.slice(0, 5).map((order) => (
                <div
                  key={order.id}
                  className="compact-row border border-zinc-100 rounded-md p-3 hover:border-zinc-300 hover:bg-zinc-50 transition-colors"
                >
                  <div>
                    <p className="font-bold text-sm text-zinc-900 leading-snug">
                      {order.code} · {order.customer_name}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1 truncate max-w-[200px]">{order.customer_address}</p>
                  </div>
                  <StatusBadge order={order} />
                </div>
              ))}
            </div>
          </div>
          {orders.length === 0 ? (
            <div className="text-center py-6 text-xs text-zinc-400">Không có việc cần xử lý.</div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
