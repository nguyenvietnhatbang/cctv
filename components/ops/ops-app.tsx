"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/components/ops/api";
import { AuthScreen } from "@/components/ops/auth-screen";
import { emptyData, tabs, type PendingAction, type TabId } from "@/components/ops/app-config";
import {
  customerContactsFromFormData,
  filtersFromSearchParams,
  orderMatchesFilters,
  prependById,
  sameFilters,
  sameSessionUser,
} from "@/components/ops/app-utils";
import { monthStartInVietnam, todayInVietnam } from "@/components/ops/format";
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
import { OpsScreenSwitcher, preloadOpsScreen } from "@/components/ops/ops-screen-switcher";
import { OpsShell } from "@/components/ops/ops-shell";
import { LoadingScreen } from "@/components/ops/ui";
import { usePwaPush } from "@/components/ops/use-pwa-push";
import { BACK_OFFICE_ROLES, isOpsManagerRole } from "@/lib/types";

const ORDER_BACKED_SECTIONS = new Set<TabId>(["dashboard", "orders", "customers", "dispatch", "technician", "payments"]);
const CUSTOMER_BACKED_SECTIONS = new Set<TabId>(["orders", "customers", "dispatch"]);
const TECHNICIAN_BACKED_SECTIONS = new Set<TabId>(["orders", "dispatch", "technicians"]);
const REPORT_SECTIONS = new Set<TabId>(["reports"]);

function isSafeInternalPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\");
}

function needsCustomers(section: TabId, role: Role) {
  return BACK_OFFICE_ROLES.includes(role) && CUSTOMER_BACKED_SECTIONS.has(section);
}

function needsTechnicians(section: TabId, role: Role) {
  return isOpsManagerRole(role) && TECHNICIAN_BACKED_SECTIONS.has(section);
}

