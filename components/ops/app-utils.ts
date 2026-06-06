import type { Filters, SessionUser, WorkOrderListItem } from "@/components/ops/types";

export function filtersFromSearchParams(searchParams: { get: (key: string) => string | null }): Filters {
  return {
    q: searchParams.get("q") ?? "",
    status: searchParams.get("status") ?? "",
    type: searchParams.get("type") ?? "",
    technicianId: searchParams.get("technicianId") ?? "",
    dateFrom: searchParams.get("dateFrom") ?? "",
    dateTo: searchParams.get("dateTo") ?? "",
  };
}

export function sameFilters(left: Filters, right: Filters) {
  return left.q === right.q
    && left.status === right.status
    && left.type === right.type
    && left.technicianId === right.technicianId
    && left.dateFrom === right.dateFrom
    && left.dateTo === right.dateTo;
}

export function prependById<T extends { id: string }>(items: T[], item: T) {
  return [item, ...items.filter((current) => current.id !== item.id)];
}

export function replaceById<T extends { id: string }>(items: T[], item: T) {
  return items.map((current) => (current.id === item.id ? item : current));
}

export function removeById<T extends { id: string }>(items: T[], id: string) {
  return items.filter((current) => current.id !== id);
}

function dateInVietnam(value: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));
}

export function orderMatchesFilters(order: WorkOrderListItem, filters: Filters) {
  const q = filters.q.trim().toLowerCase();
  if (filters.status && order.status !== filters.status) return false;
  if (filters.type && order.type !== filters.type) return false;
  if (filters.technicianId && order.technician_id !== filters.technicianId) return false;
  if (filters.dateFrom && dateInVietnam(order.created_at) < filters.dateFrom) return false;
  if (filters.dateTo && dateInVietnam(order.created_at) > filters.dateTo) return false;
  if (!q) return true;

  return [order.code, order.customer_name, order.customer_phone, order.customer_address]
    .some((value) => value.toLowerCase().includes(q));
}

export function sameSessionUser(left: SessionUser | null, right: SessionUser | null) {
  return left?.id === right?.id
    && left?.fullName === right?.fullName
    && left?.email === right?.email
    && left?.phone === right?.phone
    && left?.role === right?.role;
}
