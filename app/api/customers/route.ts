import { requireUser } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { handleRouteError, jsonCreated, jsonOk } from "@/lib/http";
import { createCustomerSchema } from "@/lib/validators";

export const runtime = "nodejs";

const customerSelect = `
  select c.id, c.name, c.phone, c.address, c.address_note, c.created_at,
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
    await requireUser(["admin", "dispatcher", "accountant"]);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("q")?.trim() ?? "";

    const result = await query(
      `${customerSelect}
       where $1 = ''
          or c.name ilike '%' || $1 || '%'
          or c.phone ilike '%' || $1 || '%'
          or exists (
            select 1
            from customer_contacts cc
            where cc.customer_id = c.id
              and (cc.name ilike '%' || $1 || '%' or cc.phone ilike '%' || $1 || '%')
          )
       order by c.created_at desc
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

    const customer = await withTransaction(async (client) => {
      const result = await client.query(
        `insert into customers (name, phone, address, address_note, created_by)
         values ($1, $2, $3, $4, $5)
         returning id`,
        [body.name, body.phone, body.address, body.addressNote, user.id],
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
