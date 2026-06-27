import { requireUser } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { handleRouteError, HttpError, jsonCreated, jsonOk } from "@/lib/http";
import { BACK_OFFICE_ROLES, OPS_MANAGER_ROLES } from "@/lib/types";
import { createCustomerSchema } from "@/lib/validators";

export const runtime = "nodejs";

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

function normalizeContacts(body: { name: string; phone: string; contacts?: Array<{ name: string; phone: string; note: string | null }> }) {
  const contacts = body.contacts?.length ? body.contacts : [{ name: body.name, phone: body.phone, note: null }];
  return contacts.map((contact, index) => ({ ...contact, isPrimary: index === 0 }));
}

export async function GET(request: Request) {
  try {
    await requireUser(BACK_OFFICE_ROLES);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("q")?.trim() ?? "";
    const pageParam = searchParams.get("page");
    const pageSizeParam = searchParams.get("pageSize");
    const limitParam = searchParams.get("limit");
    const page = pageParam ? Number(pageParam) : 1;
    const limit = pageSizeParam ? Number(pageSizeParam) : limitParam ? Number(limitParam) : 500;
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
      throw new HttpError(422, "Giới hạn danh sách khách hàng không hợp lệ");
    }
    if (!Number.isInteger(page) || page < 1) {
      throw new HttpError(422, "Trang danh sách khách hàng không hợp lệ");
    }
    const offset = pageSizeParam || pageParam ? (page - 1) * limit : 0;

    const result = await query(
      `${customerSelect}
       where $1 = ''
          or c.name ilike '%' || $1 || '%'
          or c.phone ilike '%' || $1 || '%'
          or c.address ilike '%' || $1 || '%'
          or coalesce(c.address_note, '') ilike '%' || $1 || '%'
          or exists (
            select 1
            from customer_contacts cc
            where cc.customer_id = c.id
              and (cc.name ilike '%' || $1 || '%' or cc.phone ilike '%' || $1 || '%')
          )
       order by c.created_at desc
       limit $2 offset $3`,
      [search, limit, offset],
    );

    const countResult = await query<{ total: string }>(
      `select count(*)::text as total
       from customers c
       where $1 = ''
          or c.name ilike '%' || $1 || '%'
          or c.phone ilike '%' || $1 || '%'
          or c.address ilike '%' || $1 || '%'
          or coalesce(c.address_note, '') ilike '%' || $1 || '%'
          or exists (
            select 1
            from customer_contacts cc
            where cc.customer_id = c.id
              and (cc.name ilike '%' || $1 || '%' or cc.phone ilike '%' || $1 || '%')
          )`,
      [search],
    );

    const total = Number(countResult.rows[0]?.total ?? 0);
    return jsonOk({
      customers: result.rows,
      total,
      page,
      pageSize: limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(OPS_MANAGER_ROLES);
    const body = createCustomerSchema.parse(await request.json());

    const customer = await withTransaction(async (client) => {
      const result = await client.query(
        `insert into customers (name, phone, address, address_note, lat, lng, location_pinned_at, location_pinned_by, created_by)
         values ($1, $2, $3, $4, $5::numeric, $6::numeric, case when $5::numeric is not null and $6::numeric is not null then now() else null end, case when $5::numeric is not null and $6::numeric is not null then $7::uuid else null end, $7::uuid)
         returning id`,
        [body.name, body.phone, body.address, body.addressNote, body.lat ?? null, body.lng ?? null, user.id],
      );
      const customerId = result.rows[0].id;

      for (const contact of normalizeContacts(body)) {
        await client.query(
          `insert into customer_contacts (customer_id, name, phone, note, is_primary)
           values ($1, $2, $3, $4, $5)`,
          [customerId, contact.name, contact.phone, contact.note, contact.isPrimary],
        );
      }

      const customerResult = await client.query(`${customerSelect} where c.id = $1`, [customerId]);
      return customerResult.rows[0];
    });

    return jsonCreated({ customer });
  } catch (error) {
    return handleRouteError(error);
  }
}
