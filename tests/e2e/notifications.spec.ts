import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { Pool } from "pg";

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const technicianEmail = process.env.E2E_TECHNICIAN_EMAIL;
const sharedPassword = process.env.E2E_SHARED_PASSWORD;
const databaseUrl = process.env.DATABASE_URL;

test("cron Push từ chối request không có secret", async ({ request }) => {
  const response = await request.get("/api/cron/push");
  expect(response.status()).toBe(401);
});

test("bấm Push ưu tiên app đang mở và fallback mở ứng dụng", async ({ request }) => {
  const response = await request.get("/sw.js");
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["cache-control"]).toBe("no-cache, no-store, must-revalidate");

  const serviceWorker = await response.text();
  expect(serviceWorker).toContain('self.addEventListener("notificationclick"');
  expect(serviceWorker).toContain("event.notification.close()");
  expect(serviceWorker).toContain("bestClientForNotification");
  expect(serviceWorker).toContain("OPEN_NOTIFICATION_TARGET");
  expect(serviceWorker).toContain("openWindow");
  expect(serviceWorker).toContain(".focus()");
});

async function login(page: Page, identifier: string, password: string) {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Email hoặc số điện thoại" }).fill(identifier);
  await page.getByLabel("Mật khẩu").fill(password);
  const responsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/api/auth/login")
      && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  expect((await responsePromise).ok()).toBeTruthy();
}

test.describe.serial("Thông báo và đăng ký Web Push", () => {
  let adminContext: BrowserContext;
  let technicianContext: BrowserContext;
  let pool: Pool;
  let adminUserId: string;
  let notificationId: string | null = null;
  let subscriptionEndpoint: string | null = null;

  test.beforeAll(async ({ browser }) => {
    test.skip(
      !adminEmail || !technicianEmail || !sharedPassword || !databaseUrl,
      "Thiếu biến môi trường E2E hoặc DATABASE_URL",
    );
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl!.includes("localhost") || databaseUrl!.includes("127.0.0.1")
        ? undefined
        : { rejectUnauthorized: false },
    });
    const userResult = await pool.query<{ id: string }>(
      "select id from users where lower(email) = lower($1) limit 1",
      [adminEmail],
    );
    adminUserId = userResult.rows[0]?.id;
    expect(adminUserId, "Không tìm thấy admin E2E").toBeTruthy();
    adminContext = await browser.newContext();
    technicianContext = await browser.newContext();
  });

  test.afterAll(async () => {
    if (notificationId) {
      await pool.query("delete from notifications where id = $1", [notificationId]);
    }
    if (subscriptionEndpoint) {
      await pool.query("delete from push_subscriptions where endpoint = $1", [subscriptionEndpoint]);
    }
    if (adminContext) await adminContext.close();
    if (technicianContext) await technicianContext.close();
    if (pool) await pool.end();
  });

  test("tài khoản khác không thể vô hiệu hóa subscription của admin", async () => {
    subscriptionEndpoint = `https://push.example.test/${Date.now()}`;
    const adminPage = await adminContext.newPage();
    await login(adminPage, adminEmail!, sharedPassword!);

    const createResponse = await adminPage.request.post("/api/push-subscriptions", {
      data: {
        endpoint: subscriptionEndpoint,
        keys: { p256dh: "e2e-p256dh", auth: "e2e-auth" },
        deviceName: "E2E admin",
      },
    });
    expect(createResponse.status(), await createResponse.text()).toBe(201);

    const technicianPage = await technicianContext.newPage();
    await login(technicianPage, technicianEmail!, sharedPassword!);
    const deleteResponse = await technicianPage.request.delete("/api/push-subscriptions", {
      data: { endpoint: subscriptionEndpoint },
    });
    expect(deleteResponse.ok(), await deleteResponse.text()).toBeTruthy();

    const result = await pool.query<{ user_id: string; disabled_at: string | null }>(
      "select user_id, disabled_at from push_subscriptions where endpoint = $1",
      [subscriptionEndpoint],
    );
    expect(result.rows[0].user_id).toBe(adminUserId);
    expect(result.rows[0].disabled_at).toBeNull();
  });

  test("mở trang Thông báo tự đánh dấu các thông báo hiện có là đã đọc", async () => {
    const inserted = await pool.query<{ id: string }>(
      `insert into notifications (user_id, type, priority, title, body)
       values ($1, 'e2e_auto_read', 'normal', 'E2E tự đánh dấu đã đọc', 'Thông báo kiểm thử')
       returning id`,
      [adminUserId],
    );
    notificationId = inserted.rows[0].id;

    const adminPage = await adminContext.newPage();
    await login(adminPage, adminEmail!, sharedPassword!);
    const readResponsePromise = adminPage.waitForResponse(
      (response) => response.url().endsWith("/api/notifications")
        && response.request().method() === "PATCH",
    );
    await adminPage.goto("/notifications");
    expect((await readResponsePromise).ok()).toBeTruthy();
    await expect(adminPage.getByText("E2E tự đánh dấu đã đọc")).toBeVisible();

    await expect.poll(async () => {
      const result = await pool.query<{ read_at: string | null }>(
        "select read_at from notifications where id = $1",
        [notificationId],
      );
      return result.rows[0]?.read_at;
    }).not.toBeNull();
  });
});
