"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LogOut,
  MapPinned,
  ReceiptText,
  UserCog,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { ROLE_LABELS } from "@/lib/types";
import { apiFetch } from "@/components/ops/api";
import { AuthScreen } from "@/components/ops/auth-screen";
import { todayInVietnam } from "@/components/ops/format";
import type {
  AppData,
  AppUser,
  Customer,
  Filters,
  ModalState,
  ReportData,
  Role,
  SessionUser,
  Technician,
  WorkOrderDetail,
} from "@/components/ops/types";
import { ConfirmModal, Modal } from "@/components/ops/ui";
import { DashboardScreen } from "@/components/ops/screens/dashboard-screen";
import { OrdersScreen } from "@/components/ops/screens/orders-screen";
import { CustomersScreen } from "@/components/ops/screens/customers-screen";
import { DispatchScreen } from "@/components/ops/screens/dispatch-screen";
import { TechnicianScreen } from "@/components/ops/screens/technician-screen";
import { TechniciansScreen } from "@/components/ops/screens/technicians-screen";
import { PaymentsScreen } from "@/components/ops/screens/payments-screen";
import { ReportsScreen } from "@/components/ops/screens/reports-screen";
import { NotificationsScreen } from "@/components/ops/screens/notifications-screen";
import { UsersScreen } from "@/components/ops/screens/users-screen";
import { CustomerDetailModal, CustomerEditModal, TechnicianEditModal, UserEditModal } from "@/components/ops/entity-modals";
import { DispatchAssignmentModal, DispatchDetailModal, PaymentActionModal, PaymentDetailModal, WorkOrderDetailModal, WorkOrderEditModal } from "@/components/ops/modals";

type TabId =
  | "dashboard"
  | "orders"
  | "customers"
  | "dispatch"
  | "technician"
  | "technicians"
  | "payments"
  | "reports"
  | "notifications"
  | "users";

const tabs: ReadonlyArray<{ id: TabId; label: string; roles: readonly Role[] }> = [
  { id: "dashboard", label: "Tổng quan", roles: ["admin", "dispatcher", "accountant", "technician"] },
  { id: "orders", label: "Phiếu", roles: ["admin", "dispatcher", "accountant", "technician"] },
  { id: "customers", label: "Khách hàng", roles: ["admin", "dispatcher", "accountant"] },
  { id: "dispatch", label: "Phân công", roles: ["admin", "dispatcher"] },
  { id: "technician", label: "Kỹ thuật", roles: ["dispatcher", "technician"] },
  { id: "technicians", label: "DS kỹ thuật", roles: ["dispatcher"] },
  { id: "payments", label: "Thanh toán", roles: ["admin", "dispatcher", "accountant"] },
  { id: "reports", label: "Báo cáo", roles: ["admin", "dispatcher", "accountant"] },
  { id: "notifications", label: "Thông báo", roles: ["admin", "dispatcher", "accountant", "technician"] },
  { id: "users", label: "Nhân viên", roles: ["admin"] },
];

const tabIcons: Record<TabId, LucideIcon> = {
  dashboard: LayoutDashboard,
  orders: ClipboardList,
  customers: Users,
  dispatch: MapPinned,
  technician: Wrench,
  technicians: UserCog,
  payments: CreditCard,
  reports: ReceiptText,
  notifications: Bell,
  users: Users,
};

const emptyData: AppData = {
  metrics: null,
  orders: [],
  customers: [],
  technicians: [],
  users: [],
  notifications: [],
  report: null,
};

const defaultFilters: Filters = {
  q: "",
  status: "",
  type: "",
  technicianId: "",
  dateFrom: "",
  dateTo: "",
};

function filtersFromSearchParams(searchParams: { get: (key: string) => string | null }): Filters {
  return {
    q: searchParams.get("q") ?? "",
    status: searchParams.get("status") ?? "",
    type: searchParams.get("type") ?? "",
    technicianId: searchParams.get("technicianId") ?? "",
    dateFrom: searchParams.get("dateFrom") ?? "",
    dateTo: searchParams.get("dateTo") ?? "",
  };
}

function sameFilters(left: Filters, right: Filters) {
  return left.q === right.q
    && left.status === right.status
    && left.type === right.type
    && left.technicianId === right.technicianId
    && left.dateFrom === right.dateFrom
    && left.dateTo === right.dateTo;
}

