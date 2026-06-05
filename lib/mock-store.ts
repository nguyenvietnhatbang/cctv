import "server-only";

import { randomUUID } from "crypto";
import { HttpError } from "@/lib/http";
import {
  WORK_ORDER_STATUSES,
  type PaymentMethod,
  type PaymentStatus,
  type Role,
  type SessionUser,
  type TechnicianStatus,
  type WorkOrderPriority,
  type WorkOrderStatus,
  type WorkOrderType,
} from "@/lib/types";

type MockUser = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  status: "active" | "inactive";
};

type MockCustomer = {
  id: string;
  name: string;
  phone: string;
  address: string;
  address_note: string | null;
  created_at: string;
};

type MockTechnician = {
  id: string;
  user_id: string;
  service_area: string | null;
  status: TechnicianStatus;
  created_at: string;
};

type MockWorkOrder = {
  id: string;
  code: string;
  customer_id: string;
  technician_id: string | null;
  type: WorkOrderType;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  description: string;
  appointment_at: string | null;
  internal_note: string | null;
  labor_cost: string;
  vat_rate: string;
  cancellation_reason: string | null;
  check_in_at: string | null;
  check_in_lat: number | null;
  check_in_lng: number | null;
  completion_note: string | null;
  acceptance_name: string | null;
  acceptance_phone: string | null;
  accepted_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
};

type MockMaterial = {
  id: string;
  work_order_id: string;
  name: string;
  quantity: string;
  unit_price: string;
  line_total: string;
  created_at: string;
};

type MockFile = {
  id: string;
  work_order_id: string;
  original_name: string;
  purpose: "initial" | "before" | "after" | "signature";
  signed_url: string | null;
  path: string;
  created_at: string;
};

type MockPayment = {
  work_order_id: string;
  labor_amount: string;
  material_amount: string;
  vat_amount: string;
  total_amount: string;
  status: PaymentStatus;
  method: PaymentMethod | null;
  transaction_ref: string | null;
  debt_due_date: string | null;
  note: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
};

type MockHistory = {
  id: string;
  work_order_id: string;
  from_status: WorkOrderStatus | null;
  to_status: WorkOrderStatus;
  changed_by: string | null;
  changed_at: string;
  note: string | null;
};

type MockNotification = {
  id: string;
  user_id: string;
  work_order_id: string | null;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

type MockState = {
  users: MockUser[];
  customers: MockCustomer[];
  technicians: MockTechnician[];
  workOrders: MockWorkOrder[];
  materials: MockMaterial[];
  files: MockFile[];
  payments: MockPayment[];
  history: MockHistory[];
  notifications: MockNotification[];
};

declare global {
  var cctvMockState: MockState | undefined;
}

export function isMockMode() {
  return process.env.CCTV_DATA_MODE === "mock" || process.env.MOCK_DATA === "true";
}

function nowIso() {
  return new Date().toISOString();
}

function dayOffset(days: number, hour = 9) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

function vietnamDate(value: string | Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(
    typeof value === "string" ? new Date(value) : value,
  );
}

function moneyNumber(value: unknown) {
  return Number(value ?? 0);
}

function moneyString(value: unknown) {
  return moneyNumber(value).toFixed(2);
}

function lineTotal(quantity: unknown, unitPrice: unknown) {
  return moneyString(moneyNumber(quantity) * moneyNumber(unitPrice));
}

function toSessionUser(user: MockUser): SessionUser {
  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    phone: user.phone,
    role: user.role,
  };
}

