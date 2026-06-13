import { requireUser } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { handleRouteError, HttpError, jsonNoContent, jsonOk } from "@/lib/http";
import { createCustomerSchema } from "@/lib/validators";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

const customerSelect = `
  select c.id, c.name, c.phone, c.address, c.address_note,
         c.lat, c.lng, c.location_pinned_at, c.location_pinned_by, c.created_at,
         coalesce((
           select jsonb_agg(
             jsonb_build_object(
               'id', cc.id,
               'customer_id', cc.customer_id,
               'name', cc.name,
               'phone', cc.phone,
               'note', cc.note,
               'is_primary', cc.is_primary
             )
             order by cc.is_primary desc, cc.created_at asc
           )
           from customer_contacts cc
           where cc.customer_id = c.id
         ), '[]'::jsonb) as contacts
  from customers c
`;

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireUser(["admin", "dispatcher"]);
    const { id } = await context.params;
    const body = createCustomerSchema.partial().parse(await request.json());

    const hasLocationFields = body.lat !== undefined || body.lng !== undefined;
    const customer = await withTransaction(async (client) => {
      const result = await client.query(
        `update customers
         set name = coalesce($2, name),
             phone = coalesce($3, phone),
             address = coalesce($4, address),
             address_note = coalesce($5, address_note),
             lat = case when $6 then $7 else lat end,
             lng = case when $6 then $8 else lng end,
             location_pinned_at = case
               when $6 and $7 is not null and $8 is not null
                 and (lat is distinct from $7 or lng is distinct from $8)
               then now()
               when $6 and ($7 is null or $8 is null) then null
               else location_pinned_at
             end,
             location_pinned_by = case
               when $6 and $7 is not null and $8 is not null
                 and (lat is distinct from $7 or lng is distinct from $8)
               then $9
               when $6 and ($7 is null or $8 is null) then null
               else location_pinned_by
             end
         where id = $1
         returning id`,
        [id, body.name ?? null, body.phone ?? null, body.address ?? null, body.addressNote ?? null, hasLocationFields, body.lat ?? null, body.lng ?? null, user.id],
      );

      if (!result.rows[0]) return null;

      if (body.contacts) {
        await client.query("delete from customer_contacts where customer_id = $1", [id]);
        for (const [index, contact] of body.contacts.entries()) {
          await client.query(
            `insert into customer_contacts (customer_id, name, phone, note, is_primary)
             values ($1, $2, $3, $4, $5)`,
            [id, contact.name, contact.phone, contact.note, index === 0],
          );
        }
      }

      const customerResult = await client.query(`${customerSelect} where c.id = $1`, [id]);
      return customerResult.rows[0];
    });

    if (!customer) {
      return Response.json({ error: "Không tìm thấy khách hàng" }, { status: 404 });
    }

    return jsonOk({ customer });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    await requireUser(["admin", "dispatcher"]);
    const { id } = await context.params;

    const result = await query("delete from customers where id = $1 returning id", [id]);

    if (!result.rows[0]) {
      throw new HttpError(404, "Không tìm thấy khách hàng");
    }

    return jsonNoContent();
  } catch (error) {
    return handleRouteError(error);
  }
}
