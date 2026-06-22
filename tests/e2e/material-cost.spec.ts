import { expect, test, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";
import { Pool } from "pg";

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const technicianEmail = process.env.E2E_TECHNICIAN_EMAIL;
const sharedPassword = process.env.E2E_SHARED_PASSWORD;
const databaseUrl = process.env.DATABASE_URL;

type WorkOrderDetailResponse = {
  workOrder: {
    id: string;
    code: string;
    status: string;
    material_amount: string;
    labor_amount: string;
    vat_amount: string;
    total_amount: string;
    paid_amount: string;
    payment_status: string;
  };
  materials: Array<{
    id: string;
    name: string;
    quantity: string;
    unit_price: string;
    line_total: string;
  }>;
  files: Array<{ id: string; purpose: string }>;
};

type CreatedFixture = {
  customerId: string;
  orderId: string;
  orderCode: string;
};

async function login(page: Page, identifier: string, password: string, roleLabel: string) {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Email hoặc số điện thoại" }).fill(identifier);
  await page.getByLabel("Mật khẩu").fill(password);
  const loginResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/api/auth/login")
      && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  const loginResponse = await loginResponsePromise;
  expect(loginResponse.ok(), await loginResponse.text()).toBeTruthy();
  await expect(page.getByText(roleLabel, { exact: true }).first()).toBeVisible();
}

async function expectOk(response: Awaited<ReturnType<APIRequestContext["fetch"]>>) {
  expect(response.ok(), await response.text()).toBeTruthy();
}

async function getDetail(request: APIRequestContext, orderId: string) {
  const response = await request.get(`/api/work-orders/${orderId}`);
  await expectOk(response);
  return response.json() as Promise<WorkOrderDetailResponse>;
}

async function createFixture(request: APIRequestContext): Promise<CreatedFixture> {
  const techniciansResponse = await request.get("/api/technicians");
  await expectOk(techniciansResponse);
  const techniciansPayload = await techniciansResponse.json() as {
    technicians: Array<{ id: string; email: string | null }>;
  };
  const technician = techniciansPayload.technicians.find(
    (item) => item.email?.toLowerCase() === technicianEmail?.toLowerCase(),
  );
  expect(technician, "Không tìm thấy hồ sơ kỹ thuật viên E2E").toBeTruthy();

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const customerResponse = await request.post("/api/customers", {
    data: {
      name: `E2E vật liệu ${suffix}`,
      phone: `09${String(Date.now()).slice(-8)}`,
      address: "1 Tràng Tiền, Hoàn Kiếm, Hà Nội",
      addressNote: "Dữ liệu kiểm thử Playwright",
      lat: 21.0245,
      lng: 105.8412,
    },
  });
  await expectOk(customerResponse);
  const customerPayload = await customerResponse.json() as { customer: { id: string } };

  const orderResponse = await request.post("/api/work-orders", {
    data: {
      customerId: customerPayload.customer.id,
      type: "maintenance_repair",
      priority: "normal",
      description: `E2E kiểm thử chi phí vật liệu cố định ${suffix}`,
      internalNote: "PLAYWRIGHT_E2E_MATERIAL_COST",
      technicianIds: [technician!.id],
    },
  });
  await expectOk(orderResponse);
  const orderPayload = await orderResponse.json() as {
    workOrder: { id: string; code: string };
  };

  return {
    customerId: customerPayload.customer.id,
    orderId: orderPayload.workOrder.id,
    orderCode: orderPayload.workOrder.code,
  };
}

async function cleanupFixture(
  adminRequest: APIRequestContext,
  fixture: CreatedFixture | null,
) {
  if (!fixture || !databaseUrl) return;

  const detailResponse = await adminRequest.get(`/api/work-orders/${fixture.orderId}`);
  if (detailResponse.ok()) {
    const detail = await detailResponse.json() as WorkOrderDetailResponse;
    for (const file of detail.files) {
      await adminRequest.delete(`/api/work-orders/${fixture.orderId}/files/${file.id}`);
    }
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1")
      ? undefined
      : { rejectUnauthorized: false },
  });
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("delete from notifications where work_order_id = $1", [fixture.orderId]);
    await client.query("delete from work_order_files where work_order_id = $1", [fixture.orderId]);
    await client.query("delete from work_order_materials where work_order_id = $1", [fixture.orderId]);
    await client.query("delete from work_order_status_history where work_order_id = $1", [fixture.orderId]);
    await client.query("delete from work_order_assignments where work_order_id = $1", [fixture.orderId]);
    await client.query("delete from payment_transactions where work_order_id = $1", [fixture.orderId]);
    await client.query("delete from payments where work_order_id = $1", [fixture.orderId]);
    await client.query("delete from work_orders where id = $1", [fixture.orderId]);
    await client.query("delete from customer_contacts where customer_id = $1", [fixture.customerId]);
    await client.query("delete from customers where id = $1", [fixture.customerId]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

test.describe.serial("Chi phí vật liệu cố định", () => {
  let adminContext: BrowserContext;
  let technicianContext: BrowserContext;
  let adminPage: Page;
  let fixture: CreatedFixture | null = null;

  test.beforeAll(async ({ browser }) => {
    test.skip(
      !adminEmail || !technicianEmail || !sharedPassword || !databaseUrl,
      "Thiếu E2E_ADMIN_EMAIL, E2E_TECHNICIAN_EMAIL, E2E_SHARED_PASSWORD hoặc DATABASE_URL",
    );
    adminContext = await browser.newContext();
    technicianContext = await browser.newContext();
  });

  test.afterAll(async () => {
    if (adminContext) {
      await cleanupFixture(adminPage?.request ?? adminContext.request, fixture);
      await adminContext.close();
    }
    if (technicianContext) await technicianContext.close();
  });

  test("chốt chi phí trước, bổ sung vật liệu sau không đổi tổng tiền và khóa sau nghiệm thu", async () => {
    adminPage = await adminContext.newPage();
    await login(adminPage, adminEmail!, sharedPassword!, "Admin");
    fixture = await createFixture(adminPage.request);

    await adminPage.goto(`/orders/${fixture.orderId}?mode=edit`);
    await expect(adminPage.getByRole("heading", { name: new RegExp(`Sửa phiếu ${fixture.orderCode}`) })).toBeVisible();
    await adminPage.getByRole("button", { name: "Chi phí" }).click();

    await adminPage.locator('input[name="materialCost"]').fill("500000");
    await adminPage.locator('input[name="laborCost"]').fill("200000");
    await adminPage.locator('input[name="vatRate"]').fill("");
    const costResponsePromise = adminPage.waitForResponse(
      (response) => response.url().endsWith(`/api/work-orders/${fixture!.orderId}`)
        && response.request().method() === "PATCH",
    );
    await adminPage.getByRole("button", { name: "Lưu", exact: true }).click();
    expect((await costResponsePromise).ok()).toBeTruthy();

    const costDetail = await getDetail(adminPage.request, fixture.orderId);
    expect(Number(costDetail.workOrder.material_amount)).toBe(500_000);
    expect(Number(costDetail.workOrder.labor_amount)).toBe(200_000);
    expect(Number(costDetail.workOrder.vat_amount)).toBe(0);
    expect(Number(costDetail.workOrder.total_amount)).toBe(700_000);

    const technicianPage = await technicianContext.newPage();
    await login(technicianPage, technicianEmail!, sharedPassword!, "Kỹ thuật");

    for (const status of ["accepted", "traveling"]) {
      const response = await technicianPage.request.post(`/api/work-orders/${fixture.orderId}/status`, {
        data: { status },
      });
      await expectOk(response);
    }
    const workingResponse = await technicianPage.request.post(`/api/work-orders/${fixture.orderId}/status`, {
      data: { status: "working", checkInLat: 21.0245, checkInLng: 105.8412 },
    });
    await expectOk(workingResponse);

    await technicianPage.goto("/technician");
    const workCard = technicianPage.locator("article").filter({ hasText: fixture.orderCode });
    await expect(workCard).toBeVisible();
    await workCard.getByRole("button", { name: "Chi tiết" }).click();
    await expect(technicianPage.getByRole("heading", { name: new RegExp(`Xử lý hiện trường ${fixture.orderCode}`) })).toBeVisible();
    await technicianPage.getByRole("button", { name: "Chi phí", exact: true }).click();
    await expect(technicianPage.locator('input[name="materialCost"]')).toHaveValue(/500/);
    await technicianPage.getByRole("button", { name: "Chi tiết vật tư" }).click();

    await expect(technicianPage.getByText("Chi phí đã chốt")).toBeVisible();
    await expect(technicianPage.getByText("Tổng vật liệu kê khai")).toBeVisible();
    await technicianPage.locator('input[name="name"]').fill("Camera E2E");
    await technicianPage.locator('input[name="quantity"]').fill("2");
    await technicianPage.locator('input[name="unitPrice"]').fill("180000");
    const materialResponsePromise = technicianPage.waitForResponse(
      (response) => response.url().endsWith(`/api/work-orders/${fixture!.orderId}/materials`)
        && response.request().method() === "POST",
    );
    await technicianPage.getByRole("button", { name: "Thêm vật tư" }).click();
    expect((await materialResponsePromise).ok()).toBeTruthy();

    const materialDetail = await getDetail(technicianPage.request, fixture.orderId);
    expect(materialDetail.materials).toHaveLength(1);
    expect(Number(materialDetail.materials[0].line_total)).toBe(360_000);
    expect(Number(materialDetail.workOrder.material_amount)).toBe(500_000);
    expect(Number(materialDetail.workOrder.total_amount)).toBe(700_000);

    const awaitingAcceptanceResponse = await technicianPage.request.post(
      `/api/work-orders/${fixture.orderId}/status`,
      { data: { status: "awaiting_acceptance" } },
    );
    await expectOk(awaitingAcceptanceResponse);

    await technicianPage.goto("/technician");
    const acceptanceCard = technicianPage.locator("article").filter({ hasText: fixture.orderCode });
    await expect(acceptanceCard).toBeVisible();
    await acceptanceCard.getByRole("button", { name: "Nghiệm thu" }).click();
    await technicianPage.getByRole("button", { name: "Nghiệm thu & TT" }).click();
    const paymentCheckbox = technicianPage.getByRole("checkbox", {
      name: /Ghi nhận thanh toán cùng lúc nghiệm thu/,
    });
    await expect(paymentCheckbox).not.toBeChecked();
    await paymentCheckbox.check();
    await technicianPage.locator('select[name="paymentStatus"]').selectOption("debt");
    const paymentAmount = technicianPage.getByLabel("Số tiền khách thanh toán");
    await paymentAmount.fill("123456");
    await expect(paymentAmount).toHaveValue("123.456");
    await paymentAmount.fill("123456,78");
    await expect(paymentAmount).toHaveValue("123.456,78");
    await technicianPage.getByRole("button", { name: "50%" }).click();
    await expect(paymentAmount).toHaveValue("350.000");
    await technicianPage.getByRole("button", { name: "Chưa thu" }).click();
    await expect(paymentAmount).toHaveValue("0");
    await technicianPage.getByRole("button", { name: "Thu đủ" }).click();
    await expect(paymentAmount).toHaveValue("700.000");
    await technicianPage.getByRole("button", { name: "Chưa thu" }).click();
    const paymentDueDate = technicianPage.getByLabel("Ngày hẹn thanh toán");
    await expect(paymentDueDate).toBeEnabled();
    await paymentDueDate.fill("2026-07-15");
    await paymentCheckbox.uncheck();

    const canvas = technicianPage.locator("canvas");
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    await technicianPage.mouse.move(box!.x + 20, box!.y + 30);
    await technicianPage.mouse.down();
    await technicianPage.mouse.move(box!.x + 120, box!.y + 80, { steps: 8 });
    await technicianPage.mouse.move(box!.x + 220, box!.y + 35, { steps: 8 });
    await technicianPage.mouse.up();
    await technicianPage.getByRole("checkbox", { name: "đồng ý nghiệm thu" }).check();
    const acceptanceResponsePromise = technicianPage.waitForResponse(
      (response) => response.url().endsWith(`/api/work-orders/${fixture!.orderId}/acceptance`)
        && response.request().method() === "POST",
    );
    await technicianPage.getByRole("button", { name: "Xác nhận" }).click();
    expect((await acceptanceResponsePromise).ok()).toBeTruthy();

    const acceptedDetail = await getDetail(technicianPage.request, fixture.orderId);
    expect(acceptedDetail.workOrder.status).toBe("completed");
    expect(acceptedDetail.workOrder.payment_status).toBe("unpaid");
    expect(Number(acceptedDetail.workOrder.paid_amount)).toBe(0);
    expect(Number(acceptedDetail.workOrder.total_amount)).toBe(700_000);

    const forbiddenMaterialResponse = await technicianPage.request.post(
      `/api/work-orders/${fixture.orderId}/materials`,
      { data: { name: "Không được thêm", quantity: 1, unitPrice: 1 } },
    );
    expect(forbiddenMaterialResponse.status()).toBe(403);

    await technicianPage.goto("/technician");
    const completedRow = technicianPage.locator("button").filter({ hasText: fixture.orderCode }).first();
    await completedRow.click();
    await technicianPage.getByRole("button", { name: "Chi phí", exact: true }).click();
    await expect(technicianPage.getByText("Chi phí đã khóa sau nghiệm thu/thanh toán.")).toBeVisible();
  });
});