function sameSessionUser(left: SessionUser | null, right: SessionUser | null) {
  return left?.id === right?.id
    && left?.fullName === right?.fullName
    && left?.email === right?.email
    && left?.phone === right?.phone
    && left?.role === right?.role;
}

export function OpsApp() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(() => filtersFromSearchParams(searchParams));
  const [data, setData] = useState<AppData>(emptyData);
  const [modal, setModal] = useState<ModalState>(null);
  const [detail, setDetail] = useState<WorkOrderDetail | null>(null);

  const section = useMemo<TabId>(() => {
    const segment = pathname.split("/").filter(Boolean)[0] as TabId | undefined;
    if (segment && tabs.some((item) => item.id === segment)) return segment;
    return "dashboard";
  }, [pathname]);

  const routedOrderId = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    return parts[0] === "orders" && parts[1] ? parts[1] : null;
  }, [pathname]);

  const visibleTabs = useMemo(() => tabs.filter((item) => user && item.roles.includes(user.role)), [user]);
  const currentTab = useMemo(() => tabs.find((item) => item.id === section) ?? tabs[0], [section]);
  const unreadNotifications = useMemo(
    () => data.notifications.filter((item) => !item.read_at).length,
    [data.notifications],
  );

  const loadMe = useCallback(async () => {
    const payload = await apiFetch<{ user: SessionUser | null }>("/api/auth/me");
    setUser((current) => sameSessionUser(current, payload.user) ? current : payload.user);
    return payload.user;
  }, []);

  const loadDataForUser = useCallback(async (currentUser: SessionUser) => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.status) params.set("status", filters.status);
    if (filters.type) params.set("type", filters.type);
    if (filters.technicianId) params.set("technicianId", filters.technicianId);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);

    const canManageOps = ["admin", "dispatcher"].includes(currentUser.role);
    const canBackOffice = ["admin", "dispatcher", "accountant"].includes(currentUser.role);
    const today = todayInVietnam();

    const [dashboard, orders, notifications, technicians, customers, report, users] = await Promise.all([
      apiFetch<{ metrics: AppData["metrics"] }>("/api/dashboard"),
      apiFetch<{ workOrders: AppData["orders"] }>(`/api/work-orders?${params.toString()}`),
      apiFetch<{ notifications: AppData["notifications"] }>("/api/notifications"),
      canManageOps ? apiFetch<{ technicians: Technician[] }>("/api/technicians") : Promise.resolve(null),
      canBackOffice ? apiFetch<{ customers: Customer[] }>("/api/customers") : Promise.resolve(null),
      canBackOffice ? apiFetch<ReportData>(`/api/reports?from=${today}&to=${today}`) : Promise.resolve(null),
      currentUser.role === "admin" ? apiFetch<{ users: AppUser[] }>("/api/users") : Promise.resolve(null),
    ]);

    setData({
      metrics: dashboard.metrics,
      orders: orders.workOrders,
      notifications: notifications.notifications,
      technicians: technicians?.technicians ?? [],
      customers: customers?.customers ?? [],
      report,
      users: users?.users ?? [],
    });
  }, [filters.dateFrom, filters.dateTo, filters.q, filters.status, filters.technicianId, filters.type]);

  const loadData = useCallback(async (nextUser?: SessionUser | null) => {
    const currentUser = nextUser ?? user;
    if (!currentUser) return;
    await loadDataForUser(currentUser);
  }, [loadDataForUser, user]);

  const loadDetail = useCallback(async (id: string) => {
    const payload = await apiFetch<WorkOrderDetail>(`/api/work-orders/${id}`);
    setDetail(payload);
    return payload;
  }, []);

  useEffect(() => {
    let active = true;
    async function boot() {
      try {
        await loadMe();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Không thể tải dữ liệu");
      } finally {
        if (active) setLoading(false);
      }
    }
    boot();
    return () => {
      active = false;
    };
  }, [loadMe]);

  useEffect(() => {
    if (!loading && user) {
      loadDataForUser(user).catch((reason) => setError(reason instanceof Error ? reason.message : "Không tải được dữ liệu"));
    }
  }, [filters, loadDataForUser, loading, user]);

  useEffect(() => {
    const nextFilters = filtersFromSearchParams(searchParams);
    setFilters((current) => sameFilters(current, nextFilters) ? current : nextFilters);
  }, [searchParams]);

  useEffect(() => {
    if (user?.role !== "technician") return;
    const currentSegment = pathname.split("/").filter(Boolean)[0];
    if (!currentSegment || currentSegment === "dashboard") router.replace("/technician");
  }, [pathname, router, user]);

  useEffect(() => {
    if (!user) return;
    const allowed = tabs.some((item) => item.id === section && item.roles.includes(user.role));
    if (!allowed) router.replace(user.role === "technician" ? "/technician" : "/dashboard");
  }, [router, section, user]);

  useEffect(() => {
    if (!routedOrderId || !user) {
      if (modal?.type === "order-detail" || modal?.type === "order-edit") {
        setModal(null);
        setDetail(null);
      }
      return;
    }

    loadDetail(routedOrderId)
      .then(() => {
        setModal({ type: searchParams.get("mode") === "edit" ? "order-edit" : "order-detail", id: routedOrderId });
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Không tải được chi tiết phiếu"));
  }, [loadDetail, modal?.type, routedOrderId, searchParams, user]);

  async function openOrder(id: string, type: "order-detail" | "order-edit" = "order-detail") {
    router.push(`/orders/${id}${type === "order-edit" ? "?mode=edit" : ""}`);
  }

  async function openDispatchModal(id: string, type: "dispatch-detail" | "dispatch-assignment") {
    try {
      setError(null);
      setDetail(null);
      await loadDetail(id);
      setModal({ type, id });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không tải được chi tiết phiếu");
    }
  }

  async function openPaymentModal(id: string, type: "payment-detail" | "payment-action") {
    try {
      setError(null);
      setDetail(null);
      await loadDetail(id);
      setModal({ type, id });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không tải được chi tiết thanh toán");
    }
  }

  async function afterMutation() {
    await loadData();
    if (detail) await loadDetail(detail.workOrder.id);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    try {
      const payload = await apiFetch<{ user: SessionUser }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          identifier: formData.get("identifier"),
          password: formData.get("password"),
        }),
      });
      setUser(payload.user);
      router.push(payload.user.role === "technician" ? "/technician" : "/dashboard");
      await loadData(payload.user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Đăng nhập thất bại");
    }
  }

  async function handleLogout() {
    setError(null);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      setData(emptyData);
      setDetail(null);
      setModal(null);
      router.push("/dashboard");
    }
  }

  async function handleCreateOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const customerId = String(formData.get("customerId") || "");
    await apiFetch("/api/work-orders", {
      method: "POST",
      body: JSON.stringify({
        customerId: customerId || undefined,
        customer: customerId
          ? undefined
          : {
              name: formData.get("customerName"),
              phone: formData.get("customerPhone"),
              address: formData.get("customerAddress"),
              addressNote: formData.get("addressNote") || null,
            },
        type: formData.get("type"),
        priority: formData.get("priority"),
        description: formData.get("description"),
        appointmentAt: formData.get("appointmentAt") ? new Date(String(formData.get("appointmentAt"))).toISOString() : null,
        internalNote: formData.get("internalNote") || null,
        technicianId: formData.get("technicianId") || null,
      }),
    });
    event.currentTarget.reset();
    await loadData();
  }

  async function handleCreateCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await apiFetch("/api/customers", {
      method: "POST",
      body: JSON.stringify({
        name: formData.get("name"),
        phone: formData.get("phone"),
        address: formData.get("address"),
        addressNote: formData.get("addressNote") || null,
      }),
    });
    event.currentTarget.reset();
    await loadData();
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const role = formData.get("role") as Role;
    await apiFetch("/api/users", {
      method: "POST",
      body: JSON.stringify({
        fullName: formData.get("fullName"),
        email: formData.get("email") || null,
        phone: formData.get("phone") || null,
        password: formData.get("password"),
        role,
        technician: role === "technician" ? { serviceArea: formData.get("serviceArea") || null, status: "available" } : undefined,
      }),
    });
    event.currentTarget.reset();
    await loadData();
  }

  async function submitWorkOrderPatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    const formData = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = {};
    if (formData.has("description")) payload.description = formData.get("description") || undefined;
    if (formData.has("appointmentAt")) {
      payload.appointmentAt = formData.get("appointmentAt") ? new Date(String(formData.get("appointmentAt"))).toISOString() : null;
    }
    if (formData.has("completionNote")) payload.completionNote = formData.get("completionNote") || null;
    if (formData.has("internalNote")) payload.internalNote = formData.get("internalNote") || null;
    if (formData.has("laborCost")) payload.laborCost = formData.get("laborCost");
    if (formData.has("vatRate")) payload.vatRate = formData.get("vatRate");
    await apiFetch(`/api/work-orders/${detail.workOrder.id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    await afterMutation();
  }

  async function deleteResource(path: string) {
    await apiFetch(path, { method: "DELETE" });
    setModal(null);
    setDetail(null);
    await loadData();
  }

  function updateOrderFilters(nextFilters: Filters) {
    const params = new URLSearchParams();
    if (nextFilters.q) params.set("q", nextFilters.q);
    if (nextFilters.status) params.set("status", nextFilters.status);
    if (nextFilters.type) params.set("type", nextFilters.type);
    if (nextFilters.technicianId) params.set("technicianId", nextFilters.technicianId);
    if (nextFilters.dateFrom) params.set("dateFrom", nextFilters.dateFrom);
    if (nextFilters.dateTo) params.set("dateTo", nextFilters.dateTo);
    router.push(`/orders${params.toString() ? `?${params.toString()}` : ""}`);
  }

  function closeOrderModal() {
    setModal(null);
    setDetail(null);
    if (routedOrderId) router.push("/orders");
  }

  function closeInlineModal() {
    setModal(null);
    setDetail(null);
  }

  async function submitAssignment(event: FormEvent<HTMLFormElement>, closeAfterSubmit = false) {
    event.preventDefault();
    if (!detail) return;
    const formData = new FormData(event.currentTarget);
    await apiFetch(`/api/work-orders/${detail.workOrder.id}/assign`, {
      method: "POST",
      body: JSON.stringify({
        technicianId: formData.get("technicianId"),
        note: formData.get("note") || null,
      }),
    });
    await afterMutation();
    if (closeAfterSubmit) closeInlineModal();
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>, closeAfterSubmit = false) {
    event.preventDefault();
    if (!detail) return;
    const formData = new FormData(event.currentTarget);
    await apiFetch(`/api/work-orders/${detail.workOrder.id}/payment`, {
      method: "PATCH",
      body: JSON.stringify({
        status: formData.get("status"),
        method: formData.get("method") || null,
        transactionRef: formData.get("transactionRef") || null,
        debtDueDate: formData.get("debtDueDate") || null,
        note: formData.get("note") || null,
      }),
    });
    await afterMutation();
    if (closeAfterSubmit) closeInlineModal();
  }

  if (loading) return <div className="grid min-h-screen place-items-center bg-zinc-100 text-zinc-700">Đang tải...</div>;

  if (!user) return <AuthScreen error={error} onLogin={handleLogin} />;

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
          <button onClick={handleLogout} className="btn-secondary mt-3 h-10 w-full" type="button"><LogOut size={16} />Thoát</button>
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
            <button onClick={handleLogout} className="btn-secondary h-10" type="button"><LogOut size={16} />Thoát</button>
          </div>
        </header>

        <section className="content-surface">
          {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          {section === "dashboard" ? <DashboardScreen metrics={data.metrics} orders={data.orders} onOpenOrders={(status) => updateOrderFilters({ ...defaultFilters, status })} /> : null}
          {section === "orders" ? (
            <OrdersScreen
              filters={filters}
              customers={data.customers}
              technicians={data.technicians}
              orders={data.orders}
              canCreate={["admin", "dispatcher"].includes(user.role)}
              onFilter={updateOrderFilters}
              onCreate={handleCreateOrder}
              onView={(id) => openOrder(id)}
              onEdit={(id) => openOrder(id, "order-edit")}
              onCancel={(item) => setModal({ type: "order-cancel", item })}
            />
          ) : null}
          {section === "customers" ? (
            <CustomersScreen
              customers={data.customers}
              onCreate={handleCreateCustomer}
              onView={(item) => setModal({ type: "customer-detail", item })}
              onEdit={(item) => setModal({ type: "customer-edit", item })}
              onDelete={(item) => setModal({ type: "customer-delete", item })}
            />
          ) : null}
          {section === "dispatch" ? (
            <DispatchScreen
              orders={data.orders}
              technicians={data.technicians}
              onView={(id) => openDispatchModal(id, "dispatch-detail")}
              onAssign={(id) => openDispatchModal(id, "dispatch-assignment")}
            />
          ) : null}
          {section === "technician" ? <TechnicianScreen orders={data.orders} onView={(id) => openOrder(id)} /> : null}
          {section === "technicians" ? <TechniciansScreen technicians={data.technicians} onEdit={(item) => setModal({ type: "technician-edit", item })} onDelete={(item) => setModal({ type: "technician-delete", item })} /> : null}
          {section === "payments" ? (
            <PaymentsScreen
              orders={data.orders}
              onView={(id) => openPaymentModal(id, "payment-detail")}
              onPayment={(id) => openPaymentModal(id, "payment-action")}
            />
          ) : null}
          {section === "reports" ? <ReportsScreen report={data.report} onSubmit={async (event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            const from = String(formData.get("from"));
            const to = String(formData.get("to") || from);
            const report = await apiFetch<ReportData>(`/api/reports?from=${from}&to=${to}`);
            setData((current) => ({ ...current, report }));
          }} /> : null}
          {section === "notifications" ? <NotificationsScreen notifications={data.notifications} onOpen={(id) => openOrder(id)} onRead={async (id) => { await apiFetch(`/api/notifications/${id}`, { method: "PATCH", body: JSON.stringify({ read: true }) }); await loadData(); }} /> : null}
          {section === "users" ? <UsersScreen users={data.users} onCreate={handleCreateUser} onEdit={(item) => setModal({ type: "user-edit", item })} onDelete={(item) => setModal({ type: "user-delete", item })} /> : null}
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

      {detail && modal?.type === "order-detail" ? (
        <WorkOrderDetailModal
          detail={detail}
          technicians={data.technicians}
          onClose={closeOrderModal}
        />
      ) : null}

      {detail && modal?.type === "order-edit" ? (
        <WorkOrderEditModal
          detail={detail}
          role={user.role}
          technicians={data.technicians}
          onClose={closeOrderModal}
          onStatus={async (status, checkIn) => { await apiFetch(`/api/work-orders/${detail.workOrder.id}/status`, { method: "POST", body: JSON.stringify({ status, ...checkIn }) }); await afterMutation(); }}
          onCancel={async (event) => { event.preventDefault(); const formData = new FormData(event.currentTarget); await apiFetch(`/api/work-orders/${detail.workOrder.id}/status`, { method: "POST", body: JSON.stringify({ status: "cancelled", note: formData.get("note") }) }); await afterMutation(); }}
          onAssign={(event) => submitAssignment(event)}
          onUpdate={submitWorkOrderPatch}
          onMaterialCreate={async (event) => { event.preventDefault(); const formData = new FormData(event.currentTarget); await apiFetch(`/api/work-orders/${detail.workOrder.id}/materials`, { method: "POST", body: JSON.stringify({ name: formData.get("name"), quantity: formData.get("quantity"), unitPrice: formData.get("unitPrice") }) }); event.currentTarget.reset(); await afterMutation(); }}
          onMaterialUpdate={async (material, event) => { event.preventDefault(); const formData = new FormData(event.currentTarget); await apiFetch(`/api/work-orders/${detail.workOrder.id}/materials/${material.id}`, { method: "PATCH", body: JSON.stringify({ name: formData.get("name"), quantity: formData.get("quantity"), unitPrice: formData.get("unitPrice") }) }); await afterMutation(); }}
          onMaterialDelete={async (material) => { await apiFetch(`/api/work-orders/${detail.workOrder.id}/materials/${material.id}`, { method: "DELETE" }); await afterMutation(); }}
          onUpload={async (event) => { event.preventDefault(); const formData = new FormData(event.currentTarget); await apiFetch(`/api/work-orders/${detail.workOrder.id}/files`, { method: "POST", body: formData }); event.currentTarget.reset(); await afterMutation(); }}
          onFileDelete={async (file) => { await apiFetch(`/api/work-orders/${detail.workOrder.id}/files/${file.id}`, { method: "DELETE" }); await afterMutation(); }}
          onPayment={(event) => submitPayment(event)}
          onAcceptance={async (payload) => { await apiFetch(`/api/work-orders/${detail.workOrder.id}/acceptance`, { method: "POST", body: JSON.stringify({ ...payload, agreed: true }) }); await afterMutation(); }}
        />
      ) : null}
      {detail && modal?.type === "dispatch-detail" ? (
        <DispatchDetailModal detail={detail} technicians={data.technicians} onClose={closeInlineModal} />
      ) : null}
      {detail && modal?.type === "dispatch-assignment" ? (
        <DispatchAssignmentModal
          detail={detail}
          technicians={data.technicians}
          onClose={closeInlineModal}
          onSubmit={(event) => submitAssignment(event, true)}
        />
      ) : null}
      {detail && modal?.type === "payment-detail" ? (
        <PaymentDetailModal detail={detail} onClose={closeInlineModal} />
      ) : null}
      {detail && modal?.type === "payment-action" ? (
        <PaymentActionModal detail={detail} onClose={closeInlineModal} onSubmit={(event) => submitPayment(event, true)} />
      ) : null}
      {modal?.type === "order-cancel" ? (
        <Modal title="Hủy phiếu" size="sm" onClose={() => setModal(null)}>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              await apiFetch(`/api/work-orders/${modal.item.id}/status`, {
                method: "POST",
                body: JSON.stringify({ status: "cancelled", note: formData.get("note") }),
              });
              setModal(null);
              await loadData();
              router.push("/orders");
            }}
            className="grid gap-3"
          >
            <p className="text-sm leading-6 text-zinc-600">Hủy phiếu {modal.item.code}. Lý do sẽ được lưu vào lịch sử trạng thái.</p>
            <input name="note" className="input" placeholder="Lý do hủy phiếu" required />
            <div className="flex justify-end gap-2">
              <button className="btn-secondary h-10" onClick={() => setModal(null)} type="button">Đóng</button>
              <button className="btn-danger h-10" type="submit">Hủy phiếu</button>
            </div>
          </form>
        </Modal>
      ) : null}
      {modal?.type === "customer-edit" ? <CustomerEditModal item={modal.item} onClose={() => setModal(null)} onSubmit={async (event) => { event.preventDefault(); const formData = new FormData(event.currentTarget); await apiFetch(`/api/customers/${modal.item.id}`, { method: "PATCH", body: JSON.stringify({ name: formData.get("name"), phone: formData.get("phone"), address: formData.get("address"), addressNote: formData.get("addressNote") || null }) }); setModal(null); await loadData(); }} /> : null}
      {modal?.type === "customer-detail" ? <CustomerDetailModal item={modal.item} orders={data.orders} onClose={() => setModal(null)} /> : null}
      {modal?.type === "customer-delete" ? <ConfirmModal title="Xóa khách hàng" body={`Xóa khách hàng ${modal.item.name}? Nếu đã có phiếu, hệ thống sẽ từ chối.`} onCancel={() => setModal(null)} onConfirm={() => deleteResource(`/api/customers/${modal.item.id}`)} /> : null}
      {modal?.type === "user-edit" ? <UserEditModal item={modal.item} onClose={() => setModal(null)} onSubmit={async (event) => { event.preventDefault(); const formData = new FormData(event.currentTarget); await apiFetch(`/api/users/${modal.item.id}`, { method: "PATCH", body: JSON.stringify({ fullName: formData.get("fullName"), email: formData.get("email") || null, phone: formData.get("phone") || null, role: formData.get("role"), status: formData.get("status") }) }); setModal(null); await loadData(); }} /> : null}
      {modal?.type === "user-delete" ? <ConfirmModal title="Ngưng nhân viên" body={`Chuyển ${modal.item.full_name} sang trạng thái ngưng hoạt động?`} confirmLabel="Ngưng" onCancel={() => setModal(null)} onConfirm={() => deleteResource(`/api/users/${modal.item.id}`)} /> : null}
      {modal?.type === "technician-edit" ? <TechnicianEditModal item={modal.item} onClose={() => setModal(null)} onSubmit={async (event) => { event.preventDefault(); const formData = new FormData(event.currentTarget); await apiFetch(`/api/technicians/${modal.item.id}`, { method: "PATCH", body: JSON.stringify({ serviceArea: formData.get("serviceArea") || null, status: formData.get("status") }) }); setModal(null); await loadData(); }} /> : null}
      {modal?.type === "technician-delete" ? <ConfirmModal title="Xóa kỹ thuật viên" body={`Xóa hồ sơ kỹ thuật viên ${modal.item.full_name}?`} onCancel={() => setModal(null)} onConfirm={() => deleteResource(`/api/technicians/${modal.item.id}`)} /> : null}
    </main>
  );
}
