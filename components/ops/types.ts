import type { DisplayStatus, Role, SessionUser, WorkOrderStatus, WorkOrderType } from "@/lib/types";

export type { Role, SessionUser, WorkOrderStatus, WorkOrderType };

export type Metrics = {
  total_today: string;
  todo: string;
  doing: string;
  doing_overdue: string;
  done: string;
  done_overdue: string;
  paused: string;
  cancelled: string;
  other: string;
  paid_today: string;
  open_debt: string;
};

export type WorkOrderListItem = {
  id: string;
  customer_id: string;
  code: string;
  type: WorkOrderType;
  priority: "normal" | "urgent";
  status: WorkOrderStatus;
  description: string;
  appointment_at: string | null;
  assigned_at?: string | null;
  created_at: string;
  updated_at?: string;
  labor_cost: string;
  vat_rate: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  customer_lat: string | null;
  customer_lng: string | null;
  technician_id: string | null;
  technician_name: string | null;
  assigned_technicians: AssignedTechnician[];
  total_amount: string;
  payment_status: string | null;
};

export type AssignedTechnician = {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  service_area: string | null;
  status: "available" | "traveling" | "working" | "off";
  assigned_at: string;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  address: string;
  address_note: string | null;
  lat: string | null;
  lng: string | null;
  location_pinned_at: string | null;
  location_pinned_by: string | null;
  created_at: string;
  contacts: CustomerContact[];
};

export type CustomerContact = {
  id: string;
  customer_id: string;
  name: string;
  phone: string;
  note: string | null;
  is_primary: boolean;
};

export type Technician = {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  service_area: string | null;
  status: "available" | "traveling" | "working" | "off";
  jobs_today: string;
};

export type AppUser = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  status: "active" | "inactive";
  technician_id: string | null;
  service_area: string | null;
  technician_status: string | null;
};

export type Material = {
  id: string;
  name: string;
  quantity: string;
  unit_price: string;
  line_total: string;
};

export type WorkFile = {
  id: string;
  original_name: string;
  purpose: string;
  mime_type?: string;
  signed_url: string | null;
};

export type AssignmentHistoryItem = {
  id: string;
  work_order_id: string;
  code: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  work_order_status: WorkOrderStatus;
  technician_id: string;
  technician_name: string;
  assigned_by_name: string | null;
  assigned_at: string;
  unassigned_at: string | null;
  note: string | null;
};

export type HistoryItem = {
  id: string;
  from_status: WorkOrderStatus | null;
  to_status: WorkOrderStatus;
  changed_by_name: string | null;
  changed_at: string;
  note: string | null;
};

export type WorkOrderDetail = {
  workOrder: WorkOrderListItem & {
    internal_note: string | null;
    completion_note: string | null;
    acceptance_name: string | null;
    acceptance_phone: string | null;
    accepted_at: string | null;
    payment_method: string | null;
    payment_note: string | null;
    material_amount: string;
    vat_amount: string;
    transaction_ref: string | null;
    debt_due_date: string | null;
  };
  history: HistoryItem[];
  materials: Material[];
  files: WorkFile[];
};

export type NotificationItem = {
  id: string;
  work_order_id: string | null;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export type ReportData = {
  range: { from: string; to: string };
  summary: {
    order_count: string;
    paid_revenue: string;
    open_debt: string;
    gross_amount: string;
  };
  byDisplayStatus: Array<{
    status: DisplayStatus;
    label: string;
    count: string;
    total: string;
    percent: string;
  }>;
  daily: Array<{
    date: string;
    created_count: string;
    completed_count: string;
    paid_revenue: string;
    open_debt: string;
  }>;
  byStatus: Array<{ status: WorkOrderStatus; count: string }>;
  byTechnician: Array<{ technician_name: string; order_count: string; paid_revenue: string }>;
  materials: Array<{ name: string; quantity: string; total_amount: string }>;
};

export type Filters = {
  q: string;
  scope: "open" | "this_month" | "today" | "all";
  status: string;
  type: string;
  technicianId: string;
  dateFrom: string;
  dateTo: string;
};

export type AppData = {
  metrics: Metrics | null;
  orders: WorkOrderListItem[];
  customers: Customer[];
  technicians: Technician[];
  users: AppUser[];
  notifications: NotificationItem[];
  report: ReportData | null;
};

export type ModalState =
  | { type: "order-detail"; id: string }
  | { type: "order-edit"; id: string }
  | { type: "technician-job"; id: string }
  | { type: "dispatch-detail"; id: string }
  | { type: "dispatch-assignment"; id: string }
  | { type: "payment-detail"; id: string }
  | { type: "payment-action"; id: string }
  | { type: "order-cancel"; item: WorkOrderListItem }
  | { type: "customer-detail"; item: Customer }
  | { type: "customer-create" }
  | { type: "customer-edit"; item: Customer }
  | { type: "customer-delete"; item: Customer }
  | { type: "user-create" }
  | { type: "user-edit"; item: AppUser }
  | { type: "user-delete"; item: AppUser }
  | { type: "user-assignment-history"; item: AppUser }
  | { type: "user-reset-password"; item: AppUser }
  | { type: "own-password" }
  | { type: "technician-edit"; item: Technician }
  | { type: "technician-delete"; item: Technician }
  | null;
