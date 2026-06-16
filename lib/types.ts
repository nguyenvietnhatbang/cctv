export const ROLES = ["admin", "dispatcher", "team_lead", "technician", "accountant"] as const;
export const USER_STATUSES = ["active", "inactive"] as const;
export const TECHNICIAN_STATUSES = ["available", "traveling", "working", "off"] as const;
export const WORK_ORDER_TYPES = ["installation", "add_on", "maintenance_repair", "relocation", "other"] as const;
export const LEGACY_WORK_ORDER_TYPES = ["warranty", "maintenance"] as const;
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
  "paused",
  "cancelled",
] as const;
export const PAYMENT_STATUSES = ["unpaid", "paid", "debt"] as const;
export const PAYMENT_METHODS = ["cash", "bank_transfer", "debt"] as const;
export const FILE_PURPOSES = ["initial", "before", "after", "signature", "bill", "request_document", "handover_document"] as const;

export type Role = (typeof ROLES)[number];
export type UserStatus = (typeof USER_STATUSES)[number];
export type TechnicianStatus = (typeof TECHNICIAN_STATUSES)[number];
export type WorkOrderType = (typeof WORK_ORDER_TYPES)[number] | (typeof LEGACY_WORK_ORDER_TYPES)[number];
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
  request_document: "Tài liệu tạo phiếu",
  handover_document: "Tài liệu bàn giao",
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
  team_lead: "Trưởng nhóm",
  technician: "Kỹ thuật",
  accountant: "Kế toán",
};

export const OPS_MANAGER_ROLES: Role[] = ["admin", "dispatcher", "team_lead"];
export const FIELD_ROLES: Role[] = ["technician", "team_lead"];
export const PAYMENT_MANAGER_ROLES: Role[] = ["admin", "dispatcher", "accountant"];
export const BACK_OFFICE_ROLES: Role[] = ["admin", "dispatcher", "team_lead", "accountant"];

export function isOpsManagerRole(role: Role) {
  return OPS_MANAGER_ROLES.includes(role);
}

export function isFieldRole(role: Role) {
  return FIELD_ROLES.includes(role);
}

export function isPaymentManagerRole(role: Role) {
  return PAYMENT_MANAGER_ROLES.includes(role);
}

export const TECHNICIAN_STATUS_LABELS: Record<TechnicianStatus, string> = {
  available: "Rảnh",
  traveling: "Đang di chuyển",
  working: "Đang thi công",
  off: "Nghỉ",
};

export const WORK_ORDER_TYPE_LABELS: Record<WorkOrderType, string> = {
  installation: "Lắp mới",
  add_on: "Lắp thêm",
  maintenance_repair: "Bảo trì, sửa chữa",
  relocation: "Di chuyển lắp lại",
  other: "Khác",
  warranty: "Bảo hành",
  maintenance: "Bảo trì",
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
  paused: "Tạm dừng",
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
  paused: "bg-slate-100 text-slate-700 ring-slate-300",
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
  paused: "Phiếu đang tạm dừng xử lý.",
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
  paused: 95,
  cancelled: 99,
};

export type WorkOrderTransition = {
  status: WorkOrderStatus;
  label: string;
  roles: Role[];
  intent: "assign" | "field" | "acceptance" | "payment" | "pause" | "cancel";
};

