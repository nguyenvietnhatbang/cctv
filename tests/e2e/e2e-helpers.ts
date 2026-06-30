import { expect, type APIRequestContext, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { Pool } from "pg";

export const adminEmail = process.env.E2E_ADMIN_EMAIL || "";
export const adminPassword = process.env.E2E_ADMIN_PASSWORD || "";
export const e2ePassword = process.env.E2E_GENERATED_PASSWORD || "E2ePassword123!";
export const databaseUrl = process.env.DATABASE_URL;

export const roleLabels = {
  admin: "Admin",
  dispatcher: "Điều phối",
  team_lead: "Trưởng nhóm",
  technician: "Kỹ thuật",
  accountant: "Kế toán",
} as const;

export const roleTabs = {
  admin: ["Tổng quan", "Công việc", "Khách hàng", "Phân công", "DS kỹ thuật", "Thanh toán", "Báo cáo", "Thông báo", "Nhân viên"],
  dispatcher: ["Tổng quan", "Công việc", "Khách hàng", "Phân công", "Kỹ thuật", "DS kỹ thuật", "Thanh toán", "Báo cáo", "Thông báo"],
  team_lead: ["Tổng quan", "Công việc", "Khách hàng", "Phân công", "Kỹ thuật", "Lịch sử", "DS kỹ thuật", "Thông báo"],
  technician: ["Kỹ thuật", "Lịch sử", "Thông báo"],
  accountant: ["Tổng quan", "Công việc", "Khách hàng", "Thanh toán", "Báo cáo", "Thông báo"],
} as const;

export type E2ERole = keyof typeof roleLabels;

export type E2EUser = {
  id: string;
  email: string;
  password: string;
  role: E2ERole;
  fullName: string;
  technicianId: string | null;
};

export type E2EOrder = {
  id: string;
  code: string;
  customerId: string;
};

export type E2EWorld = {
  runId: string;
  runSlug: string;
  users: Partial<Record<E2ERole, E2EUser>>;
  customerIds: string[];
  orderIds: string[];
  materialIds: string[];
};

export type WorkOrderDetailResponse = {
  workOrder: {
    id: string;
    code: string;
    status: string;
    material_amount: string;
    labor_amount: string;
    vat_amount: string;
    total_amount: string;
    paid_amount: string;
    debt_amount: string;
    payment_status: string;
    customer_lat: string | null;
    customer_lng: string | null;
  };
  materials: Array<{
    id: string;
    name: string;
    quantity: string;
    unit_price: string;
    line_total: string;
  }>;
  files: Array<{ id: string; purpose: string }>;
  paymentTransactions: Array<{ id: string; amount: string }>;
};

export function createWorld(): E2EWorld {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  return {
    runId: `E2E_${suffix}`,
    runSlug: `e2e-${suffix.replaceAll("_", "-").toLowerCase()}`,
    users: {},
    customerIds: [],
    orderIds: [],
    materialIds: [],
  };
}

export function makePool() {
  if (!databaseUrl) return null;
  return new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1")
      ? undefined
      : { rejectUnauthorized: false },
  });
}

export async function login(page: Page, identifier: string, password: string, roleLabel?: string) {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Email hoặc số điện thoại" }).fill(identifier);
  await page.getByLabel("Mật khẩu").fill(password);
  const responsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/api/auth/login")
      && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  const response = await responsePromise;
  expect(response.ok(), await response.text()).toBeTruthy();
  if (roleLabel) {
    await expect(page.getByText(roleLabel, { exact: true }).first()).toBeVisible();
  }
}

export async function newLoggedInPage(
  browser: Browser,
  identifier: string,
  password: string,
  roleLabel?: string,
) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, identifier, password, roleLabel);
  return { context, page };
}

export async function expectOk(response: Awaited<ReturnType<APIRequestContext["fetch"]>>) {
  expect(response.ok(), await response.text()).toBeTruthy();
}

export async function expectStatus(
  response: Awaited<ReturnType<APIRequestContext["fetch"]>>,
  status: number,
) {
  expect(response.status(), await response.text()).toBe(status);
}

export async function createRoleUser(
  request: APIRequestContext,
  world: E2EWorld,
  role: Exclude<E2ERole, "admin">,
) {
  const userResponse = await request.post("/api/users", {
    data: {
      fullName: `${world.runId} ${roleLabels[role]}`,
      email: `${world.runSlug}-${role}@example.com`,
      password: e2ePassword,
      role,
      status: "active",
      technician: role === "technician" || role === "team_lead"
        ? { serviceArea: `${world.runId} service area`, status: "available" }
        : undefined,
    },
  });
  await expectOk(userResponse);
  const payload = await userResponse.json() as {
    user: {
      id: string;
      email: string;
      role: E2ERole;
      full_name: string;
      technician_id: string | null;
    };
  };

  const user: E2EUser = {
    id: payload.user.id,
    email: payload.user.email,
    password: e2ePassword,
    role: payload.user.role,
    fullName: payload.user.full_name,
    technicianId: payload.user.technician_id,
  };
  world.users[role] = user;
  return user;
}