function seedState(): MockState {
  const users: MockUser[] = [
    { id: "user-admin", full_name: "Admin Demo", email: "admin@demo.local", phone: "0900000001", role: "admin", status: "active" },
    { id: "user-dispatcher", full_name: "Điều phối Demo", email: "dispatch@demo.local", phone: "0900000002", role: "dispatcher", status: "active" },
    { id: "user-tech-1", full_name: "KTV Minh", email: "minh@demo.local", phone: "0900000011", role: "technician", status: "active" },
    { id: "user-tech-2", full_name: "KTV Huy", email: "huy@demo.local", phone: "0900000012", role: "technician", status: "active" },
    { id: "user-accountant", full_name: "Kế toán Demo", email: "accounting@demo.local", phone: "0900000003", role: "accountant", status: "active" },
  ];

  const customers: MockCustomer[] = [
    { id: "cust-1", name: "Cafe Ánh Dương", phone: "0912345678", address: "12 Nguyễn Trãi, Quận 1, TP.HCM", address_note: "Gặp anh Nam tại quầy", created_at: dayOffset(-2) },
    { id: "cust-2", name: "Kho Hưng Phát", phone: "0987654321", address: "88 Quốc lộ 13, Thủ Đức, TP.HCM", address_note: "Cổng sau, bảo vệ mở", created_at: dayOffset(-1) },
    { id: "cust-3", name: "Nhà chị Lan", phone: "0933333333", address: "45 Lê Văn Sỹ, Quận 3, TP.HCM", address_note: null, created_at: nowIso() },
  ];

  const technicians: MockTechnician[] = [
    { id: "tech-1", user_id: "user-tech-1", service_area: "Quận 1, 3, 5", status: "working", created_at: dayOffset(-10) },
    { id: "tech-2", user_id: "user-tech-2", service_area: "Thủ Đức, Bình Thạnh", status: "available", created_at: dayOffset(-10) },
  ];

  const workOrders: MockWorkOrder[] = [
    {
      id: "wo-1",
      code: "CV-20260605-001",
      customer_id: "cust-1",
      technician_id: "tech-1",
      type: "maintenance",
      priority: "urgent",
      status: "working",
      description: "Camera tầng trệt mất tín hiệu, khách cần xử lý trong ngày.",
      appointment_at: dayOffset(0, 10),
      internal_note: "Ưu tiên kiểm tra nguồn và đầu ghi.",
      labor_cost: "250000.00",
      vat_rate: "0.00",
      cancellation_reason: null,
      check_in_at: dayOffset(0, 10),
      check_in_lat: 10.775,
      check_in_lng: 106.7,
      completion_note: null,
      acceptance_name: null,
      acceptance_phone: null,
      accepted_at: null,
      created_by: "user-dispatcher",
      updated_by: "user-tech-1",
      created_at: dayOffset(0, 8),
    },
    {
      id: "wo-2",
      code: "CV-20260605-002",
      customer_id: "cust-2",
      technician_id: null,
      type: "installation",
      priority: "normal",
      status: "pending_assignment",
      description: "Lắp thêm 2 camera khu vực xuất nhập hàng.",
      appointment_at: dayOffset(0, 14),
      internal_note: "Khách muốn báo giá vật tư trước khi làm.",
      labor_cost: "0.00",
      vat_rate: "8.00",
      cancellation_reason: null,
      check_in_at: null,
      check_in_lat: null,
      check_in_lng: null,
      completion_note: null,
      acceptance_name: null,
      acceptance_phone: null,
      accepted_at: null,
      created_by: "user-dispatcher",
      updated_by: "user-dispatcher",
      created_at: dayOffset(0, 9),
    },
    {
      id: "wo-3",
      code: "CV-20260604-003",
      customer_id: "cust-3",
      technician_id: "tech-2",
      type: "warranty",
      priority: "normal",
      status: "awaiting_payment",
      description: "Bảo hành camera trước nhà, thay jack tín hiệu.",
      appointment_at: dayOffset(-1, 15),
      internal_note: null,
      labor_cost: "120000.00",
      vat_rate: "0.00",
      cancellation_reason: null,
      check_in_at: dayOffset(-1, 15),
      check_in_lat: null,
      check_in_lng: null,
      completion_note: "Đã thay jack và test lại hình ảnh ổn định.",
      acceptance_name: "Chị Lan",
      acceptance_phone: "0933333333",
      accepted_at: dayOffset(-1, 16),
      created_by: "user-dispatcher",
      updated_by: "user-tech-2",
      created_at: dayOffset(-1, 13),
    },
  ];

  const materials: MockMaterial[] = [
    { id: "mat-1", work_order_id: "wo-1", name: "Adapter 12V", quantity: "1.00", unit_price: "90000.00", line_total: "90000.00", created_at: nowIso() },
    { id: "mat-2", work_order_id: "wo-3", name: "Jack BNC", quantity: "2.00", unit_price: "15000.00", line_total: "30000.00", created_at: dayOffset(-1, 16) },
  ];

  const files: MockFile[] = [
    { id: "file-1", work_order_id: "wo-1", original_name: "before-camera.jpg", purpose: "before", signed_url: "#", path: "mock/before-camera.jpg", created_at: nowIso() },
    { id: "file-2", work_order_id: "wo-3", original_name: "signature.png", purpose: "signature", signed_url: "#", path: "mock/signature.png", created_at: dayOffset(-1, 16) },
  ];

  const history: MockHistory[] = [
    { id: "his-1", work_order_id: "wo-1", from_status: null, to_status: "pending_assignment", changed_by: "user-dispatcher", changed_at: dayOffset(0, 8), note: "Tạo phiếu" },
    { id: "his-2", work_order_id: "wo-1", from_status: "pending_assignment", to_status: "assigned", changed_by: "user-dispatcher", changed_at: dayOffset(0, 8), note: "Phân công kỹ thuật viên" },
    { id: "his-3", work_order_id: "wo-1", from_status: "assigned", to_status: "accepted", changed_by: "user-tech-1", changed_at: dayOffset(0, 9), note: null },
    { id: "his-4", work_order_id: "wo-1", from_status: "accepted", to_status: "traveling", changed_by: "user-tech-1", changed_at: dayOffset(0, 9), note: null },
    { id: "his-5", work_order_id: "wo-1", from_status: "traveling", to_status: "working", changed_by: "user-tech-1", changed_at: dayOffset(0, 10), note: "Check-in" },
    { id: "his-6", work_order_id: "wo-2", from_status: null, to_status: "pending_assignment", changed_by: "user-dispatcher", changed_at: dayOffset(0, 9), note: "Tạo phiếu" },
    { id: "his-7", work_order_id: "wo-3", from_status: "awaiting_acceptance", to_status: "completed", changed_by: "user-tech-2", changed_at: dayOffset(-1, 16), note: "Khách ký nghiệm thu" },
    { id: "his-8", work_order_id: "wo-3", from_status: "completed", to_status: "awaiting_payment", changed_by: "user-dispatcher", changed_at: dayOffset(-1, 16), note: "Chờ thanh toán" },
  ];

  const notifications: MockNotification[] = [
    { id: "noti-1", user_id: "user-tech-1", work_order_id: "wo-1", title: "Bạn được giao phiếu mới", body: "Mở phiếu để xem địa chỉ và nhận việc.", read_at: null, created_at: dayOffset(0, 8) },
    { id: "noti-2", user_id: "user-dispatcher", work_order_id: "wo-1", title: "Phiếu đã đổi trạng thái", body: "Trạng thái mới: working", read_at: null, created_at: dayOffset(0, 10) },
  ];

  const state: MockState = {
    users,
    customers,
    technicians,
    workOrders,
    materials,
    files,
    payments: workOrders.map((order) => ({
      work_order_id: order.id,
      labor_amount: order.labor_cost,
      material_amount: "0.00",
      vat_amount: "0.00",
      total_amount: "0.00",
      status: order.status === "paid" ? "paid" : order.status === "debt" ? "debt" : "unpaid",
      method: null,
      transaction_ref: null,
      debt_due_date: null,
      note: null,
      confirmed_by: null,
      confirmed_at: null,
    })),
    history,
    notifications,
  };

  for (const order of state.workOrders) {
    syncPayment(state, order.id);
  }

  return state;
}

