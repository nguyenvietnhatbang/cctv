"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Bell, KeyRound, LogOut, ChevronsUpDown, Sun, Search } from "lucide-react";
import { ROLE_LABELS } from "@/lib/types";
import { tabIcons, type TabId } from "@/components/ops/app-config";
import type { SessionUser } from "@/components/ops/types";

type OpsShellProps = {
  user: SessionUser;
  section: TabId;
  currentTab: { id: TabId; label: string };
  visibleTabs: ReadonlyArray<{ id: TabId; label: string }>;
  unreadNotifications: number;
  error: string | null;
  onLogout: () => void;
  onChangePassword: () => void;
  onNavigateIntent?: (section: TabId) => void;
  modals?: ReactNode;
  children: ReactNode;
};

const BUSINESS_TABS: readonly string[] = ["dashboard", "orders", "customers", "dispatch", "technicians", "technician", "assignment-history"];
const ACCOUNTING_TABS: readonly string[] = ["payments", "reports"];
const MANAGEMENT_TABS: readonly string[] = ["users", "notifications"];

export function OpsShell({
  user,
  section,
  currentTab,
  visibleTabs,
  unreadNotifications,
  error,
  onLogout,
  onChangePassword,
  onNavigateIntent,
  modals,
  children,
}: OpsShellProps) {
  const businessTabs = visibleTabs.filter((tab) => BUSINESS_TABS.includes(tab.id));
  const accountingTabs = visibleTabs.filter((tab) => ACCOUNTING_TABS.includes(tab.id));
  const managementTabs = visibleTabs.filter((tab) => MANAGEMENT_TABS.includes(tab.id));

  const renderLink = (item: { id: TabId; label: string }) => {
    const Icon = tabIcons[item.id];
    const isActive = section === item.id;
    return (
      <Link
        key={item.id}
        href={`/${item.id}`}
        prefetch
        onMouseEnter={() => onNavigateIntent?.(item.id)}
        onFocus={() => onNavigateIntent?.(item.id)}
        onTouchStart={() => onNavigateIntent?.(item.id)}
        className={`sidebar-link flex items-center justify-between px-3 py-1.5 rounded-md transition-colors text-sm ${isActive ? "sidebar-link-active" : ""}`}
      >
        <div className="flex items-center gap-2.5">
          <Icon size={16} className={isActive ? "text-zinc-950" : "text-zinc-500"} />
          <span className={isActive ? "font-semibold text-zinc-950" : "text-zinc-600"}>{item.label}</span>
        </div>
        {item.id === "notifications" && unreadNotifications > 0 ? (
          <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
            {unreadNotifications}
          </span>
        ) : isActive ? (
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 mr-0.5" />
        ) : null}
      </Link>
    );
  };

  return (
    <main className="app-frame">
      <aside className="app-sidebar flex flex-col h-screen border-r border-zinc-200 bg-white">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-zinc-950 text-white font-bold text-sm">
              C
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-900 leading-tight">CCTV Ops</p>
              <p className="text-[10px] text-zinc-400 font-medium leading-none">v1.1.0</p>
            </div>
          </div>
          <button className="text-zinc-400 hover:text-zinc-600">
            <ChevronsUpDown size={15} />
          </button>
        </div>

        {/* Sidebar Links Grouped */}
        <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-6">
          {businessTabs.length > 0 ? (
            <div>
              <div className="px-5 mb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Business</div>
              <nav className="grid gap-0.5 px-2">{businessTabs.map(renderLink)}</nav>
            </div>
          ) : null}

          {accountingTabs.length > 0 ? (
            <div>
              <div className="px-5 mb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Accounting</div>
              <nav className="grid gap-0.5 px-2">{accountingTabs.map(renderLink)}</nav>
            </div>
          ) : null}

          {managementTabs.length > 0 ? (
            <div>
              <div className="px-5 mb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Management</div>
              <nav className="grid gap-0.5 px-2">{managementTabs.map(renderLink)}</nav>
            </div>
          ) : null}
        </div>

        {/* User Profile */}
        <div className="mt-auto border-t border-zinc-100 p-3 flex items-center justify-between gap-2 bg-zinc-50/50">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-zinc-950 text-white flex items-center justify-center font-bold text-xs border border-zinc-200 shrink-0">
              {user.fullName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .substring(0, 2)
                .toUpperCase()}
            </div>
            <div className="text-xs truncate">
              <p className="font-semibold text-zinc-900 leading-tight truncate">{user.fullName}</p>
              <p className="text-zinc-500 leading-none truncate mt-0.5">{ROLE_LABELS[user.role]}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={onChangePassword}
              className="text-zinc-400 hover:text-zinc-950 p-1.5 rounded-md hover:bg-zinc-100 transition-colors"
              title="Đổi mật khẩu"
              type="button"
            >
              <KeyRound size={16} />
            </button>
            <button
              onClick={onLogout}
              className="text-zinc-400 hover:text-zinc-950 p-1.5 rounded-md hover:bg-zinc-100 transition-colors"
              title="Đăng xuất"
              type="button"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="app-content flex flex-col min-h-screen">
        <header className="app-topbar bg-white/85 backdrop-blur-md flex items-center justify-between border-b border-zinc-200">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-medium">
              <span>Dashboard</span>
              <span className="text-[10px]">/</span>
              <span>CCTV Ops</span>
              <span className="text-[10px]">/</span>
              <span className="text-zinc-600 font-semibold">{currentTab.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Mock Search Bar */}
            <div className="relative hidden lg:flex items-center w-56">
              <Search size={14} className="search-field-icon" />
              <input
                type="text"
                placeholder="Tìm kiếm..."
                className="search-field-input w-full rounded-md border border-zinc-200 bg-zinc-50 py-1.5 pr-8 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-800"
                readOnly
              />
              <span className="absolute right-3 text-[9px] text-zinc-400 font-semibold border border-zinc-200 bg-white px-1 rounded leading-normal">
                ⌘F
              </span>
            </div>

            {/* Mock Theme Toggle */}
            <button className="p-2 rounded-md hover:bg-zinc-50 text-zinc-500 hover:text-zinc-950 transition-colors" type="button">
              <Sun size={17} />
            </button>

            {/* Notifications Icon */}
            <Link
              href="/notifications"
              className="relative p-2 rounded-md hover:bg-zinc-50 text-zinc-500 hover:text-zinc-950 transition-colors"
              aria-label="Thông báo"
            >
              <Bell size={17} />
              {unreadNotifications > 0 ? (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full ring-2 ring-white" />
              ) : null}
            </Link>

            <button
              className="mobile-logout-button p-2 rounded-md hover:bg-zinc-50 text-zinc-500 hover:text-zinc-950 transition-colors"
              onClick={onLogout}
              type="button"
              title="Đăng xuất"
              aria-label="Đăng xuất"
            >
              <LogOut size={17} />
            </button>

            {/* Profile Initial Avatar */}
            <div className="flex items-center gap-2 border-l border-zinc-200 pl-3">
              <button
                className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-950 flex items-center justify-center font-bold text-[11px] border border-zinc-200 hover:bg-zinc-200"
                onClick={onChangePassword}
                type="button"
                title="Đổi mật khẩu"
              >
                {user.fullName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .substring(0, 2)
                  .toUpperCase()}
              </button>
            </div>
          </div>
        </header>

        <section className="content-surface flex-1">
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : null}
          {children}
        </section>
      </div>

      <nav className="mobile-nav">
        {visibleTabs.map((item) => {
          const Icon = tabIcons[item.id];
          return (
            <Link
              key={item.id}
              href={`/${item.id}`}
              prefetch
              onMouseEnter={() => onNavigateIntent?.(item.id)}
              onFocus={() => onNavigateIntent?.(item.id)}
              onTouchStart={() => onNavigateIntent?.(item.id)}
              className={`mobile-nav-link ${section === item.id ? "mobile-nav-link-active" : ""}`}
              aria-label={item.label}
            >
              <Icon size={18} />
              {item.id === "notifications" && unreadNotifications > 0 ? (
                <span className="absolute right-2 top-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                  {unreadNotifications}
                </span>
              ) : null}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      {modals}
    </main>
  );
}
