import { requireUser } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { HttpError, handleRouteError, jsonOk } from "@/lib/http";
import { createNotifications, schedulePushProcessing } from "@/lib/notifications";
import { notificationCursorSchema, notificationReadSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const cursor = notificationCursorSchema.parse({
      after: url.searchParams.get("after") || undefined,
    });
    const snapshotResult = await query<{ snapshot_at: string }>(
      "select clock_timestamp() as snapshot_at",
    );
    const snapshotAt = snapshotResult.rows[0].snapshot_at;
    const params: unknown[] = [user.id, snapshotAt];
    const cursorFilter = cursor.after
      ? `and created_at > $3::timestamptz`
      : "";
    if (cursor.after) params.push(cursor.after);

    const result = await query(
      `select id, work_order_id, type, priority, title, body, read_at, created_at
       from notifications
       where user_id = $1
         and created_at <= $2::timestamptz
         ${cursorFilter}
       order by created_at desc
       limit 60`,
      params,
    );

    return jsonOk({ notifications: result.rows, snapshotAt });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const data = await request.json();
    const { type, title, body, priority = "normal", targetUserId, targetUserIds, broadcast } = data;

    if (!title || typeof title !== "string" || !title.trim()) {
      throw new HttpError(400, "Tiêu đề thông báo không được để trống");
    }
    if (!body || typeof body !== "string" || !body.trim()) {
      throw new HttpError(400, "Nội dung thông báo không được để trống");
    }

    if (type === "feedback") {
      // Mọi role đều được gửi phản hồi tới tài khoản Dev
      const devUserResult = await query<{ id: string; email: string }>(
        `select id, email from users
         where email = 'dev@test.com'
            or (role = 'admin' and (email ilike '%dev%' or full_name ilike '%dev%'))
         order by (email = 'dev@test.com') desc
         limit 1`,
      );

      let devUserId = devUserResult.rows[0]?.id;
      if (!devUserId) {
        const adminResult = await query<{ id: string }>(
          `select id from users where role = 'admin' order by created_at asc limit 1`,
        );
        devUserId = adminResult.rows[0]?.id;
      }

      if (!devUserId) {
        throw new HttpError(404, "Không tìm thấy tài khoản Dev trong hệ thống");
      }

      const formattedTitle = `[Góp ý Dev] ${title.trim()}`;
      const formattedBody = `Người gửi: ${user.fullName} (${user.email} - Vai trò: ${user.role})\n\nNội dung:\n${body.trim()}`;

      await withTransaction(async (client) => {
        await createNotifications(client, [
          {
            userId: devUserId,
            type: "feedback",
            priority: priority === "urgent" || priority === "high" ? priority : "normal",
            title: formattedTitle,
            body: formattedBody,
          },
        ]);
      });

      schedulePushProcessing();

      return jsonOk({ ok: true, message: "Đã gửi phản hồi tới Dev thành công" });
    }

    if (type === "announcement") {
      // Chỉ tài khoản admin mới có quyền phát thông báo hệ thống
      if (user.role !== "admin") {
        throw new HttpError(403, "Chỉ tài khoản Admin mới có quyền tạo thông báo hệ thống");
      }

      const formattedTitle = `[Thông báo hệ thống] ${title.trim()}`;
      const formattedBody = `Người phát: ${user.fullName} (Admin)\n\nNội dung:\n${body.trim()}`;

      let recipientIds: string[] = [];

      if (broadcast) {
        // Gửi cho toàn bộ người dùng active trong hệ thống
        const usersResult = await query<{ id: string }>(
          `select id from users where status = 'active'`,
        );
        recipientIds = usersResult.rows.map((r) => r.id);
      } else {
        // Gửi cho danh sách người dùng cụ thể (hỗ trợ chọn nhiều người)
        if (Array.isArray(targetUserIds) && targetUserIds.length > 0) {
          recipientIds = targetUserIds.filter(
            (id) => typeof id === "string" && id.trim().length > 0,
          );
        } else if (targetUserId && typeof targetUserId === "string") {
          recipientIds = [targetUserId.trim()];
        }
      }

      if (recipientIds.length === 0) {
        throw new HttpError(400, "Vui lòng chọn ít nhất một người nhận thông báo");
      }

      // Loại bỏ trùng lặp ID
      const uniqueRecipientIds = Array.from(new Set(recipientIds));

      await withTransaction(async (client) => {
        const notifInputs = uniqueRecipientIds.map((targetId) => ({
          userId: targetId,
          type: "announcement",
          priority: (priority === "urgent" || priority === "high" ? priority : "normal") as "normal" | "high" | "urgent",
          title: formattedTitle,
          body: formattedBody,
        }));

        await createNotifications(client, notifInputs);
      });

      schedulePushProcessing();

      return jsonOk({
        ok: true,
        count: uniqueRecipientIds.length,
        message: broadcast
          ? "Đã phát thông báo toàn hệ thống thành công"
          : `Đã gửi thông báo tới ${uniqueRecipientIds.length} nhân sự thành công`,
      });
    }

    throw new HttpError(400, "Loại thông báo không hợp lệ");
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const data = await request.json();

    if (data.id) {
      await query(
        `update notifications
         set read_at = coalesce(read_at, now())
         where user_id = $1 and id = $2`,
        [user.id, data.id],
      );
      return jsonOk({ ok: true, id: data.id });
    }

    const body = notificationReadSchema.parse(data);

    await query(
      `update notifications
       set read_at = coalesce(read_at, now())
       where user_id = $1
         and read_at is null
         and created_at <= $2::timestamptz`,
      [user.id, body.readBefore],
    );

    return jsonOk({ ok: true, readBefore: body.readBefore });
  } catch (error) {
    return handleRouteError(error);
  }
}
