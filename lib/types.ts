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
export const FILE_PURPOSES = ["initial", "before", "after", "signature", "bill"] as const;

export type Role = (typeof ROLES)[number];
export type UserStatus = (typeof USER_STATUSES)[number];
export type TechnicianStatus = (typeof TECHNICIAN_STATUSES)[number];
export type WorkOrderType = (typeof WORK_ORDER_TYPES)[number];
export type WorkOrderPriority = (typeof WORK_ORDER_PRIORITIES)[number];
export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type FilePurpose = (typeof FILE_PURPOSES)[number];

export const FILE_PURPOSE_LABELS: Record<FilePurpose, string> = {
  initial: "Ảnh hiện trạng",
  before: "Ảnh trước xử lý",
  after: "Ảnh sau xử lý",
  signature: "Chữ ký nghiệm thu",
  bill: "Ảnh bill",
};

export function filePurposeLabel(value: string) {
  return FILE_PURPOSE_LABELS[value as FilePurpose] ?? value;
}

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
  completed: "Đã nghiệm thu",
  awaiting_payment: "Chờ thu tiền",
  paid: "Đã thu tiền",
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

export const WORK_ORDER_STATUS_DESCRIPTIONS: Record<WorkOrderStatus, string> = {
  pending_assignment: "Phiếu đã tạo, chưa có kỹ thuật viên phụ trách.",
  assigned: "Điều phối đã gán kỹ thuật viên, đang chờ kỹ thuật nhận việc.",
  accepted: "Kỹ thuật viên đã nhận việc và chuẩn bị di chuyển.",
  traveling: "Kỹ thuật viên đang di chuyển tới địa điểm khách hàng.",
  working: "Kỹ thuật viên đã check-in và đang xử lý tại hiện trường.",
  awaiting_acceptance: "Kỹ thuật viên đã xử lý xong, đang chờ khách nghiệm thu.",
  completed: "Khách đã nghiệm thu, phần kỹ thuật đã hoàn thành, cần chốt thu tiền hoặc công nợ.",
  awaiting_payment: "Phiếu đã bàn giao sang bước thu tiền, chưa xác nhận thanh toán.",
  paid: "Phiếu đã được xác nhận thu tiền.",
  debt: "Phiếu đang được theo dõi công nợ.",
  cancelled: "Phiếu đã bị hủy.",
};

export const WORK_ORDER_STATUS_ORDER: Record<WorkOrderStatus, number> = {
  pending_assignment: 10,
  assigned: 20,
  accepted: 30,
  traveling: 40,
  working: 50,
  awaiting_acceptance: 60,
  completed: 70,
  awaiting_payment: 80,
  paid: 90,
  debt: 90,
  cancelled: 99,
};

export type WorkOrderTransition = {
  status: WorkOrderStatus;
  label: string;
  roles: Role[];
  intent: "assign" | "field" | "acceptance" | "payment" | "cancel";
};

export const WORK_ORDER_TRANSITIONS: Partial<Record<WorkOrderStatus, WorkOrderTransition[]>> = {
  pending_assignment: [
    { status: "assigned", label: "Phân công", roles: ["admin", "dispatcher"], intent: "assign" },
    { status: "cancelled", label: "Hủy phiếu", roles: ["admin", "dispatcher"], intent: "cancel" },
  ],
  assigned: [
    { status: "accepted", label: "Nhận việc", roles: ["technician"], intent: "field" },
    { status: "pending_assignment", label: "Bỏ phân công", roles: ["admin", "dispatcher"], intent: "assign" },
    { status: "cancelled", label: "Hủy phiếu", roles: ["admin", "dispatcher"], intent: "cancel" },
  ],
  accepted: [
    { status: "traveling", label: "Đang di chuyển", roles: ["technician"], intent: "field" },
    { status: "cancelled", label: "Hủy phiếu", roles: ["admin", "dispatcher"], intent: "cancel" },
  ],
  traveling: [
    { status: "working", label: "Check-in", roles: ["technician"], intent: "field" },
    { status: "cancelled", label: "Hủy phiếu", roles: ["admin", "dispatcher"], intent: "cancel" },
  ],
  working: [
    { status: "awaiting_acceptance", label: "Hoàn tất xử lý", roles: ["technician"], intent: "field" },
    { status: "cancelled", label: "Hủy phiếu", roles: ["admin", "dispatcher"], intent: "cancel" },
  ],
  awaiting_acceptance: [
    { status: "completed", label: "Khách nghiệm thu", roles: ["admin", "dispatcher", "technician"], intent: "acceptance" },
    { status: "working", label: "Làm lại", roles: ["admin", "dispatcher", "technician"], intent: "field" },
    { status: "cancelled", label: "Hủy phiếu", roles: ["admin", "dispatcher"], intent: "cancel" },
  ],
  completed: [
    { status: "awaiting_payment", label: "Chờ thu tiền", roles: ["admin", "dispatcher", "accountant"], intent: "payment" },
    { status: "paid", label: "Đã thu tiền", roles: ["admin", "dispatcher", "accountant"], intent: "payment" },
    { status: "debt", label: "Ghi công nợ", roles: ["admin", "dispatcher", "accountant"], intent: "payment" },
  ],
  awaiting_payment: [
    { status: "paid", label: "Đã thu tiền", roles: ["admin", "dispatcher", "accountant"], intent: "payment" },
    { status: "debt", label: "Ghi công nợ", roles: ["admin", "dispatcher", "accountant"], intent: "payment" },
  ],
  debt: [
    { status: "paid", label: "Thu công nợ", roles: ["admin", "dispatcher", "accountant"], intent: "payment" },
  ],
};

