"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Bell, KeyRound, LogOut, ChevronLeft, ChevronRight, Moon, Sun, Search } from "lucide-react";
import { ROLE_LABELS } from "@/lib/types";
import { brandAssets, companyProfile } from "@/lib/company";
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

function mobileTabIdsForRole(role: SessionUser["role"]): readonly TabId[] {
  if (role === "technician") {
    return ["technician", "assignment-history", "notifications"];
  }
  if (role === "accountant") {
    return ["dashboard", "orders", "payments", "reports", "notifications"];
  }
  if (role === "admin") {
    return ["dashboard", "orders", "dispatch", "payments", "notifications"];
  }
  return ["dashboard", "orders", "dispatch", "technician", "notifications"];
}

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
  const [darkMode, setDarkMode] = useState(false);
  const businessTabs = visibleTabs.filter((tab) => BUSINESS_TABS.includes(tab.id));
  const accountingTabs = visibleTabs.filter((tab) => ACCOUNTING_TABS.includes(tab.id));
  const managementTabs = visibleTabs.filter((tab) => MANAGEMENT_TABS.includes(tab.id));
  const mobileTabIds = mobileTabIdsForRole(user.role);
  const mobileTabs = visibleTabs.filter((tab) => mobileTabIds.includes(tab.id));

  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    setDarkMode(document.documentElement.dataset.theme === "dark");
    const stored = localStorage.getItem("cctv_sidebar_collapsed");
    if (stored === "true") {
      setIsCollapsed(true);
    }
  }, []);

  function toggleSidebar() {
    const nextCollapsed = !isCollapsed;
    setIsCollapsed(nextCollapsed);
    localStorage.setItem("cctv_sidebar_collapsed", String(nextCollapsed));
  }

  function toggleDarkMode() {
    const nextDarkMode = !darkMode;
    const theme = nextDarkMode ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("cctv_theme", theme);
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", nextDarkMode ? "#0f172a" : "#1d4ed8");
    setDarkMode(nextDarkMode);
  }

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
          <Icon size={16} className={isActive ? "text-blue-700" : "text-slate-500"} />
          <span className={isActive ? "font-semibold text-slate-950" : "text-slate-600"}>{item.label}</span>
        </div>
        {item.id === "notifications" && unreadNotifications > 0 ? (
          <span className="sidebar-badge rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
            {unreadNotifications}
          </span>
        ) : isActive ? (
          <span className="active-dot w-1.5 h-1.5 rounded-full bg-blue-600 mr-0.5" />
        ) : null}
      </Link>
    );
  };

  return (
    <main className="app-frame">
      <aside className={`app-sidebar flex flex-col h-screen ${isCollapsed ? "collapsed" : ""}`}>
        {/* Brand Header */}
        <div className="app-sidebar-header flex items-center justify-between border-b border-blue-100/70 bg-white/45 px-4 py-4 backdrop-blur-sm">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-blue-100 bg-white shadow-sm">
              <Image
                src={brandAssets.mark}
                alt={companyProfile.displayName}
                width={30}
                height={30}
                priority
                className="h-7 w-7 object-contain"
              />
            </div>
            <div className={`min-w-0 transition-opacity duration-200 ${isCollapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"}`}>
              <p className="brand-title truncate text-xs font-bold leading-tight">{companyProfile.appName}</p>
              <p className="brand-link truncate text-[10px] font-medium leading-none">{companyProfile.website}</p>
            </div>
          </div>
          <button
            onClick={toggleSidebar}
            className="sidebar-toggle-btn p-1 rounded transition-colors"
            title={isCollapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"}
            type="button"
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Sidebar Links Grouped */}
        <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-6">
          {businessTabs.length > 0 ? (
            <div>
              <div className="sidebar-group-title px-5 mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Business</div>
              <nav className="grid gap-0.5 px-2">{businessTabs.map(renderLink)}</nav>
            </div>
          ) : null}

          {accountingTabs.length > 0 ? (
            <div>
              <div className="sidebar-group-title px-5 mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Accounting</div>
              <nav className="grid gap-0.5 px-2">{accountingTabs.map(renderLink)}</nav>
            </div>
          ) : null}

          {managementTabs.length > 0 ? (
            <div>
              <div className="sidebar-group-title px-5 mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Management</div>
              <nav className="grid gap-0.5 px-2">{managementTabs.map(renderLink)}</nav>
            </div>
          ) : null}
        </div>

        {/* User Profile */}
        <div className="app-sidebar-footer mt-auto border-t border-blue-100/70 bg-white/45 p-3 flex items-center justify-between gap-2 backdrop-blur-sm">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-teal-700 text-white flex items-center justify-center font-bold text-xs border border-teal-600 shrink-0">
              {user.fullName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .substring(0, 2)
                .toUpperCase()}
            </div>
            <div className={`text-xs truncate transition-opacity duration-200 ${isCollapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"}`}>
              <p className="profile-name font-semibold leading-tight truncate">{user.fullName}</p>
              <p className="profile-role leading-none truncate mt-0.5">{ROLE_LABELS[user.role]}</p>
            </div>
          </div>
          <div className={`flex shrink-0 items-center gap-1 transition-opacity duration-200 ${isCollapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"}`}>
            <button
              onClick={onChangePassword}
              className="sidebar-footer-btn p-1.5 rounded-md transition-colors"
              title="Đổi mật khẩu"
              type="button"
            >
              <KeyRound size={16} />
            </button>
            <button
              onClick={onLogout}
              className="sidebar-footer-btn p-1.5 rounded-md transition-colors"
              title="Đăng xuất"
              type="button"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="app-content flex flex-col min-h-screen">
        <header className="app-topbar bg-white/85 backdrop-blur-md flex items-center justify-between border-b border-slate-200">
          <div className="min-w-0">
            <div className="desktop-breadcrumb flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
              <span>Vận hành</span>
              <span className="text-[10px]">/</span>
              <span>{companyProfile.displayName}</span>
              <span className="text-[10px]">/</span>
              <span className="text-blue-700 font-semibold">{currentTab.label}</span>
            </div>
            <div className="native-app-title">
              <span className="native-app-eyebrow">{companyProfile.displayName}</span>
              <strong>{currentTab.label}</strong>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Mock Search Bar */}
            <div className="relative hidden lg:flex items-center w-56">
              <Search size={14} className="search-field-icon" />
              <input
                type="text"
                placeholder="Tìm kiếm..."
                className="search-field-input w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 pr-8 text-xs focus:outline-none focus:ring-1 focus:ring-blue-600"
                readOnly
              />
              <span className="absolute right-3 text-[9px] text-slate-400 font-semibold border border-slate-200 bg-white px-1 rounded leading-normal">
                ⌘F
              </span>
            </div>

            <button
              className="theme-toggle-button p-2 rounded-md hover:bg-blue-50 text-slate-500 hover:text-blue-700 transition-colors"
              type="button"
              onClick={toggleDarkMode}
              title={darkMode ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
              aria-label={darkMode ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
              aria-pressed={darkMode}
            >
              {darkMode ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {/* Notifications Icon */}
            <Link
              href="/notifications"
              className="relative p-2 rounded-md hover:bg-blue-50 text-slate-500 hover:text-blue-700 transition-colors"
              aria-label="Thông báo"
            >
              <Bell size={17} />
              {unreadNotifications > 0 ? (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full ring-2 ring-white" />
              ) : null}
            </Link>

            <button
              className="mobile-logout-button p-2 rounded-md hover:bg-blue-50 text-slate-500 hover:text-blue-700 transition-colors"
              onClick={onLogout}
              type="button"
              title="Đăng xuất"
              aria-label="Đăng xuất"
            >
              <LogOut size={17} />
            </button>

            {/* Profile Initial Avatar */}
            <div className="profile-avatar flex items-center gap-2 border-l border-slate-200 pl-3">
              <button
                className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-[11px] border border-blue-100 hover:bg-blue-100"
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

      <nav
        className="mobile-nav"
        style={{ "--mobile-nav-count": mobileTabs.length } as CSSProperties}
      >
        {mobileTabs.map((item) => {
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
