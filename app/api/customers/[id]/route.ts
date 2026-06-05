import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { handleRouteError, HttpError, jsonNoContent, jsonOk } from "@/lib/http";
import { isMockMode, mockStore } from "@/lib/mock-store";
import { createCustomerSchema } from "@/lib/validators";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: Context) {
  try {
    await requireUser(["admin", "dispatcher"]);
    const { id } = await context.params;
    const body = createCustomerSchema.partial().parse(await request.json());
    if (isMockMode()) {
      return jsonOk({ customer: mockStore.updateCustomer(id, body) });
    }

    const result = await query(
      `update customers
       set name = coalesce($2, name),
           phone = coalesce($3, phone),
           address = coalesce($4, address),
           address_note = coalesce($5, address_note)
       where id = $1
       returning id, name, phone, address, address_note`,
      [id, body.name ?? null, body.phone ?? null, body.address ?? null, body.addressNote ?? null],
    );

    if (!result.rows[0]) {
      return Response.json({ error: "Không tìm thấy khách hàng" }, { status: 404 });
    }

    return jsonOk({ customer: result.rows[0] });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    await requireUser(["admin", "dispatcher"]);
    const { id } = await context.params;
    if (isMockMode()) {
      mockStore.deleteCustomer(id);
      return jsonNoContent();
    }

    const result = await query("delete from customers where id = $1 returning id", [id]);

    if (!result.rows[0]) {
      throw new HttpError(404, "Không tìm thấy khách hàng");
    }

    return jsonNoContent();
  } catch (error) {
    return handleRouteError(error);
  }
}