function getState() {
  if (!globalThis.cctvMockState) {
    globalThis.cctvMockState = seedState();
  }
  return globalThis.cctvMockState;
}

function syncPayment(state: MockState, workOrderId: string) {
  const order = state.workOrders.find((item) => item.id === workOrderId);
  const payment = state.payments.find((item) => item.work_order_id === workOrderId);
  if (!order || !payment) return;

  const materialAmount = state.materials
    .filter((item) => item.work_order_id === workOrderId)
    .reduce((sum, item) => sum + moneyNumber(item.line_total), 0);
  const labor = moneyNumber(order.labor_cost);
  const vat = Math.round((labor + materialAmount) * moneyNumber(order.vat_rate)) / 100;

  payment.labor_amount = moneyString(labor);
  payment.material_amount = moneyString(materialAmount);
  payment.vat_amount = moneyString(vat);
  payment.total_amount = moneyString(labor + materialAmount + vat);
}

function customerFor(state: MockState, order: MockWorkOrder) {
  const customer = state.customers.find((item) => item.id === order.customer_id);
  if (!customer) throw new HttpError(404, "Không tìm thấy khách hàng");
  return customer;
}

function activeTechnicianFor(state: MockState, orderId: string) {
  const order = state.workOrders.find((item) => item.id === orderId);
  if (!order) return null;
  return state.technicians.find((tech) => tech.id === order.technician_id) ?? null;
}

function technicianForOrder(state: MockState, order: MockWorkOrder) {
  return activeTechnicianFor(state, order.id);
}