function needsUsers(section: TabId, role: Role) {
  return role === "admin" && section === "users";
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
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const detailsCacheRef = useRef<Record<string, WorkOrderDetail>>({});
  const detailRequestsRef = useRef<Record<string, Promise<WorkOrderDetail>>>({});
  const ordersCacheRef = useRef<Record<string, WorkOrderListItem[]>>({});
  const notificationSnapshotRef = useRef<string | null>(null);
  const lastReadSnapshotRef = useRef<string | null>(null);
  const resourcesLoadedRef = useRef({ customers: false, technicians: false, users: false });
  const dashboardLoadedRef = useRef(false);
  const skipNextNotificationsRefreshRef = useRef(false);
  const initialLoadedRef = useRef<boolean>(false);
  const prefetchedSectionsRef = useRef<Set<TabId>>(new Set());
  const prefetchingDataRef = useRef<Set<string>>(new Set());

  const section = useMemo<TabId>(() => {
    const segment = pathname.split("/").filter(Boolean)[0] as TabId | undefined;
    if (segment && tabs.some((item) => item.id === segment)) return segment;
    return "dashboard";
  }, [pathname]);

  const routedOrderId = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    if (parts[0] === "orders" && parts[1]) return parts[1];
    if (parts[0] === "notifications") return searchParams.get("order");
    return null;
  }, [pathname, searchParams]);

  const visibleTabs = useMemo(() => tabs.filter((item) => user && item.roles.includes(user.role)), [user]);
  const currentTab = useMemo(() => tabs.find((item) => item.id === section) ?? tabs[0], [section]);
  const unreadNotifications = useMemo(
    () => data.notifications.filter((item) => !item.read_at).length,
    [data.notifications],
  );
  const userRole = user?.role;

  const loadMe = useCallback(async () => {
    const payload = await apiFetch<{ user: SessionUser | null }>("/api/auth/me");
    setUser((current) => sameSessionUser(current, payload.user) ? current : payload.user);
    return payload.user;
  }, []);

  const workOrderQueryString = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.scope !== "open") params.set("scope", filters.scope);
    if (filters.status) params.set("status", filters.status);
    if (filters.type) params.set("type", filters.type);
    if (filters.customerId) params.set("customerId", filters.customerId);
    if (filters.technicianId) params.set("technicianId", filters.technicianId);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);

    return params.toString();
  }, [filters.customerId, filters.dateFrom, filters.dateTo, filters.q, filters.scope, filters.status, filters.technicianId, filters.type]);

  const workOrderListRequest = useCallback((targetSection = section) => {
    const params = new URLSearchParams(targetSection === "dispatch" ? "" : workOrderQueryString());
    if (targetSection === "technician") params.set("view", "technician");
    const queryString = params.toString();

    return {
      key: targetSection === "dispatch" ? "__dispatch_all__" : queryString,
      url: queryString ? `/api/work-orders?${queryString}` : "/api/work-orders",
    };
  }, [section, workOrderQueryString]);

  const loadDetail = useCallback(async (id: string) => {
    const cached = detailsCacheRef.current[id];
    if (cached) {
      setDetail(cached);
      return cached;
    }

    const pendingRequest = detailRequestsRef.current[id];
    if (pendingRequest) return pendingRequest;

    const request = apiFetch<WorkOrderDetail>(`/api/work-orders/${id}`)
      .then((payload) => {
        detailsCacheRef.current[id] = payload;
        setDetail(payload);
        return payload;
      })
      .finally(() => {
        delete detailRequestsRef.current[id];
      });
    detailRequestsRef.current[id] = request;
    return request;
  }, []);

  const refreshDashboard = useCallback(async () => {
    const payload = await apiFetch<{ metrics: AppData["metrics"] }>("/api/dashboard");
    setData((current) => ({ ...current, metrics: payload.metrics }));
    dashboardLoadedRef.current = true;
    return payload.metrics;
  }, []);

  const refreshOrders = useCallback(async (targetSection = section) => {
    const request = workOrderListRequest(targetSection);
    const payload = await apiFetch<{ workOrders: AppData["orders"] }>(request.url);
    setData((current) => ({ ...current, orders: payload.workOrders }));
    ordersCacheRef.current[request.key] = payload.workOrders;
    return payload.workOrders;
  }, [section, workOrderListRequest]);

  const refreshNotifications = useCallback(async () => {
    const latestCreatedAt = data.notifications[0]?.created_at;
    const overlapCursor = latestCreatedAt
      ? new Date(new Date(latestCreatedAt).getTime() - 5_000).toISOString()
      : null;
    const payload = await apiFetch<{
      notifications: AppData["notifications"];
      snapshotAt: string;
    }>(overlapCursor ? `/api/notifications?after=${encodeURIComponent(overlapCursor)}` : "/api/notifications");

    notificationSnapshotRef.current = payload.snapshotAt;
    setData((current) => {
      const merged = new Map(current.notifications.map((item) => [item.id, item]));
      payload.notifications.forEach((item) => merged.set(item.id, item));
      return {
        ...current,
        notifications: [...merged.values()]
          .sort((left, right) => right.created_at.localeCompare(left.created_at))
          .slice(0, 60),
      };
    });
    return payload.notifications;
  }, [data.notifications]);

  const markNotificationsRead = useCallback(async (readBefore: string) => {
    await apiFetch("/api/notifications", {
      method: "PATCH",
      body: JSON.stringify({ readBefore }),
    });
    if ("clearAppBadge" in navigator) {
      await navigator.clearAppBadge().catch(() => undefined);
    }
    setData((current) => ({
      ...current,
      notifications: current.notifications.map((item) => (
        !item.read_at && item.created_at <= readBefore
          ? { ...item, read_at: readBefore }
          : item
      )),
    }));
  }, []);

  const pwaPush = usePwaPush({
    enabled: Boolean(user),
    onPushReceived: () => {
      preloadOpsScreen("notifications");
      refreshNotifications().catch((reason) => {
        setError(reason instanceof Error ? reason.message : "Không tải được thông báo mới");
      });
    },
    onNotificationOpen: (url) => {
      if (!isSafeInternalPath(url)) return;
      preloadOpsScreen("notifications");
      router.push(url);
    },
  });

  const refreshTechnicians = useCallback(async () => {
    const payload = await apiFetch<{ technicians: Technician[] }>("/api/technicians");
    setData((current) => ({ ...current, technicians: payload.technicians }));
    resourcesLoadedRef.current.technicians = true;
    return payload.technicians;
  }, []);

  const refreshCustomers = useCallback(async () => {
    const payload = await apiFetch<{ customers: Customer[] }>("/api/customers");
    setData((current) => ({ ...current, customers: payload.customers }));
    resourcesLoadedRef.current.customers = true;
    return payload.customers;
  }, []);

  const refreshDefaultReport = useCallback(async () => {
    const today = todayInVietnam();
    const monthStart = monthStartInVietnam();
    setReportLoading(true);
    try {
      const report = await apiFetch<ReportData>(`/api/reports?from=${monthStart}&to=${today}`);
      setData((current) => ({ ...current, report }));
      return report;
    } finally {
      setReportLoading(false);
    }
  }, []);

  const refreshOpenDetail = useCallback(async () => {
    const currentId = detail?.workOrder.id;
    if (!currentId) return null;
    return loadDetail(currentId);
  }, [detail?.workOrder.id, loadDetail]);

  const refreshOrderContext = useCallback(async () => {
    const canManageOps = userRole ? isOpsManagerRole(userRole) : false;
    const needsDashboardRefresh = userRole !== "technician";
    await Promise.all([
      refreshOrders(),
      needsDashboardRefresh ? refreshDashboard() : Promise.resolve(null),
      canManageOps ? refreshTechnicians() : Promise.resolve(null),
      refreshOpenDetail(),
    ]);
  }, [refreshDashboard, refreshOpenDetail, refreshOrders, refreshTechnicians, userRole]);

  const loadDataForUser = useCallback(async (currentUser: SessionUser) => {
    const isNotificationsEntry = section === "notifications";
    const dataSection = currentUser.role === "technician" && !isNotificationsEntry
      ? "technician"
      : section;
    const ordersRequest = workOrderListRequest(dataSection);
    const shouldLoadOrders = ORDER_BACKED_SECTIONS.has(dataSection);
    const shouldLoadDashboard = currentUser.role !== "technician" && !isNotificationsEntry;
    const shouldLoadTechnicians = needsTechnicians(dataSection, currentUser.role);
    const shouldLoadCustomers = needsCustomers(dataSection, currentUser.role);
    const shouldLoadUsers = needsUsers(dataSection, currentUser.role);

    const [dashboard, orders, notifications, technicians, customers, users] = await Promise.all([
      shouldLoadDashboard ? apiFetch<{ metrics: AppData["metrics"] }>("/api/dashboard") : Promise.resolve(null),
      shouldLoadOrders ? apiFetch<{ workOrders: AppData["orders"] }>(ordersRequest.url) : Promise.resolve(null),
      apiFetch<{ notifications: AppData["notifications"]; snapshotAt: string }>("/api/notifications"),
      shouldLoadTechnicians ? apiFetch<{ technicians: Technician[] }>("/api/technicians") : Promise.resolve(null),
      shouldLoadCustomers ? apiFetch<{ customers: Customer[] }>("/api/customers") : Promise.resolve(null),
      shouldLoadUsers ? apiFetch<{ users: AppUser[] }>("/api/users") : Promise.resolve(null),
    ]);

    setData({
      metrics: dashboard?.metrics ?? emptyData.metrics,
      orders: orders?.workOrders ?? [],
      notifications: notifications.notifications,
      technicians: technicians?.technicians ?? [],
      customers: customers?.customers ?? [],
      report: null,
      users: users?.users ?? [],
    });

    if (orders) ordersCacheRef.current[ordersRequest.key] = orders.workOrders;
    dashboardLoadedRef.current = Boolean(dashboard);
    notificationSnapshotRef.current = notifications.snapshotAt;
    lastReadSnapshotRef.current = null;
    skipNextNotificationsRefreshRef.current = section === "notifications";
    resourcesLoadedRef.current = {
      customers: Boolean(customers),
      technicians: Boolean(technicians),
      users: Boolean(users),
    };
    initialLoadedRef.current = true;
  }, [section, workOrderListRequest]);

  const loadData = useCallback(async (nextUser?: SessionUser | null) => {
    const currentUser = nextUser ?? user;
    if (!currentUser) return;
    try {
      await loadDataForUser(currentUser);
    } catch (reason) {
      throw reason;
    }
  }, [loadDataForUser, user]);

  const prefetchDataOnce = useCallback((key: string, callback: () => Promise<void>) => {
    if (prefetchingDataRef.current.has(key)) return;
    prefetchingDataRef.current.add(key);
    callback().finally(() => {
      prefetchingDataRef.current.delete(key);
    });
  }, []);

  const prefetchSection = useCallback((targetSection: TabId) => {
    router.prefetch(`/${targetSection}`);
    preloadOpsScreen(targetSection);

    if (!user || !initialLoadedRef.current) return;

    if (ORDER_BACKED_SECTIONS.has(targetSection)) {
      const request = workOrderListRequest(targetSection);
      if (!ordersCacheRef.current[request.key]) {
        prefetchDataOnce(`orders:${request.key}`, async () => {
          const payload = await apiFetch<{ workOrders: AppData["orders"] }>(request.url);
          ordersCacheRef.current[request.key] = payload.workOrders;
        });
      }
    }

    if (needsCustomers(targetSection, user.role) && !resourcesLoadedRef.current.customers) {
      prefetchDataOnce("customers", async () => {
        const payload = await apiFetch<{ customers: Customer[] }>("/api/customers");
        resourcesLoadedRef.current.customers = true;
        setData((current) => ({ ...current, customers: payload.customers }));
      });
    }

    if (needsTechnicians(targetSection, user.role) && !resourcesLoadedRef.current.technicians) {
      prefetchDataOnce("technicians", async () => {
        const payload = await apiFetch<{ technicians: Technician[] }>("/api/technicians");
        resourcesLoadedRef.current.technicians = true;
        setData((current) => ({ ...current, technicians: payload.technicians }));
      });
    }

    if (needsUsers(targetSection, user.role) && !resourcesLoadedRef.current.users) {
      prefetchDataOnce("users", async () => {
        const payload = await apiFetch<{ users: AppUser[] }>("/api/users");
        resourcesLoadedRef.current.users = true;
        setData((current) => ({ ...current, users: payload.users }));
      });
    }

    const canViewReports = BACK_OFFICE_ROLES.includes(user.role) && user.role !== "team_lead";
    if (REPORT_SECTIONS.has(targetSection) && canViewReports && !data.report && !reportLoading) {
      prefetchDataOnce("report:default", async () => {
        await refreshDefaultReport();
      });
    }
  }, [data.report, prefetchDataOnce, refreshDefaultReport, reportLoading, router, user, workOrderListRequest]);

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
      if (!initialLoadedRef.current) {
        loadDataForUser(user).catch((reason) => {
          setError(reason instanceof Error ? reason.message : "Không tải được dữ liệu");
        });
      } else if (ORDER_BACKED_SECTIONS.has(section)) {
        const request = workOrderListRequest();
        const cached = ordersCacheRef.current[request.key];
        if (cached) {
          setData((current) => ({ ...current, orders: cached }));
        }
        refreshOrders().catch((reason) => {
          setError(reason instanceof Error ? reason.message : "Không tải được danh sách phiếu");
        });
      }
    }
  }, [filters, loading, section, user, loadDataForUser, refreshOrders, workOrderListRequest]);

  useEffect(() => {
    if (loading || !user || !initialLoadedRef.current) return;

    const preloadVisibleRoutes = () => {
      visibleTabs.forEach((tab) => {
        if (prefetchedSectionsRef.current.has(tab.id)) return;
        prefetchedSectionsRef.current.add(tab.id);
        router.prefetch(`/${tab.id}`);
        preloadOpsScreen(tab.id);
      });
    };

    if (typeof window === "undefined") {
      preloadVisibleRoutes();
      return;
    }

    const requestIdleCallback = window.requestIdleCallback ?? ((callback: IdleRequestCallback) => window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 0 }), 800));
    const cancelIdleCallback = window.cancelIdleCallback ?? window.clearTimeout;
    const idleId = requestIdleCallback(preloadVisibleRoutes, { timeout: 1800 });

    return () => cancelIdleCallback(idleId);
  }, [loading, router, user, visibleTabs]);

  useEffect(() => {
    if (loading || !user || !initialLoadedRef.current) return;

    const refreshIfVisible = () => {
      if (document.visibilityState !== "visible") return;
      refreshNotifications().catch((reason) => {
        setError(reason instanceof Error ? reason.message : "Không tải được thông báo mới");
      });
    };
    const intervalId = window.setInterval(refreshIfVisible, 60_000);
    document.addEventListener("visibilitychange", refreshIfVisible);
    window.addEventListener("online", refreshIfVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshIfVisible);
      window.removeEventListener("online", refreshIfVisible);
    };
  }, [loading, refreshNotifications, user]);

  useEffect(() => {
    if (section !== "notifications" || !user) return;
    const snapshotAt = notificationSnapshotRef.current;
    if (!snapshotAt || lastReadSnapshotRef.current === snapshotAt) return;
    lastReadSnapshotRef.current = snapshotAt;

    markNotificationsRead(snapshotAt).catch((reason) => {
      lastReadSnapshotRef.current = null;
      setError(reason instanceof Error ? reason.message : "Không thể đánh dấu thông báo đã đọc");
    });
  }, [data.notifications, markNotificationsRead, section, user]);

  useEffect(() => {
    if (section !== "notifications" || loading || !user || !initialLoadedRef.current) return;
    if (skipNextNotificationsRefreshRef.current) {
      skipNextNotificationsRefreshRef.current = false;
      return;
    }
    refreshNotifications().catch((reason) => {
      setError(reason instanceof Error ? reason.message : "Không tải được thông báo mới");
    });
    // Chỉ tải ngay khi người dùng chuyển vào màn hình Thông báo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  useEffect(() => {
    if (loading || !user || !initialLoadedRef.current) return;
    const resources = resourcesLoadedRef.current;

    if (section === "dashboard" && user.role !== "technician" && !dashboardLoadedRef.current) {
      refreshDashboard().catch((reason) => {
        setError(reason instanceof Error ? reason.message : "Không tải được tổng quan");
      });
    }

    if (needsCustomers(section, user.role) && !resources.customers) {
      refreshCustomers().catch((reason) => {
        setError(reason instanceof Error ? reason.message : "Không tải được khách hàng");
      });
    }

    if (needsTechnicians(section, user.role) && !resources.technicians) {
      refreshTechnicians().catch((reason) => {
        setError(reason instanceof Error ? reason.message : "Không tải được kỹ thuật viên");
      });
    }

    if (needsUsers(section, user.role) && !resources.users) {
      apiFetch<{ users: AppUser[] }>("/api/users")
        .then((payload) => {
          resourcesLoadedRef.current.users = true;
          setData((current) => ({ ...current, users: payload.users }));
        })
        .catch((reason) => {
          setError(reason instanceof Error ? reason.message : "Không tải được nhân viên");
        });
    }
  }, [loading, refreshCustomers, refreshDashboard, refreshTechnicians, section, user]);

  useEffect(() => {
    const canViewReports = userRole ? BACK_OFFICE_ROLES.includes(userRole) && userRole !== "team_lead" : false;
    if (loading || !canViewReports || section !== "reports" || data.report || reportLoading) return;
    refreshDefaultReport().catch((reason) => {
      setError(reason instanceof Error ? reason.message : "Không tải được báo cáo");
    });
  }, [data.report, loading, refreshDefaultReport, reportLoading, section, userRole]);

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
    const type = user.role === "technician"
      ? "technician-job"
      : searchParams.get("mode") === "edit"
        ? "order-edit"
        : "order-detail";
    setModal({ type, id: routedOrderId });

    const cached = detailsCacheRef.current[routedOrderId];
    if (cached) {
      setDetail(cached);
    } else {
      const item = data.orders.find((o) => o.id === routedOrderId);
      if (item) {
        setDetail({
          workOrder: {
            ...item,
            assigned_technicians: item.assigned_technicians ?? [],
            internal_note: null,
            completion_note: null,
            acceptance_name: null,
            acceptance_phone: null,
            accepted_at: null,
            payment_method: null,
            payment_note: null,
            labor_amount: item.labor_cost ?? "0",
            material_amount: "0",
            vat_amount: "0",
            paid_amount: item.paid_amount ?? "0",
            debt_amount: item.debt_amount ?? "0",
            transaction_ref: null,
            debt_due_date: null,
            customer_lat: item.customer_lat,
            customer_lng: item.customer_lng,
          },
          history: [],
          materials: [],
          files: [],
          paymentTransactions: [],
        });
      }
    }

    loadDetail(routedOrderId).catch((reason) =>
      setError(reason instanceof Error ? reason.message : "Không tải được chi tiết phiếu")
    );
  }, [loadDetail, routedOrderId, searchParams, user, data.orders]);

  const modalType = modal?.type;
  useEffect(() => {
    if (!routedOrderId && (modalType === "order-detail" || modalType === "order-edit" || modalType === "technician-job")) {
      setModal(null);
      setDetail(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routedOrderId]);

  function getFallbackDetail(id: string): WorkOrderDetail | null {
    const item = data.orders.find((o) => o.id === id);
    if (!item) return null;
    return {
      workOrder: {
        ...item,
        assigned_technicians: item.assigned_technicians ?? [],
        internal_note: null,
        completion_note: null,
        acceptance_name: null,
        acceptance_phone: null,
        accepted_at: null,
        payment_method: null,
        payment_note: null,
        labor_amount: item.labor_cost ?? "0",
        material_amount: "0",
        vat_amount: "0",
        paid_amount: item.paid_amount ?? "0",
        debt_amount: item.debt_amount ?? "0",
        transaction_ref: null,
        debt_due_date: null,
        customer_lat: item.customer_lat,
        customer_lng: item.customer_lng,
      },
      history: [],
      materials: [],
      files: [],
      paymentTransactions: [],
    };
  }

  async function openOrder(id: string, type: "order-detail" | "order-edit" | "technician-job" = "order-detail") {
    try {
      setError(null);
      setModal({ type, id });

      const cached = detailsCacheRef.current[id];
      if (cached) {
        setDetail(cached);
      } else {
        setDetail(getFallbackDetail(id));
      }

      await loadDetail(id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không tải được chi tiết phiếu");
    }
  }

  async function openDispatchModal(id: string, type: "dispatch-detail" | "dispatch-assignment") {
    try {
      setError(null);
      setModal({ type, id });

      const cached = detailsCacheRef.current[id];
      if (cached) {
        setDetail(cached);
      } else {
        setDetail(getFallbackDetail(id));
      }

      await loadDetail(id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không tải được chi tiết phiếu");
    }
  }

  async function openPaymentModal(id: string, type: "payment-detail" | "payment-action") {
    try {
      setError(null);
      setModal({ type, id });

      const cached = detailsCacheRef.current[id];
      if (cached) {
        setDetail(cached);
      } else {
        setDetail(getFallbackDetail(id));
      }

      await loadDetail(id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không tải được chi tiết thanh toán");
    }
  }

  async function afterMutation() {
    ordersCacheRef.current = {};
    detailsCacheRef.current = {};
    setData((current) => ({ ...current, report: null }));
    await Promise.all([
      refreshOrderContext(),
      refreshNotifications(),
    ]);
  }

  async function activateAvailableServiceWorkerUpdate() {
    if (!("serviceWorker" in navigator)) return false;

    const registration = await navigator.serviceWorker.getRegistration("/");
    if (!registration) return false;

    let shouldReload = false;
    const reloadOnce = () => {
      if (shouldReload) return;
      shouldReload = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", reloadOnce, { once: true });
    await registration.update();

    if (registration.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
      window.setTimeout(reloadOnce, 900);
      return true;
    }

    navigator.serviceWorker.removeEventListener("controllerchange", reloadOnce);
    return false;
  }

  async function handleManualRefresh() {
    if (manualRefreshing) return;

    setManualRefreshing(true);
    setError(null);
    try {
      const waitingForReload = await activateAvailableServiceWorkerUpdate();
      if (waitingForReload) return;

      const currentUser = await loadMe();
      if (!currentUser) return;

      const tasks: Promise<unknown>[] = [refreshNotifications()];
      const shouldRefreshOrders = ORDER_BACKED_SECTIONS.has(section)
        || section === "notifications"
        || currentUser.role === "technician";

      if (shouldRefreshOrders) {
        ordersCacheRef.current = {};
        tasks.push(refreshOrders(currentUser.role === "technician" ? "technician" : section));
      }
      if (currentUser.role !== "technician" && (section === "dashboard" || ORDER_BACKED_SECTIONS.has(section))) {
        tasks.push(refreshDashboard());
      }
      if (needsCustomers(section, currentUser.role)) tasks.push(refreshCustomers());
      if (needsTechnicians(section, currentUser.role)) tasks.push(refreshTechnicians());
      if (section === "reports" && currentUser.role !== "team_lead" && BACK_OFFICE_ROLES.includes(currentUser.role)) {
        tasks.push(refreshDefaultReport());
      }
      tasks.push(refreshOpenDetail());

      await Promise.all(tasks);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể làm mới dữ liệu");
    } finally {
      setManualRefreshing(false);
    }
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
      initialLoadedRef.current = false;
      dashboardLoadedRef.current = false;
      skipNextNotificationsRefreshRef.current = false;
      resourcesLoadedRef.current = { customers: false, technicians: false, users: false };
      ordersCacheRef.current = {};
      detailsCacheRef.current = {};
      detailRequestsRef.current = {};
      await loadData(payload.user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Đăng nhập thất bại");
    }
  }

  async function handleLogout() {
    setError(null);
    try {
      if (pwaPush.subscription?.endpoint) {
        try {
          await apiFetch("/api/push-subscriptions", {
            method: "DELETE",
            body: JSON.stringify({ endpoint: pwaPush.subscription.endpoint }),
          });
        } catch (error) {
          console.error("Không thể hủy liên kết thông báo trên server:", error);
        }
      }
      await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      setData(emptyData);
      setDetail(null);
      setModal(null);
      initialLoadedRef.current = false;
      dashboardLoadedRef.current = false;
      skipNextNotificationsRefreshRef.current = false;
      resourcesLoadedRef.current = { customers: false, technicians: false, users: false };
      ordersCacheRef.current = {};
      detailsCacheRef.current = {};
      detailRequestsRef.current = {};
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
    const requestDocuments = formData
      .getAll("requestDocuments")
      .filter((file): file is File => file instanceof File && file.size > 0);
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
          technicianIds: formData.getAll("technicianIds").map(String).filter(Boolean),
        }),
      });

      for (const file of requestDocuments) {
        const uploadData = new FormData();
        uploadData.set("purpose", "request_document");
        uploadData.set("file", file);
        await apiFetch(`/api/work-orders/${payload.workOrder.id}/files`, {
          method: "POST",
          body: uploadData,
        });
      }

      setData((current) => ({
        ...current,
        orders: orderMatchesFilters(payload.workOrder, filters)
          ? prependById(current.orders, payload.workOrder)
          : current.orders,
        customers: payload.customer ? prependById(current.customers, payload.customer) : current.customers,
      }));
      form.reset();
      void refreshDashboard();
      if (user && isOpsManagerRole(user.role)) void refreshTechnicians();
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
          contacts: customerContactsFromFormData(formData),
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
          technician: (role === "technician" || role === "team_lead") ? { serviceArea: formData.get("serviceArea") || null, status: "available" } : undefined,
        }),
      });
      setData((current) => ({ ...current, users: prependById(current.users, payload.user) }));
      form.reset();
      if (role === "technician" || role === "team_lead") void refreshTechnicians();
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
    if (formData.has("materialCost")) payload.materialCost = formData.get("materialCost");
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
    if (nextFilters.scope !== "open") params.set("scope", nextFilters.scope);
    if (nextFilters.status) params.set("status", nextFilters.status);
    if (nextFilters.type) params.set("type", nextFilters.type);
    if (nextFilters.customerId) params.set("customerId", nextFilters.customerId);
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
    if (routedOrderId) {
      router.push(section === "notifications" ? "/notifications" : "/orders");
    }
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
        technicianIds: formData.getAll("technicianIds").map(String).filter(Boolean),
        note: formData.get("note") || null,
      }),
    });
    await afterMutation();
    if (closeAfterSubmit) closeInlineModal();
  }

  async function updateTechnicianStatus(id: string, status: WorkOrderListItem["status"], payload?: { checkInLat?: number; checkInLng?: number; updateCustomerLocation?: boolean; note?: string | null }) {
    try {
      setError(null);
      await apiFetch(`/api/work-orders/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status, ...payload }),
      });
      setData((current) => {
        const nextOrders = current.orders.map((o) => {
          if (o.id === id) {
            return {
              ...o,
              status,
              check_in_lat: payload?.checkInLat ?? o.check_in_lat,
              check_in_lng: payload?.checkInLng ?? o.check_in_lng,
              customer_lat: payload?.updateCustomerLocation && payload?.checkInLat ? String(payload.checkInLat) : o.customer_lat,
              customer_lng: payload?.updateCustomerLocation && payload?.checkInLng ? String(payload.checkInLng) : o.customer_lng,
            };
          }
          return o;
        });
        return { ...current, orders: nextOrders };
      });
      void afterMutation();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không cập nhật được trạng thái phiếu";
      setError(message);
      throw error;
    }
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>, closeAfterSubmit = false) {
    event.preventDefault();
    if (!detail) return;
    const formData = new FormData(event.currentTarget);
    const billFile = formData.get("billFile");
    await apiFetch(`/api/work-orders/${detail.workOrder.id}/payment`, {
      method: "PATCH",
      body: JSON.stringify({
        status: formData.get("status"),
        method: formData.get("method") || null,
        amount: formData.get("amount") || null,
        debtDueDate: formData.get("debtDueDate") || null,
        note: formData.get("note") || null,
      }),
    });
    if (billFile instanceof File && billFile.size > 0) {
      const uploadData = new FormData();
      uploadData.set("purpose", "bill");
      uploadData.set("file", billFile);
      await apiFetch(`/api/work-orders/${detail.workOrder.id}/files`, {
        method: "POST",
        body: uploadData,
      });
    }
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
      refreshing={manualRefreshing}
      onRefresh={handleManualRefresh}
      onLogout={handleLogout}
      onChangePassword={() => setModal({ type: "own-password" })}
      onNavigateIntent={prefetchSection}
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
          onCreateCustomer={handleCreateCustomer}
          onCreateUser={handleCreateUser}
        />
      )}
    >
      <OpsScreenSwitcher
        section={section}
        role={user.role}
        data={data}
        filters={filters}
        reportLoading={reportLoading}
        pendingAction={pendingAction}
        onFilter={updateOrderFilters}
        onCreateOrder={handleCreateOrder}
        onCreateCustomer={handleCreateCustomer}
        onCreateUser={handleCreateUser}
        onOpenOrder={(id) => openOrder(id, user.role === "technician" ? "technician-job" : "order-detail")}
        onEditOrder={(id) => openOrder(id, user.role === "technician" ? "technician-job" : "order-edit")}
        onTechnicianStatus={updateTechnicianStatus}
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
          setReportLoading(true);
          try {
            const report = await apiFetch<ReportData>(`/api/reports?from=${from}&to=${to}`);
            setData((current) => ({ ...current, report }));
          } finally {
            setReportLoading(false);
          }
        }}
        onOpenNotification={(id) => router.push(`/notifications?order=${encodeURIComponent(id)}`)}
        pwaPush={pwaPush}
        onEditUser={(item) => setModal({ type: "user-edit", item })}
        onDeleteUser={(item) => setModal({ type: "user-delete", item })}
        onViewUserAssignmentHistory={(item) => setModal({ type: "user-assignment-history", item })}
        onResetUserPassword={(item) => setModal({ type: "user-reset-password", item })}
        onOpenCreateModal={(type) => setModal({ type: type === "user" ? "user-create" : "customer-create" })}
      />
    </OpsShell>
  );
}
