import type { CustomerContact, Filters, SessionUser, WorkOrderListItem } from "@/components/ops/types";
import { todayInVietnam } from "@/components/ops/format";
import { DISPLAY_STATUS_LABELS, getDisplayStatus } from "@/lib/types";

export function filtersFromSearchParams(searchParams: { get: (key: string) => string | null }): Filters {
  const scopeParam = searchParams.get("scope");
  return {
    q: searchParams.get("q") ?? "",
    scope: scopeParam === "this_month" || scopeParam === "today" || scopeParam === "all" ? scopeParam : "open",
    status: searchParams.get("status") ?? "",
    type: searchParams.get("type") ?? "",
    technicianId: searchParams.get("technicianId") ?? "",
    dateFrom: searchParams.get("dateFrom") ?? "",
    dateTo: searchParams.get("dateTo") ?? "",
  };
}

export function sameFilters(left: Filters, right: Filters) {
  return left.q === right.q
    && left.scope === right.scope
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

export function customerContactsFromFormData(formData: FormData) {
  const names = formData.getAll("contactName");
  const phones = formData.getAll("contactPhone");
  const notes = formData.getAll("contactNote");

  return names
    .map((name, index) => ({
      name: String(name).trim(),
      phone: String(phones[index] ?? "").trim(),
      note: String(notes[index] ?? "").trim() || null,
    }))
    .filter((contact) => contact.name && contact.phone);
}

export function displayCustomerContacts(customer: { name: string; phone: string; contacts?: CustomerContact[] }) {
  return customer.contacts?.length ? customer.contacts : [{
    id: "primary",
    customer_id: "",
    name: customer.name,
    phone: customer.phone,
    note: null,
    is_primary: true,
  }];
}

function dateInVietnam(value: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));
}

function orderAppointmentDate(order: WorkOrderListItem) {
  return order.appointment_at ? dateInVietnam(order.appointment_at) : null;
}

export function orderMatchesFilters(order: WorkOrderListItem, filters: Filters) {
  const q = filters.q.trim().toLowerCase();
  if (filters.status) {
    if (filters.status in DISPLAY_STATUS_LABELS) {
      if (getDisplayStatus(order) !== filters.status) return false;
    } else if (order.status !== filters.status) {
      return false;
    }
  }
  if (filters.type && order.type !== filters.type) return false;
  if (filters.technicianId && !(order.assigned_technicians ?? []).some((technician) => technician.id === filters.technicianId)) return false;
  const appointmentDate = orderAppointmentDate(order);
  if (filters.dateFrom && (!appointmentDate || appointmentDate < filters.dateFrom)) return false;
  if (filters.dateTo && (!appointmentDate || appointmentDate > filters.dateTo)) return false;
  if (!filters.status && !filters.dateFrom && !filters.dateTo) {
    if (filters.scope === "open" && ["paid", "cancelled"].includes(order.status)) return false;
    if (filters.scope === "today" && appointmentDate !== todayInVietnam()) return false;
    if (filters.scope === "this_month" && (!appointmentDate || !appointmentDate.startsWith(todayInVietnam().slice(0, 8)))) return false;
  }
  if (!q) return true;

  return [order.code, order.customer_name, order.customer_phone, order.customer_address, order.description, order.technician_name ?? ""]
    .some((value) => value.toLowerCase().includes(q));
}

export function mapSearchUrl({
  address,
  lat,
  lng,
}: {
  address: string;
  lat?: string | number | null;
  lng?: string | number | null;
}) {
  if (lat !== null && lat !== undefined && lng !== null && lng !== undefined) {
    return `https://maps.google.com/?q=${encodeURIComponent(`${lat},${lng}`)}`;
  }

  return `https://maps.google.com/?q=${encodeURIComponent(address)}`;
}

export function sameSessionUser(left: SessionUser | null, right: SessionUser | null) {
  return left?.id === right?.id
    && left?.fullName === right?.fullName
    && left?.email === right?.email
    && left?.phone === right?.phone
    && left?.role === right?.role;
}