function listItem(state: MockState, order: MockWorkOrder) {
  const customer = customerFor(state, order);
  const tech = technicianForOrder(state, order);
  const techUser = tech ? state.users.find((item) => item.id === tech.user_id) : null;
  const payment = state.payments.find((item) => item.work_order_id === order.id);

  return {
    ...order,
    customer_name: customer.name,
    customer_phone: customer.phone,
    customer_address: customer.address,
    technician_id: tech?.id ?? null,
    technician_name: techUser?.full_name ?? null,
    total_amount: payment?.total_amount ?? "0.00",
    payment_status: payment?.status ?? null,
  };
}

function assertCanRead(user: SessionUser, order: MockWorkOrder) {
  if (user.role !== "technician") return;
  const tech = getState().technicians.find((item) => item.user_id === user.id);
  const assigned = technicianForOrder(getState(), order);
  if (!tech || assigned?.id !== tech.id) {
    throw new HttpError(403, "Bạn không có quyền xem phiếu này");
  }
}

function addHistory(state: MockState, order: MockWorkOrder, to: WorkOrderStatus, changedBy: string, note: string | null) {
  state.history.push({
    id: randomUUID(),
    work_order_id: order.id,
    from_status: order.status,
    to_status: to,
    changed_by: changedBy,
    changed_at: nowIso(),
    note,
  });
  order.status = to;
  order.updated_by = changedBy;
}

function notifyRoles(state: MockState, roles: Role[], workOrderId: string, title: string, body: string) {
  for (const user of state.users) {
    if (user.status === "active" && roles.includes(user.role)) {
      state.notifications.push({
        id: randomUUID(),
        user_id: user.id,
        work_order_id: workOrderId,
        title,
        body,
        read_at: null,
        created_at: nowIso(),
      });
    }
  }
}