export async function createCustomer(
  request: APIRequestContext,
  world: E2EWorld,
  label: string,
) {
  const digits = `${Date.now()}${world.customerIds.length}`.slice(-8);
  const response = await request.post("/api/customers", {
    data: {
      name: `${world.runId} customer ${label}`,
      phone: `09${digits}`,
      address: `${world.runId} address ${label}`,
      addressNote: "Playwright full regression fixture",
      lat: 21.0245,
      lng: 105.8412,
    },
  });
  await expectOk(response);
  const payload = await response.json() as { customer: { id: string; name: string } };
  expect(payload.customer.name.startsWith(world.runId)).toBeTruthy();
  world.customerIds.push(payload.customer.id);
  return payload.customer;
}

export async function createWorkOrder(
  request: APIRequestContext,
  world: E2EWorld,
  options: {
    customerId?: string;
    label: string;
    technicianIds?: string[];
    priority?: "normal" | "urgent";
  },
): Promise<E2EOrder> {
  const customer = options.customerId
    ? { id: options.customerId }
    : await createCustomer(request, world, options.label);
  const response = await request.post("/api/work-orders", {
    data: {
      customerId: customer.id,
      type: "maintenance_repair",
      priority: options.priority ?? "normal",
      description: `${world.runId} work order ${options.label}`,
      internalNote: `${world.runId} regression fixture`,
      technicianIds: options.technicianIds ?? [],
    },
  });
  await expectOk(response);
  const payload = await response.json() as {
    workOrder: { id: string; code: string; customer_id: string };
  };
  world.orderIds.push(payload.workOrder.id);
  return {
    id: payload.workOrder.id,
    code: payload.workOrder.code,
    customerId: payload.workOrder.customer_id,
  };
}

export async function getWorkOrderDetail(request: APIRequestContext, orderId: string) {
  const response = await request.get(`/api/work-orders/${orderId}`);
  await expectOk(response);
  return response.json() as Promise<WorkOrderDetailResponse>;
}

export async function setCosts(
  request: APIRequestContext,
  orderId: string,
  costs = { materialCost: 500000, laborCost: 200000, vatRate: 0 },
) {
  const response = await request.patch(`/api/work-orders/${orderId}`, { data: costs });
  await expectOk(response);
}

export async function changeStatus(
  request: APIRequestContext,
  orderId: string,
  status: string,
  extra?: Record<string, unknown>,
) {
  const response = await request.post(`/api/work-orders/${orderId}/status`, {
    data: { status, ...extra },
  });
  await expectOk(response);
}

export function signatureDataUrl() {
  return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lQS8wQAAAABJRU5ErkJggg==";
}

export async function cleanupWorld(
  world: E2EWorld,
  adminRequest: APIRequestContext | null,
) {
  if (adminRequest) {
    for (const orderId of world.orderIds) {
      const detailResponse = await adminRequest.get(`/api/work-orders/${orderId}`);
      if (!detailResponse.ok()) continue;
      const detail = await detailResponse.json() as WorkOrderDetailResponse;
      for (const file of detail.files) {
        await adminRequest.delete(`/api/work-orders/${orderId}/files/${file.id}`);
      }
    }
  }

  const pool = makePool();
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query("begin");

    for (const orderId of world.orderIds) {
      const orderGuard = await client.query<{ internal_note: string | null }>(
        "select internal_note from work_orders where id = $1",
        [orderId],
      );
      const internalNote = orderGuard.rows[0]?.internal_note ?? "";
      if (!internalNote.startsWith(world.runId)) continue;

      await client.query("delete from notifications where work_order_id = $1", [orderId]);
      await client.query("delete from work_order_files where work_order_id = $1", [orderId]);
      await client.query("delete from work_order_materials where work_order_id = $1", [orderId]);
      await client.query("delete from work_order_status_history where work_order_id = $1", [orderId]);
      await client.query("delete from work_order_assignments where work_order_id = $1", [orderId]);
      await client.query("delete from payment_transactions where work_order_id = $1", [orderId]);
      await client.query("delete from payments where work_order_id = $1", [orderId]);
      await client.query("delete from work_orders where id = $1", [orderId]);
    }

    for (const customerId of world.customerIds) {
      const customerGuard = await client.query<{ name: string }>(
        "select name from customers where id = $1",
        [customerId],
      );
      if (!customerGuard.rows[0]?.name.startsWith(world.runId)) continue;
      await client.query("delete from customer_contacts where customer_id = $1", [customerId]);
      await client.query("delete from customers where id = $1", [customerId]);
    }

    for (const user of Object.values(world.users)) {
      if (!user || !user.fullName.startsWith(world.runId)) continue;
      await client.query("delete from notifications where user_id = $1", [user.id]);
      await client.query("delete from push_subscriptions where user_id = $1", [user.id]);
      await client.query("delete from technicians where user_id = $1", [user.id]);
      await client.query("delete from users where id = $1", [user.id]);
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

export async function closeContexts(contexts: BrowserContext[]) {
  for (const context of contexts) {
    await context.close();
  }
}
