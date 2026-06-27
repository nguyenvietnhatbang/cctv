import { expect, test, type BrowserContext, type Page } from "@playwright/test";
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
  login,
  newLoggedInPage,
  roleLabels,
  roleTabs,
  setCosts,
  signatureDataUrl,
  type E2ERole,
  type E2EUser,
  type E2EWorld,
} from "./e2e-helpers";

const allTabLabels: string[] = [...new Set(Object.values(roleTabs).flat())];

async function expectSidebarForRole(page: Page, role: E2ERole) {
  const sidebar = page.locator("aside.app-sidebar");
  await expect(sidebar).toBeVisible();
  for (const label of roleTabs[role]) {
    const linkName: string | RegExp = label === "Thông báo" ? /^Thông báo(?:\s+\d+)?$/ : label;
    await expect(sidebar.getByRole("link", { name: linkName, exact: label !== "Thông báo" })).toBeVisible();
  }
  const visibleLabels = new Set<string>(roleTabs[role]);
  for (const label of allTabLabels.filter((item) => !visibleLabels.has(item))) {
    await expect(sidebar.getByRole("link", { name: label, exact: true })).toHaveCount(0);
  }
}

test.describe.serial("Full regression theo role", () => {
  let world: E2EWorld;
  let adminContext: BrowserContext;
  let adminPage: Page;
  const contexts: BrowserContext[] = [];

  async function loginGeneratedRole(role: Exclude<E2ERole, "admin">) {
    const user = world.users[role];
    expect(user, `Thiếu user E2E cho role ${role}`).toBeTruthy();
    const session = await newLoggedInPage(adminPage.context().browser()!, user!.email, user!.password, roleLabels[role]);
    contexts.push(session.context);
    return { ...session, user: user! };
  }

  async function requireTechnician(role: "technician" | "team_lead") {
    const user = world.users[role];
    expect(user?.technicianId, `Thiếu hồ sơ kỹ thuật viên cho ${role}`).toBeTruthy();
    return user as E2EUser & { technicianId: string };
  }

  test.beforeAll(async ({ browser }) => {
    test.skip(!adminEmail || !adminPassword || !databaseUrl, "Thiếu admin E2E hoặc DATABASE_URL để setup/cleanup an toàn");
    world = createWorld();

    adminContext = await browser.newContext();
    contexts.push(adminContext);
    adminPage = await adminContext.newPage();
    await login(adminPage, adminEmail, adminPassword, roleLabels.admin);

    for (const role of ["dispatcher", "team_lead", "technician", "accountant"] as const) {
      await createRoleUser(adminPage.request, world, role);
    }
  });

  test.afterAll(async () => {
    await cleanupWorld(world, adminPage?.request ?? null);
    await closeContexts(contexts);
  });

  test("auth-role-access: từng role đăng nhập và thấy đúng điều hướng", async ({ browser }) => {
    await expectSidebarForRole(adminPage, "admin");

    for (const role of ["dispatcher", "team_lead", "technician", "accountant"] as const) {
      const user = world.users[role]!;
      const { context, page } = await newLoggedInPage(browser, user.email, e2ePassword, roleLabels[role]);
      contexts.push(context);
      await expectSidebarForRole(page, role);

      const meResponse = await page.request.get("/api/auth/me");
      await expectOk(meResponse);
      const me = await meResponse.json() as { user: { role: E2ERole; email: string } };
      expect(me.user.role).toBe(role);
      expect(me.user.email).toBe(user.email);
    }
  });

  test("admin-management: admin quản lý user, kỹ thuật viên và khách hàng E2E", async () => {
    await adminPage.goto("/users");
    await expect(adminPage.getByRole("heading", { name: "Nhân viên" })).toBeVisible();
    await expect(adminPage.getByText(world.users.dispatcher!.fullName)).toBeVisible();

    const technician = await requireTechnician("technician");
    const technicianUpdate = await adminPage.request.patch(`/api/technicians/${technician.technicianId}`, {
      data: { serviceArea: `${world.runId} updated area`, status: "available" },
    });
    await expectOk(technicianUpdate);

    await adminPage.goto("/technicians");
    await expect(adminPage.getByText(technician.fullName)).toBeVisible();
    await expect(adminPage.getByText(`${world.runId} updated area`)).toBeVisible();

    const customer = await createCustomer(adminPage.request, world, "admin-management");
    const updateCustomer = await adminPage.request.patch(`/api/customers/${customer.id}`, {
      data: {
        name: `${world.runId} customer admin updated`,
        phone: `08${String(Date.now()).slice(-8)}`,
        address: `${world.runId} updated address`,
      },
    });
    await expectOk(updateCustomer);

    await adminPage.goto("/customers");
    await expect(adminPage.getByText(`${world.runId} customer admin updated`)).toBeVisible();
  });

  test("dispatcher-flow: điều phối tạo phiếu, phân công, và tạo notification", async () => {
    const { page } = await loginGeneratedRole("dispatcher");
    const technician = await requireTechnician("technician");

    const customer = await createCustomer(page.request, world, "dispatcher-flow");
    const order = await createWorkOrder(page.request, world, {
      customerId: customer.id,
      label: "dispatcher-unassigned",
    });

    const detailBeforeAssign = await getWorkOrderDetail(page.request, order.id);
    expect(detailBeforeAssign.workOrder.status).toBe("pending_assignment");

    const assignResponse = await page.request.post(`/api/work-orders/${order.id}/assign`, {
      data: {
        technicianIds: [technician.technicianId],
        note: `${world.runId} dispatcher assign`,
      },
    });
    await expectOk(assignResponse);

    const detailAfterAssign = await getWorkOrderDetail(page.request, order.id);
    expect(detailAfterAssign.workOrder.status).toBe("assigned");

    await page.goto("/dispatch");
    await expect(page.getByText(order.code)).toBeVisible();

    const { page: technicianPage } = await loginGeneratedRole("technician");
    await technicianPage.goto("/notifications");
    await expect(technicianPage.getByText("Bạn được giao phiếu mới").or(technicianPage.getByText(order.code))).toBeVisible();
  });

  test("team-lead-flow: trưởng nhóm vừa điều phối vừa xử lý hiện trường", async () => {
    const { page, user } = await loginGeneratedRole("team_lead");
    expect(user.technicianId).toBeTruthy();

    const canCreateCustomer = await page.request.post("/api/customers", {
      data: {
        name: `${world.runId} customer team lead create`,
        phone: `07${String(Date.now()).slice(-8)}`,
        address: `${world.runId} team lead address`,
      },
    });
    await expectOk(canCreateCustomer);
    const createdCustomer = await canCreateCustomer.json() as { customer: { id: string } };
    world.customerIds.push(createdCustomer.customer.id);

    const order = await createWorkOrder(adminPage.request, world, {
      label: "team-lead-field",
      technicianIds: [user.technicianId!],
      priority: "urgent",
    });
    await setCosts(adminPage.request, order.id, { materialCost: 300000, laborCost: 150000, vatRate: 10 });

    await changeStatus(page.request, order.id, "accepted");
    await changeStatus(page.request, order.id, "traveling");
    await changeStatus(page.request, order.id, "working", {
      checkInLat: 21.0245,
      checkInLng: 105.8412,
    });

    const materialResponse = await page.request.post(`/api/work-orders/${order.id}/materials`, {
      data: { name: `${world.runId} material team lead`, quantity: 1, unitPrice: 125000 },
    });
    await expectOk(materialResponse);
    const materialPayload = await materialResponse.json() as { material: { id: string } };
    world.materialIds.push(materialPayload.material.id);

    await changeStatus(page.request, order.id, "awaiting_acceptance");
    const detail = await getWorkOrderDetail(page.request, order.id);
    expect(detail.workOrder.status).toBe("awaiting_acceptance");
    expect(Number(detail.materials[0].line_total)).toBe(125000);

    await page.goto("/technician");
    await expect(page.getByText(order.code)).toBeVisible();
  });

  test("technician-field-flow và accountant-payment-flow: hiện trường, nghiệm thu, công nợ, thu nợ", async () => {
    const { page: technicianPage, user: technician } = await loginGeneratedRole("technician");
    const { page: accountantPage } = await loginGeneratedRole("accountant");
    expect(technician.technicianId).toBeTruthy();

    const order = await createWorkOrder(adminPage.request, world, {
      label: "technician-accountant",
      technicianIds: [technician.technicianId!],
    });
    await setCosts(adminPage.request, order.id, { materialCost: 500000, laborCost: 200000, vatRate: 0 });

    await changeStatus(technicianPage.request, order.id, "accepted");
    await changeStatus(technicianPage.request, order.id, "traveling");
    await changeStatus(technicianPage.request, order.id, "working", {
      checkInLat: 21.0245,
      checkInLng: 105.8412,
    });

    await technicianPage.goto("/technician");
    await expect(technicianPage.getByText(order.code)).toBeVisible();

    const materialResponse = await technicianPage.request.post(`/api/work-orders/${order.id}/materials`, {
      data: { name: `${world.runId} material technician`, quantity: 2, unitPrice: 180000 },
    });
    await expectOk(materialResponse);
    const materialPayload = await materialResponse.json() as { material: { id: string } };
    world.materialIds.push(materialPayload.material.id);

    await changeStatus(technicianPage.request, order.id, "awaiting_acceptance");

    const acceptanceResponse = await technicianPage.request.post(`/api/work-orders/${order.id}/acceptance`, {
      data: {
        acceptanceName: `${world.runId} acceptance signer`,
        acceptancePhone: "0900000000",
        signatureDataUrl: signatureDataUrl(),
        agreed: true,
        payment: {
          status: "debt",
          method: "debt",
          amount: 0,
          debtDueDate: "2026-07-15",
          note: `${world.runId} field debt`,
        },
      },
    });
    await expectOk(acceptanceResponse);

    const acceptedDetail = await getWorkOrderDetail(technicianPage.request, order.id);
    expect(acceptedDetail.workOrder.status).toBe("debt");
    expect(acceptedDetail.workOrder.payment_status).toBe("debt");
    expect(Number(acceptedDetail.workOrder.debt_amount)).toBe(700000);

    await accountantPage.goto("/payments");
    await accountantPage.getByRole("button", { name: "Công nợ", exact: true }).click();
    await expect(accountantPage.getByText(order.code)).toBeVisible();

    const paymentResponse = await accountantPage.request.patch(`/api/work-orders/${order.id}/payment`, {
      data: {
        status: "paid",
        method: "bank_transfer",
        amount: 700000,
        note: `${world.runId} accountant collected debt`,
      },
    });
    await expectOk(paymentResponse);

    const paidDetail = await getWorkOrderDetail(accountantPage.request, order.id);
    expect(paidDetail.workOrder.status).toBe("paid");
    expect(paidDetail.workOrder.payment_status).toBe("paid");
    expect(Number(paidDetail.workOrder.paid_amount)).toBe(700000);
    expect(paidDetail.paymentTransactions.length).toBeGreaterThan(0);
  });

  test("negative-permissions: role bị chặn đúng quyền", async () => {
    const { page: dispatcherPage } = await loginGeneratedRole("dispatcher");
    const { page: accountantPage } = await loginGeneratedRole("accountant");
    const { page: technicianPage, user: technician } = await loginGeneratedRole("technician");
    const teamLead = await requireTechnician("team_lead");

    await expectStatus(await dispatcherPage.request.get("/api/users"), 403);
    await expectStatus(await accountantPage.request.post("/api/customers", {
      data: {
        name: `${world.runId} forbidden customer`,
        phone: `06${String(Date.now()).slice(-8)}`,
        address: `${world.runId} forbidden address`,
      },
    }), 403);

    const orderForTeamLead = await createWorkOrder(adminPage.request, world, {
      label: "not-assigned-to-technician",
      technicianIds: [teamLead.technicianId],
    });
    await expectStatus(await technicianPage.request.get(`/api/work-orders/${orderForTeamLead.id}`), 403);

    const orderForTechnician = await createWorkOrder(adminPage.request, world, {
      label: "accountant-no-field-edit",
      technicianIds: [technician.technicianId!],
    });
    await expectStatus(await accountantPage.request.post(`/api/work-orders/${orderForTechnician.id}/materials`, {
      data: { name: `${world.runId} forbidden material`, quantity: 1, unitPrice: 1 },
    }), 403);
    await expectStatus(await accountantPage.request.post(`/api/work-orders/${orderForTechnician.id}/status`, {
      data: { status: "cancelled", note: `${world.runId} accountant cannot cancel` },
    }), 403);
  });

  test("exceptions-validation: dữ liệu sai và thao tác sau khóa bị chặn", async () => {
    const { page: dispatcherPage } = await loginGeneratedRole("dispatcher");
    const { page: technicianPage, user: technician } = await loginGeneratedRole("technician");
    expect(technician.technicianId).toBeTruthy();

    await expectStatus(await dispatcherPage.request.post("/api/work-orders", {
      data: {
        type: "maintenance_repair",
        priority: "normal",
        description: `${world.runId} missing customer`,
      },
    }), 422);

    const order = await createWorkOrder(adminPage.request, world, {
      label: "exceptions",
      technicianIds: [technician.technicianId!],
    });
    await setCosts(adminPage.request, order.id, { materialCost: 100000, laborCost: 100000, vatRate: 0 });

    await changeStatus(technicianPage.request, order.id, "accepted");
    await changeStatus(technicianPage.request, order.id, "traveling");

    const rejectedCheckIn = await technicianPage.request.post(`/api/work-orders/${order.id}/status`, {
      data: { status: "working", checkInLat: 21.5, checkInLng: 105.5 },
    });
    await expectStatus(rejectedCheckIn, 422);

    await changeStatus(technicianPage.request, order.id, "working", {
      checkInLat: 21.5,
      checkInLng: 105.5,
      updateCustomerLocation: true,
    });

    const invalidMaterial = await technicianPage.request.post(`/api/work-orders/${order.id}/materials`, {
      data: { name: `${world.runId} invalid material`, quantity: 0, unitPrice: 1 },
    });
    await expectStatus(invalidMaterial, 422);

    const invalidPayment = await technicianPage.request.patch(`/api/work-orders/${order.id}/payment`, {
      data: { status: "paid", method: "bank_transfer", amount: 999999999 },
    });
    await expectStatus(invalidPayment, 422);

    await changeStatus(technicianPage.request, order.id, "awaiting_acceptance");
    await expectOk(await technicianPage.request.post(`/api/work-orders/${order.id}/acceptance`, {
      data: {
        acceptanceName: `${world.runId} locked signer`,
        signatureDataUrl: signatureDataUrl(),
        agreed: true,
      },
    }));

    const lockedMaterial = await technicianPage.request.post(`/api/work-orders/${order.id}/materials`, {
      data: { name: `${world.runId} locked material`, quantity: 1, unitPrice: 1 },
    });
    await expectStatus(lockedMaterial, 403);

    const deleteProcessedOrder = await adminPage.request.delete(`/api/work-orders/${order.id}`);
    await expectStatus(deleteProcessedOrder, 422);
  });
});
