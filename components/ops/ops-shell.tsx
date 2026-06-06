"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Bell, LogOut } from "lucide-react";
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
  modals?: ReactNode;
  children: ReactNode;
};

export function OpsShell({
  user,
  section,
  currentTab,
  visibleTabs,
  unreadNotifications,
  error,
  onLogout,
  modals,
  children,
}: OpsShellProps) {
  return (
    <main className="app-frame">
      <aside className="app-sidebar">
        <div className="grid gap-1 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">CCTV Ops</p>
          <h1 className="text-lg font-semibold text-zinc-950">Điều phối kỹ thuật</h1>
        </div>
        <nav className="sidebar-nav">
          {visibleTabs.map((item) => {
            const Icon = tabIcons[item.id];
            return (
              <Link key={item.id} href={`/${item.id}`} prefetch={false} className={`sidebar-link ${section === item.id ? "sidebar-link-active" : ""}`}>
                <Icon size={17} />
                <span>{item.label}</span>
                {item.id === "notifications" && unreadNotifications > 0 ? (
                  <span className="ml-auto rounded-full bg-cyan-600 px-2 py-0.5 text-[11px] font-bold text-white">{unreadNotifications}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-zinc-200 p-4">
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm">
            <p className="font-semibold text-zinc-950">{user.fullName}</p>
            <p className="mt-1 text-zinc-500">{ROLE_LABELS[user.role]}</p>
          </div>
          <button onClick={onLogout} className="btn-secondary mt-3 h-10 w-full" type="button"><LogOut size={16} />Thoát</button>
        </div>
      </aside>

      <div className="app-content">
        <header className="app-topbar">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">CCTV Ops</p>
            <h1 className="text-lg font-semibold text-zinc-950">{currentTab.label}</h1>
          </div>
          <div className="flex items-center gap-2">
            {unreadNotifications > 0 ? (
              <Link href="/notifications" prefetch={false} className="icon-button relative" aria-label="Thông báo">
                <Bell size={17} />
                <span className="absolute -right-1 -top-1 rounded-full bg-cyan-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{unreadNotifications}</span>
              </Link>
            ) : null}
            <div className="hidden text-right text-sm md:block">
              <p className="font-medium">{user.fullName}</p>
              <p className="text-zinc-500">{ROLE_LABELS[user.role]}</p>
            </div>
            <button onClick={onLogout} className="btn-secondary h-10" type="button"><LogOut size={16} />Thoát</button>
          </div>
        </header>

        <section className="content-surface">
          {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          {children}
        </section>
      </div>

      <nav className="mobile-nav">
        {visibleTabs.map((item) => {
          const Icon = tabIcons[item.id];
          return (
            <Link key={item.id} href={`/${item.id}`} prefetch={false} className={`mobile-nav-link ${section === item.id ? "mobile-nav-link-active" : ""}`} aria-label={item.label}>
              <Icon size={18} />
              {item.id === "notifications" && unreadNotifications > 0 ? (
                <span className="absolute right-2 top-1 rounded-full bg-cyan-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{unreadNotifications}</span>
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
