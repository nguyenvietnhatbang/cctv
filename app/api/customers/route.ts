import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { handleRouteError, jsonCreated, jsonOk } from "@/lib/http";
import { createCustomerSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireUser(["admin", "dispatcher", "accountant"]);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("q")?.trim() ?? "";

    const result = await query(
      `select id, name, phone, address, address_note, created_at
       from customers
       where $1 = ''
          or name ilike '%' || $1 || '%'
          or phone ilike '%' || $1 || '%'
       order by created_at desc
       limit 30`,
      [search],
    );

    return jsonOk({ customers: result.rows });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(["admin", "dispatcher"]);
    const body = createCustomerSchema.parse(await request.json());

    const result = await query(
      `insert into customers (name, phone, address, address_note, created_by)
       values ($1, $2, $3, $4, $5)
       returning id, name, phone, address, address_note, created_at`,
      [body.name, body.phone, body.address, body.addressNote, user.id],
    );

    return jsonCreated({ customer: result.rows[0] });
  } catch (error) {
    return handleRouteError(error);
  }
}