export const WORK_ORDER_TRANSITIONS: Partial<Record<WorkOrderStatus, WorkOrderTransition[]>> = {
  pending_assignment: [
    { status: "assigned", label: "Phân công", roles: OPS_MANAGER_ROLES, intent: "assign" },
    { status: "paused", label: "Tạm dừng", roles: OPS_MANAGER_ROLES, intent: "pause" },
    { status: "cancelled", label: "Hủy phiếu", roles: OPS_MANAGER_ROLES, intent: "cancel" },
  ],
  assigned: [
    { status: "accepted", label: "Nhận việc", roles: FIELD_ROLES, intent: "field" },
    { status: "pending_assignment", label: "Bỏ phân công", roles: OPS_MANAGER_ROLES, intent: "assign" },
    { status: "paused", label: "Tạm dừng", roles: OPS_MANAGER_ROLES, intent: "pause" },
    { status: "cancelled", label: "Hủy phiếu", roles: OPS_MANAGER_ROLES, intent: "cancel" },
  ],
  accepted: [
    { status: "traveling", label: "Đang di chuyển", roles: FIELD_ROLES, intent: "field" },
    { status: "paused", label: "Tạm dừng", roles: [...OPS_MANAGER_ROLES, "technician"], intent: "pause" },
    { status: "cancelled", label: "Hủy phiếu", roles: OPS_MANAGER_ROLES, intent: "cancel" },
  ],
  traveling: [
    { status: "working", label: "Check-in", roles: FIELD_ROLES, intent: "field" },
    { status: "paused", label: "Check-out", roles: [...OPS_MANAGER_ROLES, "technician"], intent: "pause" },
    { status: "cancelled", label: "Hủy phiếu", roles: OPS_MANAGER_ROLES, intent: "cancel" },
  ],
  working: [
    { status: "awaiting_acceptance", label: "Hoàn tất xử lý", roles: FIELD_ROLES, intent: "field" },
    { status: "paused", label: "Check-out", roles: [...OPS_MANAGER_ROLES, "technician"], intent: "pause" },
    { status: "cancelled", label: "Hủy phiếu", roles: OPS_MANAGER_ROLES, intent: "cancel" },
  ],
  awaiting_acceptance: [
    { status: "completed", label: "Khách nghiệm thu", roles: [...OPS_MANAGER_ROLES, "technician"], intent: "acceptance" },
    { status: "working", label: "Làm lại", roles: [...OPS_MANAGER_ROLES, "technician"], intent: "field" },
    { status: "paused", label: "Tạm dừng", roles: OPS_MANAGER_ROLES, intent: "pause" },
    { status: "cancelled", label: "Hủy phiếu", roles: OPS_MANAGER_ROLES, intent: "cancel" },
  ],
  paused: [
    { status: "working", label: "Tiếp tục xử lý", roles: [...OPS_MANAGER_ROLES, "technician"], intent: "field" },
    { status: "cancelled", label: "Hủy phiếu", roles: OPS_MANAGER_ROLES, intent: "cancel" },
  ],
  completed: [
    { status: "awaiting_payment", label: "Chờ thu tiền", roles: PAYMENT_MANAGER_ROLES, intent: "payment" },
    { status: "paid", label: "Đã thu tiền", roles: PAYMENT_MANAGER_ROLES, intent: "payment" },
    { status: "debt", label: "Ghi công nợ", roles: PAYMENT_MANAGER_ROLES, intent: "payment" },
  ],
  awaiting_payment: [
    { status: "paid", label: "Đã thu tiền", roles: PAYMENT_MANAGER_ROLES, intent: "payment" },
    { status: "debt", label: "Ghi công nợ", roles: PAYMENT_MANAGER_ROLES, intent: "payment" },
  ],
  debt: [
    { status: "paid", label: "Thu công nợ", roles: PAYMENT_MANAGER_ROLES, intent: "payment" },
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
  assigned: { status: "accepted", label: "Nhận việc", roles: FIELD_ROLES },
  accepted: { status: "traveling", label: "Đang di chuyển", roles: FIELD_ROLES },
  traveling: { status: "working", label: "Check-in", roles: FIELD_ROLES },
  working: { status: "awaiting_acceptance", label: "Hoàn tất xử lý", roles: FIELD_ROLES },
  completed: { status: "awaiting_payment", label: "Bàn giao thu tiền", roles: PAYMENT_MANAGER_ROLES },
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
  if (status === "paused") return "field";
  if (status === "pending_assignment") return "intake";
  if (status === "assigned") return "dispatch";
  if (["accepted", "traveling", "working"].includes(status)) return "field";
  if (["awaiting_acceptance", "completed"].includes(status)) return "acceptance";
  if (["awaiting_payment", "debt"].includes(status)) return "payment";
  return "closed";
}

export type DisplayStatus = "todo" | "doing" | "doing_overdue" | "done" | "done_overdue" | "paused" | "cancelled" | "other";

export const DISPLAY_STATUS_ORDER: readonly DisplayStatus[] = [
  "todo",
  "doing",
  "doing_overdue",
  "done",
  "done_overdue",
  "paused",
  "cancelled",
  "other",
];

export const DISPLAY_STATUS_LABELS: Record<DisplayStatus, string> = {
  todo: "Việc chưa làm",
  doing: "Đang làm",
  doing_overdue: "Đang làm quá hạn",
  done: "Hoàn thành",
  done_overdue: "Hoàn thành quá hạn",
  paused: "Việc tạm dừng",
  cancelled: "Đã hủy",
  other: "Khác",
};

export const DISPLAY_STATUS_TONE: Record<DisplayStatus, string> = {
  todo: "bg-amber-50 text-amber-800 ring-amber-200",
  doing: "bg-blue-50 text-blue-800 ring-blue-200",
  doing_overdue: "bg-red-50 text-red-800 ring-red-200 animate-pulse",
  done: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  done_overdue: "bg-orange-50 text-orange-800 ring-orange-200",
  paused: "bg-slate-100 text-slate-700 ring-slate-300",
  cancelled: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  other: "bg-zinc-50 text-zinc-600 ring-zinc-200",
};

export function getDisplayStatus(order: {
  status: string;
  appointment_at: string | null;
  updated_at?: string;
}): DisplayStatus {
  if (order.status === "paused") return "paused";
  if (order.status === "cancelled") return "cancelled";

  const isFinished = ["completed", "awaiting_payment", "paid", "debt"].includes(order.status);
  const isDoing = ["working", "awaiting_acceptance"].includes(order.status);
  const isTodo = ["pending_assignment", "assigned", "accepted", "traveling"].includes(order.status);

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

  if (isTodo) return "todo";

  return "other";
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
