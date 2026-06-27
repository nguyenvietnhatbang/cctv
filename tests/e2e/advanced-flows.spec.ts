import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import {
  adminEmail,
  adminPassword,
  changeStatus,
  cleanupWorld,
  closeContexts,
  createRoleUser,
  createWorkOrder,
  createWorld,
  databaseUrl,
  e2ePassword,
  expectOk,
  expectStatus,
  getWorkOrderDetail,
  makePool,
  newLoggedInPage,
  roleLabels,
  setCosts,
  signatureDataUrl,
  type E2EUser,
  type E2EWorld,
} from "./e2e-helpers";

test.describe.serial("Thanh toán nâng cao và trạng thái cạnh tranh", () => {
  let world: E2EWorld;
  let browserRef: Browser;
  let adminContext: BrowserContext;
  let adminPage: Page;
  const contexts: BrowserContext[] = [];

  async function loginRole(role: "dispatcher" | "team_lead" | "technician" | "accountant") {
    const user = world.users[role];
    expect(user, `Thiếu user E2E cho role ${role}`).toBeTruthy();
    const session = await newLoggedInPage(browserRef, user!.email, e2ePassword, roleLabels[role]);
    contexts.push(session.context);
    return { ...session, user: user! };
  }

  function requireTechnician(role: "team_lead" | "technician") {
    const user = world.users[role];
    expect(user?.technicianId, `Thiếu hồ sơ kỹ thuật viên cho ${role}`).toBeTruthy();
    return user as E2EUser & { technicianId: string };
  }

  async function createAcceptedOrder(label: string, total = { materialCost: 700000, laborCost: 300000, vatRate: 0 }) {
    const technician = requireTechnician("technician");
    const { page: technicianPage } = await loginRole("technician");
    const order = await createWorkOrder(adminPage.request, world, {
      label,
      technicianIds: [technician.technicianId],
    });

    await setCosts(adminPage.request, order.id, total);
    await changeStatus(technicianPage.request, order.id, "accepted");
    await changeStatus(technicianPage.request, order.id, "traveling");
    await changeStatus(technicianPage.request, order.id, "working", {
      checkInLat: 21.0245,
      checkInLng: 105.8412,
    });
    await changeStatus(technicianPage.request, order.id, "awaiting_acceptance");

    const acceptance = await technicianPage.request.post(`/api/work-orders/${order.id}/acceptance`, {
      data: {
        acceptanceName: `${world.runId} signer ${label}`,
        signatureDataUrl: signatureDataUrl(),
        agreed: true,
      },
    });
    await expectOk(acceptance);

    const completed = await getWorkOrderDetail(adminPage.request, order.id);
    expect(completed.workOrder.status).toBe("completed");
    return order;
  }

  async function getActiveAssignmentIds(orderId: string) {
    const pool = makePool();
    expect(pool, "Thiếu DATABASE_URL để kiểm tra assignment cạnh tranh").toBeTruthy();
    try {
      const result = await pool!.query<{ technician_id: string }>(
        `select technician_id
         from work_order_assignments
         where work_order_id = $1 and unassigned_at is null
         order by technician_id`,
        [orderId],
      );
      return result.rows.map((row) => row.technician_id);
    } finally {
      await pool!.end();
    }
  }

  test.beforeAll(async ({ browser }) => {
    test.skip(!adminEmail || !adminPassword || !databaseUrl, "Thiếu admin E2E hoặc DATABASE_URL");
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

    for (const role of ["dispatcher", "team_lead", "technician", "accountant"] as const) {
      await createRoleUser(adminPage.request, world, role);
    }
  });

  test.afterAll(async () => {
    await cleanupWorld(world, adminPage?.request ?? null);
    await closeContexts(contexts);
  });

  test("thu một phần nhiều lần, công nợ chỉ có ngày hẹn, chặn thu vượt và admin chỉnh chi phí sau thu một phần", async () => {
    const { page: accountantPage } = await loginRole("accountant");
    const order = await createAcceptedOrder("advanced-payment");

    const firstPartial = await accountantPage.request.patch(`/api/work-orders/${order.id}/payment`, {
      data: {
        status: "debt",
        method: "bank_transfer",
        amount: 300000,
        debtDueDate: "2026-07-15",
      },
    });
    await expectOk(firstPartial);

    let detail = await getWorkOrderDetail(accountantPage.request, order.id);
    expect(detail.workOrder.status).toBe("debt");
    expect(detail.workOrder.payment_status).toBe("debt");
    expect(Number(detail.workOrder.paid_amount)).toBe(300000);
    expect(Number(detail.workOrder.debt_amount)).toBe(700000);
    expect(detail.paymentTransactions).toHaveLength(1);

    const secondPartial = await accountantPage.request.patch(`/api/work-orders/${order.id}/payment`, {
      data: {
        status: "debt",
        method: "cash",
        amount: 200000,
        debtDueDate: "2026-08-15",
      },
    });
    await expectOk(secondPartial);

    detail = await getWorkOrderDetail(accountantPage.request, order.id);
    expect(Number(detail.workOrder.paid_amount)).toBe(500000);
    expect(Number(detail.workOrder.debt_amount)).toBe(500000);
    expect(detail.paymentTransactions).toHaveLength(2);

    const overCollect = await accountantPage.request.patch(`/api/work-orders/${order.id}/payment`, {
      data: {
        status: "paid",
        method: "cash",
        amount: 600000,
      },
    });
    await expectStatus(overCollect, 422);

    const increaseCost = await adminPage.request.patch(`/api/work-orders/${order.id}`, {
      data: {
        materialCost: 900000,
        laborCost: 300000,
        vatRate: 0,
      },
    });
    await expectOk(increaseCost);

    detail = await getWorkOrderDetail(adminPage.request, order.id);
    expect(detail.workOrder.status).toBe("debt");
    expect(detail.workOrder.payment_status).toBe("debt");
    expect(Number(detail.workOrder.total_amount)).toBe(1200000);
    expect(Number(detail.workOrder.paid_amount)).toBe(500000);
    expect(Number(detail.workOrder.debt_amount)).toBe(700000);

    const reduceBelowPaid = await adminPage.request.patch(`/api/work-orders/${order.id}`, {
      data: {
        materialCost: 100000,
        laborCost: 100000,
        vatRate: 0,
      },
    });
    await expectStatus(reduceBelowPaid, 422);
  });

  test("thao tác trạng thái cũ không kéo lùi phiếu đã tiến xa hơn", async () => {
    const technician = requireTechnician("technician");
    const { page: technicianPage } = await loginRole("technician");
    const order = await createWorkOrder(adminPage.request, world, {
      label: "stale-field-status",
      technicianIds: [technician.technicianId],
    });

    await changeStatus(technicianPage.request, order.id, "working", {
      checkInLat: 21.0245,
      checkInLng: 105.8412,
    });

    const staleAccepted = await technicianPage.request.post(`/api/work-orders/${order.id}/status`, {
      data: { status: "accepted", note: `${world.runId} stale accepted tap` },
    });
    await expectOk(staleAccepted);

    const staleTraveling = await technicianPage.request.post(`/api/work-orders/${order.id}/status`, {
      data: { status: "traveling", note: `${world.runId} stale traveling tap` },
    });
    await expectOk(staleTraveling);

    const detail = await getWorkOrderDetail(technicianPage.request, order.id);
    expect(detail.workOrder.status).toBe("working");
  });

  test("hai user đổi trạng thái gần đồng thời không làm hỏng trạng thái cuối", async () => {
    const technician = requireTechnician("technician");
    const teamLead = requireTechnician("team_lead");
    const { page: technicianPage } = await loginRole("technician");
    const { page: teamLeadPage } = await loginRole("team_lead");
    const order = await createWorkOrder(adminPage.request, world, {
      label: "concurrent-status",
      technicianIds: [technician.technicianId, teamLead.technicianId],
    });

    const acceptResponses = await Promise.all([
      technicianPage.request.post(`/api/work-orders/${order.id}/status`, {
        data: { status: "accepted", note: `${world.runId} tech accepted` },
      }),
      teamLeadPage.request.post(`/api/work-orders/${order.id}/status`, {
        data: { status: "accepted", note: `${world.runId} lead accepted` },
      }),
    ]);
    for (const response of acceptResponses) await expectOk(response);

    const advanceResponses = await Promise.all([
      technicianPage.request.post(`/api/work-orders/${order.id}/status`, {
        data: { status: "traveling", note: `${world.runId} tech traveling` },
      }),
      teamLeadPage.request.post(`/api/work-orders/${order.id}/status`, {
        data: {
          status: "working",
          note: `${world.runId} lead check-in`,
          checkInLat: 21.0245,
          checkInLng: 105.8412,
        },
      }),
    ]);
    for (const response of advanceResponses) await expectOk(response);

    const detail = await getWorkOrderDetail(adminPage.request, order.id);
    expect(detail.workOrder.status).toBe("working");
  });

  test("hai user đổi phân công gần đồng thời vẫn giữ assignment hợp lệ duy nhất", async () => {
    const technician = requireTechnician("technician");
    const teamLead = requireTechnician("team_lead");
    const { page: dispatcherPage } = await loginRole("dispatcher");
    const order = await createWorkOrder(adminPage.request, world, {
      label: "concurrent-assignment",
    });

    const assignResponses = await Promise.all([
      adminPage.request.post(`/api/work-orders/${order.id}/assign`, {
        data: {
          technicianIds: [technician.technicianId],
          note: `${world.runId} admin concurrent assign`,
        },
      }),
      dispatcherPage.request.post(`/api/work-orders/${order.id}/assign`, {
        data: {
          technicianIds: [teamLead.technicianId],
          note: `${world.runId} dispatcher concurrent assign`,
        },
      }),
    ]);
    for (const response of assignResponses) await expectOk(response);

    const detail = await getWorkOrderDetail(adminPage.request, order.id);
    expect(detail.workOrder.status).toBe("assigned");

    const activeAssignmentIds = await getActiveAssignmentIds(order.id);
    expect(activeAssignmentIds).toHaveLength(1);
    expect([technician.technicianId, teamLead.technicianId]).toContain(activeAssignmentIds[0]);
  });

  test("đổi phân công sau khi phiếu đã khóa bị chặn", async () => {
    const teamLead = requireTechnician("team_lead");
    const order = await createAcceptedOrder("locked-assignment");

    const lockedAssign = await adminPage.request.post(`/api/work-orders/${order.id}/assign`, {
      data: {
        technicianIds: [teamLead.technicianId],
        note: `${world.runId} should be blocked after acceptance`,
      },
    });
    await expectStatus(lockedAssign, 422);

    const detail = await getWorkOrderDetail(adminPage.request, order.id);
    expect(detail.workOrder.status).toBe("completed");
  });
});