export function getAllowedWorkOrderTransitions(status: WorkOrderStatus, role: Role) {
  return (WORK_ORDER_TRANSITIONS[status] ?? []).filter((transition) => transition.roles.includes(role));
}

export function canTransitionWorkOrderStatus(from: WorkOrderStatus, to: WorkOrderStatus, role: Role) {
  if (from === to) return true;
  return getAllowedWorkOrderTransitions(from, role).some((transition) => transition.status === to);
}

export const NEXT_STATUS_ACTIONS: Partial<Record<WorkOrderStatus, { status: WorkOrderStatus; label: string; roles: Role[] }>> = {
  assigned: { status: "accepted", label: "Nhận việc", roles: ["technician"] },
  accepted: { status: "traveling", label: "Đang di chuyển", roles: ["technician"] },
  traveling: { status: "working", label: "Check-in", roles: ["technician"] },
  working: { status: "awaiting_acceptance", label: "Hoàn tất xử lý", roles: ["technician"] },
  completed: { status: "awaiting_payment", label: "Bàn giao thu tiền", roles: ["dispatcher", "accountant", "admin"] },
};

export type WorkOrderStage = "intake" | "dispatch" | "field" | "acceptance" | "payment" | "closed" | "cancelled";

export const WORK_ORDER_STAGE_LABELS: Record<WorkOrderStage, string> = {
  intake: "Tiếp nhận",
  dispatch: "Phân công",
  field: "Hiện trường",
  acceptance: "Nghiệm thu",
  payment: "Thu tiền",
  closed: "Đóng phiếu",
  cancelled: "Đã hủy",
};

export const WORK_ORDER_STAGE_DESCRIPTIONS: Record<WorkOrderStage, string> = {
  intake: "Phiếu mới tạo, cần phân công kỹ thuật viên.",
  dispatch: "Đã có người phụ trách, đang chờ kỹ thuật nhận việc.",
  field: "Kỹ thuật viên đang thực hiện các bước ngoài hiện trường.",
  acceptance: "Đã xử lý xong hoặc đã được khách nghiệm thu.",
  payment: "Đang xử lý thu tiền, chuyển khoản hoặc công nợ.",
  closed: "Đã thu tiền và đóng phiếu.",
  cancelled: "Phiếu đã hủy, không còn bước xử lý tiếp theo.",
};

export const WORK_ORDER_STAGE_TONE: Record<WorkOrderStage, string> = {
  intake: "bg-amber-50 text-amber-800 ring-amber-200",
  dispatch: "bg-blue-50 text-blue-800 ring-blue-200",
  field: "bg-cyan-50 text-cyan-800 ring-cyan-200",
  acceptance: "bg-violet-50 text-violet-800 ring-violet-200",
  payment: "bg-rose-50 text-rose-800 ring-rose-200",
  closed: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  cancelled: "bg-zinc-100 text-zinc-700 ring-zinc-200",
};

export const WORK_ORDER_STAGE_ORDER: readonly WorkOrderStage[] = [
  "intake",
  "dispatch",
  "field",
  "acceptance",
  "payment",
  "closed",
];

export function getWorkOrderStage(status: WorkOrderStatus): WorkOrderStage {
  if (status === "cancelled") return "cancelled";
  if (status === "pending_assignment") return "intake";
  if (status === "assigned") return "dispatch";
  if (["accepted", "traveling", "working"].includes(status)) return "field";
  if (["awaiting_acceptance", "completed"].includes(status)) return "acceptance";
  if (["awaiting_payment", "debt"].includes(status)) return "payment";
  return "closed";
}

export type DisplayStatus = "todo" | "doing" | "doing_overdue" | "done" | "done_overdue" | "cancelled";

export const DISPLAY_STATUS_LABELS: Record<DisplayStatus, string> = {
  todo: "Việc chưa làm",
  doing: "Đang làm",
  doing_overdue: "Đang làm quá hạn",
  done: "Hoàn thành",
  done_overdue: "Hoàn thành quá hạn",
  cancelled: "Đã hủy",
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

export function getWorkOrderDeadlineLabel(order: {
  status: string;
  appointment_at: string | null;
  updated_at?: string;
}) {
  const displayStatus = getDisplayStatus(order);
  if (displayStatus === "doing_overdue") return "Quá hạn";
  if (displayStatus === "done_overdue") return "Hoàn thành quá hạn";
  return null;
}