export const mockStore = {
  getUserById(id: string) {
    const user = getState().users.find((item) => item.id === id && item.status === "active");
    return user ? toSessionUser(user) : null;
  },

  login(identifier: string, password: string) {
    const user = getState().users.find((item) =>
      item.status === "active"
      && (item.email?.toLowerCase() === identifier.toLowerCase() || item.phone === identifier),
    );
    if (!user || password !== "demo1234") {
      throw new HttpError(401, "Sai tài khoản hoặc mật khẩu");
    }
    return toSessionUser(user);
  },

  dashboard(user: SessionUser) {
    const orders = this.workOrders(user, new URLSearchParams());
    const today = vietnamDate();
    return {
      total_today: String(orders.filter((order) => vietnamDate(order.created_at) === today).length),
      pending_assignment: String(orders.filter((order) => order.status === "pending_assignment").length),
      working: String(orders.filter((order) => ["traveling", "working"].includes(order.status)).length),
      awaiting_acceptance: String(orders.filter((order) => order.status === "awaiting_acceptance").length),
      awaiting_payment: String(orders.filter((order) => order.status === "awaiting_payment").length),
      paid_today: moneyString(getState().payments.filter((item) => item.status === "paid" && item.confirmed_at && vietnamDate(item.confirmed_at) === today).reduce((sum, item) => sum + moneyNumber(item.total_amount), 0)),
      open_debt: moneyString(getState().payments.filter((item) => item.status === "debt").reduce((sum, item) => sum + moneyNumber(item.total_amount), 0)),
    };
  },

  workOrders(user: SessionUser, searchParams: URLSearchParams) {
    const state = getState();
    let orders = state.workOrders.map((order) => listItem(state, order));

    if (user.role === "technician") {
      const tech = state.technicians.find((item) => item.user_id === user.id);
      orders = orders.filter((order) => order.technician_id === tech?.id);
    }

    const q = searchParams.get("q")?.trim().toLowerCase();
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const technicianId = searchParams.get("technicianId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    if (status) orders = orders.filter((order) => order.status === status);
    if (type) orders = orders.filter((order) => order.type === type);
    if (technicianId && user.role !== "technician") orders = orders.filter((order) => order.technician_id === technicianId);
    if (dateFrom) orders = orders.filter((order) => vietnamDate(order.created_at) >= dateFrom);
    if (dateTo) orders = orders.filter((order) => vietnamDate(order.created_at) <= dateTo);
    if (q) {
      orders = orders.filter((order) =>
        [order.code, order.customer_name, order.customer_phone, order.customer_address].some((value) => value.toLowerCase().includes(q)),
      );
    }

    return orders.toSorted((a, b) => (b.appointment_at ?? b.created_at).localeCompare(a.appointment_at ?? a.created_at));
  },

  createWorkOrder(user: SessionUser, body: {
    customerId?: string;
    customer?: { name: string; phone: string; address: string; addressNote?: string | null };
    type: WorkOrderType;
    priority: WorkOrderPriority;
    description: string;
    appointmentAt?: string | null;
    internalNote?: string | null;
    technicianId?: string | null;
  }) {
    const state = getState();
    let customerId = body.customerId;
    if (!customerId && body.customer) {
      customerId = randomUUID();
      state.customers.unshift({
        id: customerId,
        name: body.customer.name,
        phone: body.customer.phone,
        address: body.customer.address,
        address_note: body.customer.addressNote ?? null,
        created_at: nowIso(),
      });
    }
    if (!customerId) throw new HttpError(422, "Cần chọn hoặc tạo khách hàng");

    const order: MockWorkOrder = {
      id: randomUUID(),
      code: `CV-${vietnamDate().replaceAll("-", "")}-${String(state.workOrders.length + 1).padStart(3, "0")}`,
      customer_id: customerId,
      technician_id: null,
      type: body.type,
      priority: body.priority,
      status: "pending_assignment",
      description: body.description,
      appointment_at: body.appointmentAt ?? null,
      internal_note: body.internalNote ?? null,
      labor_cost: "0.00",
      vat_rate: "0.00",
      cancellation_reason: null,
      check_in_at: null,
      check_in_lat: null,
      check_in_lng: null,
      completion_note: null,
      acceptance_name: null,
      acceptance_phone: null,
      accepted_at: null,
      created_by: user.id,
      updated_by: user.id,
      created_at: nowIso(),
    };
    state.workOrders.unshift(order);
    state.payments.push({
      work_order_id: order.id,
      labor_amount: "0.00",
      material_amount: "0.00",
      vat_amount: "0.00",
      total_amount: "0.00",
      status: "unpaid",
      method: null,
      transaction_ref: null,
      debt_due_date: null,
      note: null,
      confirmed_by: null,
      confirmed_at: null,
    });
    state.history.push({ id: randomUUID(), work_order_id: order.id, from_status: null, to_status: "pending_assignment", changed_by: user.id, changed_at: nowIso(), note: "Tạo phiếu" });
    if (body.technicianId) this.assignWorkOrder(user, order.id, body.technicianId, "Phân công kỹ thuật viên");
    return order;
  },

  detail(user: SessionUser, id: string) {
    const state = getState();
    const order = state.workOrders.find((item) => item.id === id);
    if (!order) throw new HttpError(404, "Không tìm thấy phiếu");
    assertCanRead(user, order);

    const customer = customerFor(state, order);
    const payment = state.payments.find((item) => item.work_order_id === id);
    const item = listItem(state, order);
    return {
      workOrder: {
        ...item,
        customer_address_note: customer.address_note,
        payment_method: payment?.method ?? null,
        labor_amount: payment?.labor_amount ?? "0.00",
        material_amount: payment?.material_amount ?? "0.00",
        vat_amount: payment?.vat_amount ?? "0.00",
        transaction_ref: payment?.transaction_ref ?? null,
        debt_due_date: payment?.debt_due_date ?? null,
        payment_note: payment?.note ?? null,
        confirmed_at: payment?.confirmed_at ?? null,
      },
      history: state.history
        .filter((item) => item.work_order_id === id)
        .map((item) => ({ ...item, changed_by_name: state.users.find((userItem) => userItem.id === item.changed_by)?.full_name ?? null }))
        .toSorted((a, b) => b.changed_at.localeCompare(a.changed_at)),
      materials: state.materials.filter((item) => item.work_order_id === id).toSorted((a, b) => b.created_at.localeCompare(a.created_at)),
      files: state.files.filter((item) => item.work_order_id === id).map((file) => ({
        id: file.id,
        work_order_id: file.work_order_id,
        original_name: file.original_name,
        purpose: file.purpose,
        signed_url: file.signed_url,
        created_at: file.created_at,
      })),
    };
  },

  updateWorkOrder(user: SessionUser, id: string, body: Record<string, unknown>) {
    const state = getState();
    const order = state.workOrders.find((item) => item.id === id);
    if (!order) throw new HttpError(404, "Không tìm thấy phiếu");
    assertCanRead(user, order);

    if (body.description !== undefined) order.description = String(body.description);
    if (body.appointmentAt !== undefined && body.appointmentAt !== null) order.appointment_at = String(body.appointmentAt);
    if (body.internalNote !== undefined) order.internal_note = body.internalNote ? String(body.internalNote) : null;
    if (body.completionNote !== undefined) order.completion_note = body.completionNote ? String(body.completionNote) : null;
    if (body.laborCost !== undefined) order.labor_cost = moneyString(body.laborCost);
    if (body.vatRate !== undefined) order.vat_rate = moneyString(body.vatRate);
    order.updated_by = user.id;
    syncPayment(state, id);
    return order;
  },

  changeStatus(user: SessionUser, id: string, status: WorkOrderStatus, note: string | null, checkIn?: { lat?: number; lng?: number }) {
    const state = getState();
    const order = state.workOrders.find((item) => item.id === id);
    if (!order) throw new HttpError(404, "Không tìm thấy phiếu");
    assertCanRead(user, order);
    if (!WORK_ORDER_STATUSES.includes(status)) throw new HttpError(422, "Trạng thái không hợp lệ");
    if (status === "cancelled" && !note) throw new HttpError(422, "Cần nhập lý do hủy phiếu");
    if (status === "working") {
      order.check_in_at = order.check_in_at ?? nowIso();
      order.check_in_lat = checkIn?.lat ?? order.check_in_lat;
      order.check_in_lng = checkIn?.lng ?? order.check_in_lng;
    }
    if (status === "completed") order.accepted_at = order.accepted_at ?? nowIso();
    if (status === "cancelled") order.cancellation_reason = note;
    addHistory(state, order, status, user.id, note);
    notifyRoles(state, ["admin", "dispatcher"], id, "Phiếu đã đổi trạng thái", `Trạng thái mới: ${status}`);
  },

  assignWorkOrder(user: SessionUser, id: string, technicianId: string, note: string | null) {
    const state = getState();
    const order = state.workOrders.find((item) => item.id === id);
    const tech = state.technicians.find((item) => item.id === technicianId);
    if (!order || !tech) throw new HttpError(404, "Không tìm thấy dữ liệu phân công");
    order.technician_id = tech.id;
    if (order.status === "pending_assignment") addHistory(state, order, "assigned", user.id, note ?? "Phân công kỹ thuật viên");
    else state.history.push({ id: randomUUID(), work_order_id: id, from_status: order.status, to_status: order.status, changed_by: user.id, changed_at: nowIso(), note: note ?? "Đổi kỹ thuật viên phụ trách" });
    state.notifications.push({ id: randomUUID(), user_id: tech.user_id, work_order_id: id, title: "Bạn được giao phiếu mới", body: "Mở phiếu để xem địa chỉ, liên hệ khách và nhận việc.", read_at: null, created_at: nowIso() });
  },

  createMaterial(user: SessionUser, id: string, body: { name: string; quantity: number; unitPrice: number }) {
    const state = getState();
    const material = { id: randomUUID(), work_order_id: id, name: body.name, quantity: moneyString(body.quantity), unit_price: moneyString(body.unitPrice), line_total: lineTotal(body.quantity, body.unitPrice), created_at: nowIso() };
    state.materials.unshift(material);
    syncPayment(state, id);
    void user;
    return material;
  },

  updateMaterial(id: string, materialId: string, body: { name?: string; quantity?: number; unitPrice?: number }) {
    const state = getState();
    const material = state.materials.find((item) => item.work_order_id === id && item.id === materialId);
    if (!material) throw new HttpError(404, "Không tìm thấy vật tư");
    if (body.name !== undefined) material.name = body.name;
    if (body.quantity !== undefined) material.quantity = moneyString(body.quantity);
    if (body.unitPrice !== undefined) material.unit_price = moneyString(body.unitPrice);
    material.line_total = lineTotal(material.quantity, material.unit_price);
    syncPayment(state, id);
    return material;
  },

  deleteMaterial(id: string, materialId: string) {
    const state = getState();
    const before = state.materials.length;
    state.materials = state.materials.filter((item) => !(item.work_order_id === id && item.id === materialId));
    if (state.materials.length === before) throw new HttpError(404, "Không tìm thấy vật tư");
    syncPayment(state, id);
  },

  createFile(id: string, purpose: MockFile["purpose"], name: string) {
    const state = getState();
    const file: MockFile = { id: randomUUID(), work_order_id: id, original_name: name, purpose, signed_url: "#", path: `mock/${id}/${name}`, created_at: nowIso() };
    state.files.unshift(file);
    return file;
  },

  deleteFile(id: string, fileId: string) {
    const state = getState();
    const before = state.files.length;
    state.files = state.files.filter((item) => !(item.work_order_id === id && item.id === fileId));
    if (state.files.length === before) throw new HttpError(404, "Không tìm thấy file");
  },

  accept(user: SessionUser, id: string, body: { acceptanceName: string; acceptancePhone?: string | null; signatureDataUrl: string }) {
    const state = getState();
    const order = state.workOrders.find((item) => item.id === id);
    if (!order) throw new HttpError(404, "Không tìm thấy phiếu");
    order.acceptance_name = body.acceptanceName;
    order.acceptance_phone = body.acceptancePhone ?? null;
    order.accepted_at = nowIso();
    state.files.unshift({ id: randomUUID(), work_order_id: id, original_name: "signature.png", purpose: "signature", signed_url: body.signatureDataUrl, path: `mock/${id}/signature.png`, created_at: nowIso() });
    addHistory(state, order, "completed", user.id, "Khách ký nghiệm thu");
  },

  pay(user: SessionUser, id: string, body: { status: PaymentStatus; method?: PaymentMethod | null; transactionRef?: string | null; debtDueDate?: string | null; note?: string | null }) {
    const state = getState();
    const order = state.workOrders.find((item) => item.id === id);
    const payment = state.payments.find((item) => item.work_order_id === id);
    if (!order || !payment) throw new HttpError(404, "Không tìm thấy phiếu");
    payment.status = body.status;
    payment.method = body.method ?? (body.status === "debt" ? "debt" : null);
    payment.transaction_ref = body.transactionRef ?? null;
    payment.debt_due_date = body.debtDueDate ?? null;
    payment.note = body.note ?? null;
    payment.confirmed_by = user.id;
    payment.confirmed_at = nowIso();
    addHistory(state, order, body.status === "paid" ? "paid" : "debt", user.id, body.status === "paid" ? "Xác nhận đã thanh toán" : "Chuyển công nợ");
    notifyRoles(state, ["admin", "dispatcher", "accountant"], id, "Thanh toán đã cập nhật", body.status === "paid" ? "Phiếu đã thanh toán." : "Phiếu chuyển sang công nợ.");
  },

  customers(search = "") {
    const q = search.toLowerCase();
    return getState().customers
      .filter((item) => !q || item.name.toLowerCase().includes(q) || item.phone.includes(q))
      .toSorted((a, b) => b.created_at.localeCompare(a.created_at));
  },

  createCustomer(body: { name: string; phone: string; address: string; addressNote?: string | null }) {
    const customer = { id: randomUUID(), name: body.name, phone: body.phone, address: body.address, address_note: body.addressNote ?? null, created_at: nowIso() };
    getState().customers.unshift(customer);
    return customer;
  },

  updateCustomer(id: string, body: Partial<{ name: string; phone: string; address: string; addressNote: string | null }>) {
    const customer = getState().customers.find((item) => item.id === id);
    if (!customer) throw new HttpError(404, "Không tìm thấy khách hàng");
    if (body.name !== undefined) customer.name = body.name;
    if (body.phone !== undefined) customer.phone = body.phone;
    if (body.address !== undefined) customer.address = body.address;
    if (body.addressNote !== undefined) customer.address_note = body.addressNote;
    return customer;
  },

  deleteCustomer(id: string) {
    const state = getState();
    if (state.workOrders.some((item) => item.customer_id === id)) throw new HttpError(409, "Khách hàng đã có phiếu");
    state.customers = state.customers.filter((item) => item.id !== id);
  },

  technicians() {
    const state = getState();
    return state.technicians.map((tech) => {
      const user = state.users.find((item) => item.id === tech.user_id)!;
      return { ...tech, full_name: user.full_name, phone: user.phone, email: user.email, jobs_today: String(state.workOrders.filter((order) => technicianForOrder(state, order)?.id === tech.id).length) };
    });
  },

  updateTechnician(id: string, body: { serviceArea?: string | null; status?: TechnicianStatus }) {
    const tech = getState().technicians.find((item) => item.id === id);
    if (!tech) throw new HttpError(404, "Không tìm thấy kỹ thuật viên");
    if (body.serviceArea !== undefined) tech.service_area = body.serviceArea;
    if (body.status !== undefined) tech.status = body.status;
    return tech;
  },

  createTechnician(userId: string, body: { serviceArea?: string | null; status?: TechnicianStatus }) {
    const state = getState();
    const user = state.users.find((item) => item.id === userId);
    if (!user) throw new HttpError(404, "Không tìm thấy nhân viên");
    const existing = state.technicians.find((item) => item.user_id === userId);
    if (existing) return existing;
    const technician = {
      id: randomUUID(),
      user_id: userId,
      service_area: body.serviceArea ?? null,
      status: body.status ?? "available",
      created_at: nowIso(),
    };
    state.technicians.push(technician);
    return technician;
  },

  users() {
    const state = getState();
    return state.users.map((user) => {
      const tech = state.technicians.find((item) => item.user_id === user.id);
      return { ...user, technician_id: tech?.id ?? null, service_area: tech?.service_area ?? null, technician_status: tech?.status ?? null };
    });
  },

  createUser(body: { fullName: string; email?: string | null; phone?: string | null; role: Role; status?: "active" | "inactive"; technician?: { serviceArea?: string | null; status?: TechnicianStatus } }) {
    const state = getState();
    const user: MockUser = { id: randomUUID(), full_name: body.fullName, email: body.email ?? null, phone: body.phone ?? null, role: body.role, status: body.status ?? "active" };
    state.users.unshift(user);
    if (body.role === "technician" || body.technician) {
      state.technicians.push({ id: randomUUID(), user_id: user.id, service_area: body.technician?.serviceArea ?? null, status: body.technician?.status ?? "available", created_at: nowIso() });
    }
    return user;
  },

  updateUser(id: string, body: Partial<{ fullName: string; email: string | null; phone: string | null; role: Role; status: "active" | "inactive" }>) {
    const user = getState().users.find((item) => item.id === id);
    if (!user) throw new HttpError(404, "Không tìm thấy nhân viên");
    if (body.fullName !== undefined) user.full_name = body.fullName;
    if (body.email !== undefined) user.email = body.email;
    if (body.phone !== undefined) user.phone = body.phone;
    if (body.role !== undefined) user.role = body.role;
    if (body.status !== undefined) user.status = body.status;
    return user;
  },

  deactivateUser(id: string) {
    const user = getState().users.find((item) => item.id === id);
    if (!user) throw new HttpError(404, "Không tìm thấy nhân viên");
    user.status = "inactive";
  },

  notifications(user: SessionUser) {
    return getState().notifications.filter((item) => item.user_id === user.id).toSorted((a, b) => b.created_at.localeCompare(a.created_at));
  },

  setNotificationRead(user: SessionUser, id: string, read: boolean) {
    const item = getState().notifications.find((noti) => noti.id === id && noti.user_id === user.id);
    if (item) item.read_at = read ? nowIso() : null;
  },

  report(from: string, to: string) {
    const state = getState();
    const orders = state.workOrders.filter((order) => vietnamDate(order.created_at) >= from && vietnamDate(order.created_at) <= to);
    const payments = orders.map((order) => state.payments.find((item) => item.work_order_id === order.id)).filter(Boolean) as MockPayment[];
    return {
      range: { from, to },
      summary: {
        order_count: String(orders.length),
        paid_revenue: moneyString(payments.filter((item) => item.status === "paid").reduce((sum, item) => sum + moneyNumber(item.total_amount), 0)),
        open_debt: moneyString(payments.filter((item) => item.status === "debt").reduce((sum, item) => sum + moneyNumber(item.total_amount), 0)),
        gross_amount: moneyString(payments.reduce((sum, item) => sum + moneyNumber(item.total_amount), 0)),
      },
      byStatus: WORK_ORDER_STATUSES.map((status) => ({ status, count: String(orders.filter((order) => order.status === status).length) })).filter((item) => item.count !== "0"),
      byTechnician: this.technicians().map((tech) => {
        const techOrders = orders.filter((order) => technicianForOrder(state, order)?.id === tech.id);
        return { technician_name: tech.full_name, order_count: String(techOrders.length), paid_revenue: moneyString(techOrders.reduce((sum, order) => sum + moneyNumber(state.payments.find((item) => item.work_order_id === order.id && item.status === "paid")?.total_amount), 0)) };
      }),
      materials: state.materials.reduce<Array<{ name: string; quantity: string; total_amount: string }>>((acc, material) => {
        const order = orders.find((item) => item.id === material.work_order_id);
        if (!order) return acc;
        const existing = acc.find((item) => item.name === material.name);
        if (existing) {
          existing.quantity = moneyString(moneyNumber(existing.quantity) + moneyNumber(material.quantity));
          existing.total_amount = moneyString(moneyNumber(existing.total_amount) + moneyNumber(material.line_total));
        } else {
          acc.push({ name: material.name, quantity: material.quantity, total_amount: material.line_total });
        }
        return acc;
      }, []),
    };
  },
};
