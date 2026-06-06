"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/components/ops/api";
import { AuthScreen } from "@/components/ops/auth-screen";
import { emptyData, tabs, type PendingAction, type TabId } from "@/components/ops/app-config";
import {
  filtersFromSearchParams,
  orderMatchesFilters,
  prependById,
  sameFilters,
  sameSessionUser,
} from "@/components/ops/app-utils";
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
  WorkOrderListItem,
} from "@/components/ops/types";
import { OpsModalLayer } from "@/components/ops/ops-modal-layer";
import { OpsScreenSwitcher } from "@/components/ops/ops-screen-switcher";
import { OpsShell } from "@/components/ops/ops-shell";
import { LoadingScreen } from "@/components/ops/ui";

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
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const loadedDataKeyRef = useRef<string | null>(null);

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

  const workOrderQueryString = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.status) params.set("status", filters.status);
    if (filters.type) params.set("type", filters.type);
    if (filters.technicianId) params.set("technicianId", filters.technicianId);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);

    return params.toString();
  }, [filters.dateFrom, filters.dateTo, filters.q, filters.status, filters.technicianId, filters.type]);

  const loadDetail = useCallback(async (id: string) => {
    const payload = await apiFetch<WorkOrderDetail>(`/api/work-orders/${id}`);
    setDetail(payload);
    return payload;
  }, []);

  const refreshDashboard = useCallback(async () => {
    const payload = await apiFetch<{ metrics: AppData["metrics"] }>("/api/dashboard");
    setData((current) => ({ ...current, metrics: payload.metrics }));
    return payload.metrics;
  }, []);

  const refreshOrders = useCallback(async () => {
    const payload = await apiFetch<{ workOrders: AppData["orders"] }>(`/api/work-orders?${workOrderQueryString()}`);
    setData((current) => ({ ...current, orders: payload.workOrders }));
    return payload.workOrders;
  }, [workOrderQueryString]);

  const refreshNotifications = useCallback(async () => {
    const payload = await apiFetch<{ notifications: AppData["notifications"] }>("/api/notifications");
    setData((current) => ({ ...current, notifications: payload.notifications }));
    return payload.notifications;
  }, []);

  const refreshTechnicians = useCallback(async () => {
    const payload = await apiFetch<{ technicians: Technician[] }>("/api/technicians");
    setData((current) => ({ ...current, technicians: payload.technicians }));
    return payload.technicians;
  }, []);

  const refreshCustomers = useCallback(async () => {
    const payload = await apiFetch<{ customers: Customer[] }>("/api/customers");
    setData((current) => ({ ...current, customers: payload.customers }));
    return payload.customers;
  }, []);

  const refreshOpenDetail = useCallback(async () => {
    const currentId = detail?.workOrder.id;
    if (!currentId) return null;
    return loadDetail(currentId);
  }, [detail?.workOrder.id, loadDetail]);

  const refreshOrderContext = useCallback(async () => {
    const canManageOps = ["admin", "dispatcher"].includes(user?.role ?? "");
    await Promise.all([
      refreshOrders(),
      refreshDashboard(),
      canManageOps ? refreshTechnicians() : Promise.resolve(null),
      refreshOpenDetail(),
    ]);
  }, [refreshDashboard, refreshOpenDetail, refreshOrders, refreshTechnicians, user?.role]);

  const loadDataForUser = useCallback(async (currentUser: SessionUser) => {
    const params = workOrderQueryString();
    const canManageOps = ["admin", "dispatcher"].includes(currentUser.role);
    const canBackOffice = ["admin", "dispatcher", "accountant"].includes(currentUser.role);
    const today = todayInVietnam();

    const [dashboard, orders, notifications, technicians, customers, report, users] = await Promise.all([
      apiFetch<{ metrics: AppData["metrics"] }>("/api/dashboard"),
      apiFetch<{ workOrders: AppData["orders"] }>(`/api/work-orders?${params}`),
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
  }, [workOrderQueryString]);

  const dataLoadKey = useCallback((currentUser: SessionUser) => {
    return `${currentUser.id}:${workOrderQueryString()}`;
  }, [workOrderQueryString]);

  const loadData = useCallback(async (nextUser?: SessionUser | null) => {
    const currentUser = nextUser ?? user;
    if (!currentUser) return;
    const key = dataLoadKey(currentUser);
    loadedDataKeyRef.current = key;
    try {
      await loadDataForUser(currentUser);
    } catch (reason) {
      if (loadedDataKeyRef.current === key) loadedDataKeyRef.current = null;
      throw reason;
    }
  }, [dataLoadKey, loadDataForUser, user]);

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
      const key = dataLoadKey(user);
      if (loadedDataKeyRef.current === key) return;
      loadedDataKeyRef.current = key;
      loadDataForUser(user).catch((reason) => {
        if (loadedDataKeyRef.current === key) loadedDataKeyRef.current = null;
        setError(reason instanceof Error ? reason.message : "Không tải được dữ liệu");
      });
    }
  }, [dataLoadKey, filters, loadDataForUser, loading, user]);

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
    if (!routedOrderId || !user) return;
    loadDetail(routedOrderId)
      .then(() => {
        setModal({ type: searchParams.get("mode") === "edit" ? "order-edit" : "order-detail", id: routedOrderId });
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Không tải được chi tiết phiếu"));
  }, [loadDetail, routedOrderId, searchParams, user]);

  useEffect(() => {
    if (routedOrderId || (modal?.type !== "order-detail" && modal?.type !== "order-edit")) return;
    setModal(null);
    setDetail(null);
  }, [modal?.type, routedOrderId]);

  async function openOrder(id: string, type: "order-detail" | "order-edit" = "order-detail") {
    try {
      setError(null);
      setDetail(null);
      await loadDetail(id);
      setModal({ type, id });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không tải được chi tiết phiếu");
    }
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
    await refreshOrderContext();
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
    setPendingAction("create-order");
    setError(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const customerId = String(formData.get("customerId") || "");
    try {
      const payload = await apiFetch<{ workOrder: WorkOrderListItem; customer?: Customer | null }>("/api/work-orders", {
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

      setData((current) => ({
        ...current,
        orders: orderMatchesFilters(payload.workOrder, filters)
          ? prependById(current.orders, payload.workOrder)
          : current.orders,
        customers: payload.customer ? prependById(current.customers, payload.customer) : current.customers,
      }));
      form.reset();
      void refreshDashboard();
      if (["admin", "dispatcher"].includes(user?.role ?? "")) void refreshTechnicians();
      if (!customerId && !payload.customer) void refreshCustomers();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không tạo được phiếu");
      throw reason;
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCreateCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("create-customer");
    setError(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    try {
      const payload = await apiFetch<{ customer: Customer }>("/api/customers", {
        method: "POST",
        body: JSON.stringify({
          name: formData.get("name"),
          phone: formData.get("phone"),
          address: formData.get("address"),
          addressNote: formData.get("addressNote") || null,
        }),
      });
      setData((current) => ({ ...current, customers: prependById(current.customers, payload.customer) }));
      form.reset();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không tạo được khách hàng");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("create-user");
    setError(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const role = formData.get("role") as Role;
    try {
      const payload = await apiFetch<{ user: AppUser }>("/api/users", {
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
      setData((current) => ({ ...current, users: prependById(current.users, payload.user) }));
      form.reset();
      if (role === "technician") void refreshTechnicians();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không tạo được nhân viên");
    } finally {
      setPendingAction(null);
    }
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

  function updateOrderFilters(nextFilters: Filters) {
    const params = new URLSearchParams();
    if (nextFilters.q) params.set("q", nextFilters.q);
    if (nextFilters.status) params.set("status", nextFilters.status);
    if (nextFilters.type) params.set("type", nextFilters.type);
    if (nextFilters.technicianId) params.set("technicianId", nextFilters.technicianId);
    if (nextFilters.dateFrom) params.set("dateFrom", nextFilters.dateFrom);
    if (nextFilters.dateTo) params.set("dateTo", nextFilters.dateTo);
    const nextUrl = `/orders${params.toString() ? `?${params.toString()}` : ""}`;
    if (section === "orders") {
      setFilters(nextFilters);
      window.history.replaceState(null, "", nextUrl);
      return;
    }
    router.push(nextUrl);
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

  if (loading) return <LoadingScreen />;

  if (!user) return <AuthScreen error={error} onLogin={handleLogin} />;

  return (
    <OpsShell
      user={user}
      section={section}
      currentTab={currentTab}
      visibleTabs={visibleTabs}
      unreadNotifications={unreadNotifications}
      error={error}
      onLogout={handleLogout}
      modals={(
        <OpsModalLayer
          modal={modal}
          setModal={setModal}
          detail={detail}
          setDetail={setDetail}
        data={data}
        setData={setData}
        setError={setError}
        role={user.role}
          closeOrderModal={closeOrderModal}
          closeInlineModal={closeInlineModal}
          afterMutation={afterMutation}
          refreshOrderContext={refreshOrderContext}
          refreshOrders={refreshOrders}
          refreshTechnicians={refreshTechnicians}
          submitAssignment={submitAssignment}
          submitPayment={submitPayment}
          submitWorkOrderPatch={submitWorkOrderPatch}
        />
      )}
    >
      <OpsScreenSwitcher
        section={section}
        role={user.role}
        data={data}
        filters={filters}
        pendingAction={pendingAction}
        onFilter={updateOrderFilters}
        onCreateOrder={handleCreateOrder}
        onCreateCustomer={handleCreateCustomer}
        onCreateUser={handleCreateUser}
        onOpenOrder={(id) => openOrder(id)}
        onEditOrder={(id) => openOrder(id, "order-edit")}
        onCancelOrder={(item) => setModal({ type: "order-cancel", item })}
        onViewCustomer={(item) => setModal({ type: "customer-detail", item })}
        onEditCustomer={(item) => setModal({ type: "customer-edit", item })}
        onDeleteCustomer={(item) => setModal({ type: "customer-delete", item })}
        onOpenDispatch={(id) => openDispatchModal(id, "dispatch-detail")}
        onAssignDispatch={(id) => openDispatchModal(id, "dispatch-assignment")}
        onEditTechnician={(item) => setModal({ type: "technician-edit", item })}
        onDeleteTechnician={(item) => setModal({ type: "technician-delete", item })}
        onOpenPayment={(id) => openPaymentModal(id, "payment-detail")}
        onPaymentAction={(id) => openPaymentModal(id, "payment-action")}
        onReportSubmit={async (event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const from = String(formData.get("from"));
          const to = String(formData.get("to") || from);
          const report = await apiFetch<ReportData>(`/api/reports?from=${from}&to=${to}`);
          setData((current) => ({ ...current, report }));
        }}
        onOpenNotification={(id) => openOrder(id)}
        onReadNotification={async (id) => {
          await apiFetch(`/api/notifications/${id}`, {
            method: "PATCH",
            body: JSON.stringify({ read: true }),
          });
          await refreshNotifications();
        }}
        onEditUser={(item) => setModal({ type: "user-edit", item })}
        onDeleteUser={(item) => setModal({ type: "user-delete", item })}
      />
    </OpsShell>
  );
}
