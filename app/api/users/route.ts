import { hashPassword, requireUser } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { handleRouteError, jsonCreated, jsonOk } from "@/lib/http";
import { isMockMode, mockStore } from "@/lib/mock-store";
import { createUserSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireUser(["admin"]);
    if (isMockMode()) {
      return jsonOk({ users: mockStore.users() });
    }

    const result = await query(
      `select u.id, u.full_name, u.email, u.phone, u.role, u.status,
              t.id as technician_id, t.service_area, t.status as technician_status
       from users u
       left join technicians t on t.user_id = u.id
       order by u.created_at desc`,
    );

    return jsonOk({ users: result.rows });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireUser(["admin"]);
    const body = createUserSchema.parse(await request.json());
    if (isMockMode()) {
      return jsonCreated({ user: mockStore.createUser(body) });
    }

    const passwordHash = await hashPassword(body.password);

    const created = await withTransaction(async (client) => {
      const userResult = await client.query(
        `insert into users (full_name, email, phone, password_hash, role, status)
         values ($1, $2, $3, $4, $5, $6)
         returning id, full_name, email, phone, role, status`,
        [
          body.fullName,
          body.email || null,
          body.phone || null,
          passwordHash,
          body.role,
          body.status,
        ],
      );

      const user = userResult.rows[0];

      if (body.role === "technician" || body.technician) {
        await client.query(
          `insert into technicians (user_id, service_area, status)
           values ($1, $2, $3)`,
          [
            user.id,
            body.technician?.serviceArea ?? null,
            body.technician?.status ?? "available",
          ],
        );
      }

      return user;
    });

    return jsonCreated({ user: created });
  } catch (error) {
    return handleRouteError(error);
  }
}
