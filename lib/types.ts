export const ROLES = ["admin", "dispatcher", "technician", "accountant"] as const;
export const USER_STATUSES = ["active", "inactive"] as const;
export const TECHNICIAN_STATUSES = ["available", "traveling", "working", "off"] as const;
export const WORK_ORDER_TYPES = ["warranty", "maintenance", "installation", "other"] as const;
export const WORK_ORDER_PRIORITIES = ["normal", "urgent"] as const;
export const WORK_ORDER_STATUSES = [
  "pending_assignment",
  "assigned",
  "accepted",
  "traveling",
  "working",
  "awaiting_acceptance",
  "completed",
  "awaiting_payment",
  "paid",
  "debt",
  "cancelled",
] as const;
export const PAYMENT_STATUSES = ["unpaid", "paid", "debt"] as const;
export const PAYMENT_METHODS = ["cash", "bank_transfer", "debt"] as const;
export const FILE_PURPOSES = ["initial", "before", "after", "signature"] as const;

export type Role = (typeof ROLES)[number];
export type UserStatus = (typeof USER_STATUSES)[number];
export type TechnicianStatus = (typeof TECHNICIAN_STATUSES)[number];
export type WorkOrderType = (typeof WORK_ORDER_TYPES)[number];
export type WorkOrderPriority = (typeof WORK_ORDER_PRIORITIES)[number];
export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type FilePurpose = (typeof FILE_PURPOSES)[number];

export type SessionUser = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: Role;
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  dispatcher: "Điều phối",
  technician: "Kỹ thuật",
  accountant: "Kế toán",
};

export const TECHNICIAN_STATUS_LABELS: Record<TechnicianStatus, string> = {
  available: "Rảnh",
  traveling: "Đang di chuyển",
  working: "Đang thi công",
  off: "Nghỉ",
};

export const WORK_ORDER_TYPE_LABELS: Record<WorkOrderType, string> = {
  warranty: "Bảo hành",
  maintenance: "Bảo trì",
  installation: "Lắp mới",
  other: "Khác",
};

export const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  pending_assignment: "Chờ phân công",
  assigned: "Đã phân công",
  accepted: "Đã nhận việc",
  traveling: "Đang di chuyển",
  working: "Đang thi công",
  awaiting_acceptance: "Chờ nghiệm thu",
  completed: "Hoàn thành",
  awaiting_payment: "Chờ thanh toán",
  paid: "Đã thanh toán",
  debt: "Công nợ",
  cancelled: "Hủy",
};

export const WORK_ORDER_STATUS_TONE: Record<WorkOrderStatus, string> = {
  pending_assignment: "bg-amber-50 text-amber-800 ring-amber-200",
  assigned: "bg-blue-50 text-blue-800 ring-blue-200",
  accepted: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  traveling: "bg-cyan-50 text-cyan-800 ring-cyan-200",
  working: "bg-orange-50 text-orange-800 ring-orange-200",
  awaiting_acceptance: "bg-violet-50 text-violet-800 ring-violet-200",
  completed: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  awaiting_payment: "bg-rose-50 text-rose-800 ring-rose-200",
  paid: "bg-green-50 text-green-800 ring-green-200",
  debt: "bg-red-50 text-red-800 ring-red-200",
  cancelled: "bg-zinc-100 text-zinc-700 ring-zinc-200",
};

export const NEXT_STATUS_ACTIONS: Partial<
  Record<WorkOrderStatus, { status: WorkOrderStatus; label: string; roles: Role[] }>
> = {
  assigned: { status: "accepted", label: "Nhận việc", roles: ["technician"] },
  accepted: { status: "traveling", label: "Đang di chuyển", roles: ["technician"] },
  traveling: { status: "working", label: "Check-in", roles: ["technician"] },
  working: {
    status: "awaiting_acceptance",
    label: "Hoàn tất xử lý",
    roles: ["technician"],
  },
  completed: {
    status: "awaiting_payment",
    label: "Chờ thanh toán",
    roles: ["dispatcher", "accountant", "admin"],
  },
};

export type DisplayStatus = "todo" | "doing" | "doing_overdue" | "done" | "done_overdue" | "cancelled";

export const DISPLAY_STATUS_LABELS: Record<DisplayStatus, string> = {
  todo: "Việc chưa làm",
  doing: "Đang làm",
  doing_overdue: "Đang làm quá hạn",
  done: "Hoàn thành",
  done_overdue: "Hoàn thành quá hạn",
  cancelled: "Hủy",
};

export const DISPLAY_STATUS_TONE: Record<DisplayStatus, string> = {
  todo: "bg-amber-50 text-amber-800 ring-amber-200",
  doing: "bg-blue-50 text-blue-800 ring-blue-200",
  doing_overdue: "bg-red-50 text-red-800 ring-red-200 animate-pulse",
  done: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  done_overdue: "bg-orange-50 text-orange-800 ring-orange-200",
  cancelled: "bg-zinc-100 text-zinc-700 ring-zinc-200",
};

export function getDisplayStatus(order: {
  status: string;
  appointment_at: string | null;
  updated_at?: string;
}): DisplayStatus {
  if (order.status === "cancelled") return "cancelled";

  const isFinished = ["completed", "awaiting_payment", "paid", "debt"].includes(order.status);
  const isDoing = ["working", "awaiting_acceptance"].includes(order.status);

  if (isFinished) {
    if (order.appointment_at && order.updated_at) {
      const appDate = new Date(order.appointment_at);
      const updDate = new Date(order.updated_at);
      if (updDate > appDate) {
        return "done_overdue";
      }
    }
    return "done";
  }

  if (isDoing) {
    if (order.appointment_at) {
      const appDate = new Date(order.appointment_at);
      if (new Date() > appDate) {
        return "doing_overdue";
      }
    }
    return "doing";
  }

  return "todo";
}

