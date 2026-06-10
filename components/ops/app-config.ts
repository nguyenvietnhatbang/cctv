import {
  Bell,
  ClipboardList,
  CreditCard,
  History,
  LayoutDashboard,
  MapPinned,
  ReceiptText,
  UserCog,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { AppData, Filters, Role } from "@/components/ops/types";

export type TabId =
  | "dashboard"
  | "orders"
  | "customers"
  | "dispatch"
  | "assignment-history"
  | "technician"
  | "technicians"
  | "payments"
  | "reports"
  | "notifications"
  | "users";

export const tabs: ReadonlyArray<{ id: TabId; label: string; roles: readonly Role[] }> = [
  { id: "dashboard", label: "Tổng quan", roles: ["admin", "dispatcher", "accountant"] },
  { id: "orders", label: "Công việc", roles: ["admin", "dispatcher", "accountant"] },
  { id: "customers", label: "Khách hàng", roles: ["admin", "dispatcher", "accountant"] },
  { id: "dispatch", label: "Phân công", roles: ["admin", "dispatcher"] },
  { id: "technician", label: "Kỹ thuật", roles: ["dispatcher", "technician"] },
  { id: "assignment-history", label: "Lịch sử", roles: ["technician"] },
  { id: "technicians", label: "DS kỹ thuật", roles: ["admin", "dispatcher"] },
  { id: "payments", label: "Thanh toán", roles: ["admin", "dispatcher", "accountant"] },
  { id: "reports", label: "Báo cáo", roles: ["admin", "dispatcher", "accountant"] },
  { id: "notifications", label: "Thông báo", roles: ["admin", "dispatcher", "accountant", "technician"] },
  { id: "users", label: "Nhân viên", roles: ["admin"] },
];

export const tabIcons: Record<TabId, LucideIcon> = {
  dashboard: LayoutDashboard,
  orders: ClipboardList,
  customers: Users,
  dispatch: MapPinned,
  "assignment-history": History,
  technician: Wrench,
  technicians: UserCog,
  payments: CreditCard,
  reports: ReceiptText,
  notifications: Bell,
  users: Users,
};

export const emptyData: AppData = {
  metrics: null,
  orders: [],
  customers: [],
  technicians: [],
  users: [],
  notifications: [],
  report: null,
};

export const defaultFilters: Filters = {
  q: "",
  status: "",
  type: "",
  technicianId: "",
  dateFrom: "",
  dateTo: "",
};

export type PendingAction = "create-order" | "create-customer" | "create-user" | null;
