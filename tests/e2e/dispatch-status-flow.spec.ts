import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import {
  adminEmail,
  adminPassword,
  changeStatus,
  cleanupWorld,
  closeContexts,
  createCustomer,
  createRoleUser,
  createWorkOrder,
  createWorld,
  databaseUrl,
  e2ePassword,
  expectOk,
  expectStatus,
  getWorkOrderDetail,
  newLoggedInPage,
  roleLabels,
  setCosts,
  signatureDataUrl,
  type E2EUser,
  type E2EWorld,
} from "./e2e-helpers";

async function createCustomUser(
  adminPage: Page,
  world: E2EWorld,
  role: "technician" | "team_lead",
  suffix: string
): Promise<E2EUser> {
  const userResponse = await adminPage.request.post("/api/users", {
    data: {
      fullName: `${world.runId} ${roleLabels[role]} ${suffix}`,
      email: `${world.runSlug}-${role}-${suffix.toLowerCase()}@example.com`,
      password: e2ePassword,
      role,
      status: "active",
      technician: { serviceArea: `${world.runId} service area`, status: "available" },
    },
  });
  await expectOk(userResponse);
  const payload = await userResponse.json() as {
    user: {
      id: string;
      email: string;
      role: any;
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

  (world.users as any)[`${role}_${suffix}`] = user;
  return user;
}

test.describe.serial("Giao nhận công việc, chuyển trạng thái và hoàn tất nâng cao", () => {
  let world: E2EWorld;
  let browserRef: Browser;
  let adminContext: BrowserContext;
  let adminPage: Page;
  const contexts: BrowserContext[] = [];

  let techA: E2EUser;
  let techB: E2EUser;
  let techC: E2EUser;
  let leadA: E2EUser;
  let accountant: E2EUser;

  test.beforeAll(async ({ browser }) => {
    test.skip(!adminEmail || !adminPassword || !databaseUrl, "Thiếu cấu hình admin E2E hoặc DATABASE_URL");
    browserRef = browser;
    world = createWorld();

    adminContext = await browser.newContext();
    contexts.push(adminContext);
    adminPage = await adminContext.newPage();
    await newLoggedInPage(browser, adminEmail, adminPassword, roleLabels.admin).then(async (session) => {
      await adminContext.close();
      contexts.pop();
      adminContext = session.context;
      adminPage = session.page;
      contexts.push(adminContext);
    });

    // Tạo các tài khoản dùng chung
    accountant = await createRoleUser(adminPage.request, world, "accountant");
    techA = await createRoleUser(adminPage.request, world, "technician");
    leadA = await createRoleUser(adminPage.request, world, "team_lead");

    // Tạo thêm tài khoản bổ sung
    techB = await createCustomUser(adminPage, world, "technician", "B");
    techC = await createCustomUser(adminPage, world, "technician", "C");
  });

  test.afterAll(async () => {
    await cleanupWorld(world, adminPage?.request ?? null);
    await closeContexts(contexts);
  });

  async function login(page: Page, identifier: string, password: string, roleLabel?: string) {
    await page.goto("/");
    await page.getByRole("textbox", { name: "Email hoặc số điện thoại" }).fill(identifier);
    await page.getByLabel("Mật khẩu").fill(password);
    const responsePromise = page.waitForResponse(
      (response) => response.url().endsWith("/api/auth/login") && response.request().method() === "POST"
    );
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    const response = await responsePromise;
    expect(response.ok(), await response.text()).toBeTruthy();
    if (roleLabel) {
      await expect(page.getByText(roleLabel, { exact: true }).first()).toBeVisible();
    }
  }

  test("1. Phân công cho nhiều kỹ thuật viên, phối hợp thực hiện và hoàn tất", async () => {
    // Admin tạo công việc và gán cho Tech A & Tech B
    await adminPage.goto("/orders");
    await adminPage.getByRole("button", { name: "Tạo công việc" }).click();
    await adminPage.locator('input[name="customerName"]').fill(`${world.runId} Multi Tech Customer`);
    await adminPage.locator('input[name="customerPhone"]').fill(`09${String(Date.now()).slice(-8)}`);
    await adminPage.locator('input[name="customerAddress"]').fill("123 Phố Huế, Hai Bà Trưng, Hà Nội");
    await adminPage.locator('input[name="addressNote"]').fill("Tầng 3");
    await adminPage.locator('select[name="type"]').selectOption("installation");
    await adminPage.locator('select[name="priority"]').selectOption("normal");
    
    // Gán Tech A và Tech B
    await adminPage.getByRole("button", { name: "Chưa phân công" }).click();
    await adminPage.getByRole("group", { name: "Kỹ thuật viên phân công" })
                  .getByRole("checkbox", { name: new RegExp("^" + techA.fullName + "\\s+Rảnh") })
                  .check();
    await adminPage.getByRole("group", { name: "Kỹ thuật viên phân công" })
                  .getByRole("checkbox", { name: new RegExp("^" + techB.fullName + "\\s+Rảnh") })
                  .check();
    await adminPage.getByRole("button", { name: "Xong" }).click();
    await adminPage.locator('textarea[name="description"]').fill("Lắp đặt 3 camera Hikvision E2E");
    
    // Ghi chú nội bộ chứa world.runId để cleanupWorld có thể dọn dẹp phiếu và assignments liên kết
    await adminPage.locator('input[name="internalNote"]').fill(`${world.runId} multi-tech`);

    const createOrderPromise = adminPage.waitForResponse(
      (response) => response.url().endsWith("/api/work-orders") && response.request().method() === "POST"
    );
    await adminPage.getByRole("button", { name: "Tạo phiếu" }).click();
    const orderRes = await createOrderPromise;
    expect(orderRes.ok()).toBeTruthy();
    const orderData = await orderRes.json() as { workOrder: { id: string; code: string } };
    const orderCode = orderData.workOrder.code;
    const orderId = orderData.workOrder.id;
    world.orderIds.push(orderId);

    // Login Tech A & Tech B
    const sessionA = await newLoggedInPage(browserRef, techA.email, e2ePassword, roleLabels.technician);
    await sessionA.context.grantPermissions(["geolocation"]);
    await sessionA.context.setGeolocation({ latitude: 21.0245, longitude: 105.8412 });
    const techAPage = sessionA.page;
    contexts.push(sessionA.context);

    const sessionB = await newLoggedInPage(browserRef, techB.email, e2ePassword, roleLabels.technician);
    await sessionB.context.grantPermissions(["geolocation"]);
    await sessionB.context.setGeolocation({ latitude: 21.0245, longitude: 105.8412 });
    const techBPage = sessionB.page;
    contexts.push(sessionB.context);

    // Verify thông báo của cả 2 kỹ thuật viên
    await techAPage.goto("/notifications");
    await expect(techAPage.getByText("Bạn được giao phiếu mới").or(techAPage.getByText(orderCode))).toBeVisible();

    await techBPage.goto("/notifications");
    await expect(techBPage.getByText("Bạn được giao phiếu mới").or(techBPage.getByText(orderCode))).toBeVisible();

    // Tech A nhận việc
    await techAPage.goto("/technician");
    const orderRowA = techAPage.locator("article").filter({ hasText: orderCode });
    await expect(orderRowA).toBeVisible();
    await orderRowA.getByRole("button", { name: "Chi tiết" }).click();

    const modalA = techAPage.locator(".app-modal-sheet");
    const acceptPromise = techAPage.waitForResponse(
      (response) => response.url().includes("/status") && response.request().method() === "POST"
    );
    await modalA.getByRole("button", { name: "Nhận việc" }).click();
    await acceptPromise;

    // Check status API
    let detail = await getWorkOrderDetail(adminPage.request, orderId);
    expect(detail.workOrder.status).toBe("accepted");

    // Tech B bấm di chuyển
    await techBPage.goto("/technician");
    const orderRowB = techBPage.locator("article").filter({ hasText: orderCode });
    await expect(orderRowB).toBeVisible();
    await orderRowB.getByRole("button", { name: "Chi tiết" }).click();

    const modalB = techBPage.locator(".app-modal-sheet");
    const travelPromise = techBPage.waitForResponse(
      (response) => response.url().includes("/status") && response.request().method() === "POST"
    );
    await modalB.getByRole("button", { name: "Đang di chuyển" }).click();
    await travelPromise;

    detail = await getWorkOrderDetail(adminPage.request, orderId);
    expect(detail.workOrder.status).toBe("traveling");

    // Tech A Check-in
    await techAPage.goto("/technician");
    const orderRowA2 = techAPage.locator("article").filter({ hasText: orderCode });
    await orderRowA2.getByRole("button", { name: "Chi tiết" }).click();
    const checkinPromise = techAPage.waitForResponse(
      (response) => response.url().includes("/status") && response.request().method() === "POST"
    );
    await modalA.getByRole("button", { name: "Check-in" }).click();
    await checkinPromise;

    detail = await getWorkOrderDetail(adminPage.request, orderId);
    expect(detail.workOrder.status).toBe("working");

    // Tech B Check-in (khi phiếu đã ở làm việc)
    await techBPage.goto("/technician");
    const orderRowB2 = techBPage.locator("article").filter({ hasText: orderCode });
    await orderRowB2.getByRole("button", { name: "Chi tiết" }).click();
    const checkinPromiseB = techBPage.waitForResponse(
      (response) => response.url().includes("/status") && response.request().method() === "POST"
    );
    await modalB.getByRole("button", { name: "Check-in" }).click();
    await checkinPromiseB;

    // Cả 2 đã Check-in. Thêm chi phí vật tư và hoàn tất ở phía Tech A
    await modalA.getByRole("button", { name: "Chi phí", exact: true }).click();
    await modalA.getByRole("button", { name: "Chi tiết vật tư" }).click();

    const materialsModal = techAPage.locator(".app-modal-sheet").nth(1);
    await materialsModal.locator('input[name="name"]').fill("Camera Hikvision E2E");
    await materialsModal.locator('input[name="quantity"]').fill("3");
    await materialsModal.locator('input[name="unitPrice"]').fill("600000");
    const addMatPromise = techAPage.waitForResponse(
      (response) => response.url().includes("/materials") && response.request().method() === "POST"
    );
    await materialsModal.getByRole("button", { name: "Thêm vật tư" }).click();
    await addMatPromise;
    await materialsModal.getByRole("button", { name: "Đóng" }).click();

    await modalA.locator('input[name="laborCost"]').fill("200000");
    const saveCostPromise = techAPage.waitForResponse(
      (response) => response.url().includes(`/api/work-orders/`) && response.request().method() === "PATCH"
    );
    await modalA.getByRole("button", { name: "Lưu chi phí" }).click();
    await saveCostPromise;

    // Bấm hoàn tất xử lý
    await modalA.getByRole("button", { name: "Tiến độ", exact: true }).click();
    const completePromise = techAPage.waitForResponse(
      (response) => response.url().includes("/status") && response.request().method() === "POST"
    );
    await modalA.getByRole("button", { name: "Hoàn tất xử lý" }).click();
    await completePromise;

    detail = await getWorkOrderDetail(adminPage.request, orderId);
    expect(detail.workOrder.status).toBe("awaiting_acceptance");

    // Nghiệm thu (Tech A ký nhận)
    await modalA.getByRole("button", { name: "Nghiệm thu & TT", exact: true }).click();
    const canvas = modalA.locator("canvas");
    await expect(canvas).toBeVisible();
    await canvas.scrollIntoViewIfNeeded();
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    await techAPage.mouse.move(box!.x + 20, box!.y + 30);
    await techAPage.mouse.down();
    await techAPage.mouse.move(box!.x + 120, box!.y + 80, { steps: 8 });
    await techAPage.mouse.up();

    await modalA.getByRole("checkbox", { name: "đồng ý nghiệm thu" }).check();
    const acceptancePromise = techAPage.waitForResponse(
      (response) => response.url().includes("/acceptance") && response.request().method() === "POST"
    );
    await modalA.getByRole("button", { name: "Xác nhận" }).click();
    await acceptancePromise;

    await expect(modalA.getByText("Đã nghiệm thu:")).toBeVisible();
    await modalA.getByRole("button", { name: "Đóng" }).click();

    // Xác nhận status là completed
    detail = await getWorkOrderDetail(adminPage.request, orderId);
    expect(detail.workOrder.status).toBe("completed");

    // Kế toán đóng thanh toán tiền mặt
    const accountantSession = await newLoggedInPage(browserRef, accountant.email, e2ePassword, roleLabels.accountant);
    const accountantPage = accountantSession.page;
    contexts.push(accountantSession.context);

    await accountantPage.goto("/payments");
    await accountantPage.getByPlaceholder("Tìm mã, khách, SĐT, trạng thái...").fill(orderCode);
    const payOrderRow = accountantPage.locator("tr").filter({ hasText: `${world.runId} Multi Tech Customer` });
    await expect(payOrderRow).toBeVisible();
    await payOrderRow.getByRole("button", { name: "Xử lý thanh toán" }).click();

    const payModal = accountantPage.locator(".app-modal-sheet");
    await payModal.locator('select[name="status"]').selectOption("paid");
    await payModal.locator('select[name="method"]').selectOption("cash");
    const paymentConfirmPromise = accountantPage.waitForResponse(
      (response) => response.url().includes("/payment") && response.request().method() === "PATCH"
    );
    await payModal.getByRole("button", { name: "Xác nhận" }).click();
    await paymentConfirmPromise;

    await accountantPage.getByRole("button", { name: "Đã thanh toán" }).click();
    const paidOrderRow = accountantPage.locator("tr").filter({ hasText: `${world.runId} Multi Tech Customer` });
    await expect(paidOrderRow).toBeVisible();

    detail = await getWorkOrderDetail(adminPage.request, orderId);
    expect(detail.workOrder.status).toBe("paid");
  });

  test("2. Phân công cho trưởng nhóm và kỹ thuật viên phối hợp thực hiện", async () => {
    // Giao việc cho Lead A và Tech C bằng API
    const order = await createWorkOrder(adminPage.request, world, {
      label: "lead-tech-flow",
      technicianIds: [leadA.technicianId!, techC.technicianId!],
    });

    const sessionLead = await newLoggedInPage(browserRef, leadA.email, e2ePassword, roleLabels.team_lead);
    await sessionLead.context.grantPermissions(["geolocation"]);
    await sessionLead.context.setGeolocation({ latitude: 21.0245, longitude: 105.8412 });
    const leadPage = sessionLead.page;
    contexts.push(sessionLead.context);

    const sessionTechC = await newLoggedInPage(browserRef, techC.email, e2ePassword, roleLabels.technician);
    await sessionTechC.context.grantPermissions(["geolocation"]);
    await sessionTechC.context.setGeolocation({ latitude: 21.0245, longitude: 105.8412 });
    const techCPage = sessionTechC.page;
    contexts.push(sessionTechC.context);

    // Tech C nhận việc
    await techCPage.goto("/technician");
    const orderRowC = techCPage.locator("article").filter({ hasText: order.code });
    await expect(orderRowC).toBeVisible();
    await orderRowC.getByRole("button", { name: "Chi tiết" }).click();
    const modalC = techCPage.locator(".app-modal-sheet");
    const acceptPromise = techCPage.waitForResponse(
      (response) => response.url().includes("/status") && response.request().method() === "POST"
    );
    await modalC.getByRole("button", { name: "Nhận việc" }).click();
    await acceptPromise;

    // Lead A đi và check-in
    await leadPage.goto("/technician");
    const orderRowL = leadPage.locator("article").filter({ hasText: order.code });
    await expect(orderRowL).toBeVisible();
    await orderRowL.getByRole("button", { name: "Chi tiết" }).click();
    const modalL = leadPage.locator(".app-modal-sheet");
    const travelPromise = leadPage.waitForResponse(
      (response) => response.url().includes("/status") && response.request().method() === "POST"
    );
    await modalL.getByRole("button", { name: "Đang di chuyển" }).click();
    await travelPromise;

    const checkinPromise = leadPage.waitForResponse(
      (response) => response.url().includes("/status") && response.request().method() === "POST"
    );
    await modalL.getByRole("button", { name: "Check-in" }).click();
    await checkinPromise;

    // Tech C Check-in
    await techCPage.goto("/technician");
    await orderRowC.getByRole("button", { name: "Chi tiết" }).click();
    const checkinPromiseC = techCPage.waitForResponse(
      (response) => response.url().includes("/status") && response.request().method() === "POST"
    );
    await modalC.getByRole("button", { name: "Check-in" }).click();
    await checkinPromiseC;

    // Lead A hoàn tất xử lý và chốt chữ ký
    await leadPage.goto("/technician");
    await orderRowL.getByRole("button", { name: "Chi tiết" }).click();
    
    // Ghi nhận chi phí
    await modalL.locator(".modal-tabbar").getByRole("button", { name: "Chi phí", exact: true }).click();
    await modalL.locator('input[name="laborCost"]').fill("150000");
    const saveCostPromise = leadPage.waitForResponse(
      (response) => response.url().includes(`/api/work-orders/`) && response.request().method() === "PATCH"
    );
    await modalL.getByRole("button", { name: "Lưu", exact: true }).click();
    await saveCostPromise;

    // Hoàn tất xử lý
    await modalL.locator(".modal-tabbar").getByRole("button", { name: "Phân công", exact: true }).click();
    const completePromise = leadPage.waitForResponse(
      (response) => response.url().includes("/status") && response.request().method() === "POST"
    );
    await modalL.getByRole("button", { name: "Hoàn tất xử lý" }).click();
    await completePromise;

    // Nghiệm thu chữ ký
    await modalL.locator(".modal-tabbar").getByRole("button", { name: "Nghiệm thu", exact: true }).click();
    const canvas = modalL.locator("canvas");
    await canvas.scrollIntoViewIfNeeded();
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    await leadPage.mouse.move(box!.x + 20, box!.y + 30);
    await leadPage.mouse.down();
    await leadPage.mouse.move(box!.x + 120, box!.y + 80, { steps: 8 });
    await leadPage.mouse.up();

    await modalL.getByRole("checkbox", { name: "đồng ý nghiệm thu" }).check();
    const acceptancePromise = leadPage.waitForResponse(
      (response) => response.url().includes("/acceptance") && response.request().method() === "POST"
    );
    await modalL.getByRole("button", { name: "Xác nhận" }).click();
    await acceptancePromise;

    await modalL.getByRole("button", { name: "Đóng" }).click();

    // Verify status completed
    const detail = await getWorkOrderDetail(adminPage.request, order.id);
    expect(detail.workOrder.status).toBe("completed");
  });

  test("3. Kiểm tra tính hợp lệ của các trạng thái rời rạc và các ràng buộc sau hoàn thành", async () => {
    const order = await createWorkOrder(adminPage.request, world, {
      label: "isolated-validation",
      technicianIds: [techA.technicianId!],
    });

    const sessionA = await newLoggedInPage(browserRef, techA.email, e2ePassword, roleLabels.technician);
    const techAPage = sessionA.page;
    contexts.push(sessionA.context);

    // 1. Chặn nhảy trạng thái trái quy trình (assigned -> awaiting_acceptance trực tiếp)
    const invalidJump = await techAPage.request.post(`/api/work-orders/${order.id}/status`, {
      data: {
        status: "awaiting_acceptance",
      },
    });
    await expectStatus(invalidJump, 422);

    // Cho phép đi tiếp tuần tự: nhận việc -> đi
    await changeStatus(techAPage.request, order.id, "accepted");
    await changeStatus(techAPage.request, order.id, "traveling");

    // 2. Chấp nhận stale status update nhưng không quay lùi trạng thái (traveling -> working, sau đó gửi lại accepted)
    await changeStatus(techAPage.request, order.id, "working", {
      checkInLat: 21.0245,
      checkInLng: 105.8412,
    });

    // Gửi sự kiện accepted cũ (stale update)
    const staleAccepted = await techAPage.request.post(`/api/work-orders/${order.id}/status`, {
      data: { status: "accepted", note: "Bấm nhầm lúc mạng chậm" },
    });
    await expectOk(staleAccepted);

    // Trạng thái phiếu vẫn là working
    let detail = await getWorkOrderDetail(adminPage.request, order.id);
    expect(detail.workOrder.status).toBe("working");

    // 3. Hoàn tất phiếu qua nghiệm thu
    await changeStatus(techAPage.request, order.id, "awaiting_acceptance");
    const acceptRes = await techAPage.request.post(`/api/work-orders/${order.id}/acceptance`, {
      data: {
        acceptanceName: `${world.runId} validation signer`,
        signatureDataUrl: signatureDataUrl(),
        agreed: true,
      },
    });
    await expectOk(acceptRes);

    detail = await getWorkOrderDetail(adminPage.request, order.id);
    expect(detail.workOrder.status).toBe("completed");

    // 4. Chặn sửa đổi phân công (assign) sau khi phiếu đã hoàn tất
    const blockAssign = await adminPage.request.post(`/api/work-orders/${order.id}/assign`, {
      data: {
        technicianIds: [techB.technicianId!],
        note: "Giao thêm kỹ thuật sau chốt",
      },
    });
    await expectStatus(blockAssign, 422);

    // 5. Chặn kỹ thuật thêm/sửa chi phí sau khi đã hoàn tất
    const blockMaterial = await techAPage.request.post(`/api/work-orders/${order.id}/materials`, {
      data: {
        name: "Vật tư phát sinh sau chốt",
        quantity: 1,
        unitPrice: 100000,
      },
    });
    await expectStatus(blockMaterial, 403);
  });
});
