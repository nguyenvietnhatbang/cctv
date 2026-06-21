import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { handleRouteError, jsonOk } from "@/lib/http";
import { createSignedFileUrl } from "@/lib/storage";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: Context) {
  try {
    await requireUser();
    const { id } = await context.params;

    const result = await query(
      `select wo.id, wo.code, wo.type, wo.status, wo.description, 
              wo.appointment_at, wo.created_at, wo.completion_note,
              wo.internal_note, wo.cancellation_reason,
              wo.acceptance_name, wo.acceptance_phone, wo.accepted_at,
              coalesce(assn.technician_name, '') as technician_name,
              coalesce(
                (select jsonb_agg(
                  jsonb_build_object(
                    'name', name,
                    'quantity', quantity
                  )
                  order by created_at asc
                )
                from work_order_materials
                where work_order_id = wo.id),
                '[]'::jsonb
              ) as materials,
              coalesce(
                (select jsonb_agg(
                  jsonb_build_object(
                    'id', id,
                    'path', path,
                    'original_name', original_name,
                    'mime_type', mime_type,
                    'purpose', purpose
                  )
                  order by uploaded_at desc
                )
                from work_order_files
                where work_order_id = wo.id),
                '[]'::jsonb
              ) as files
       from work_orders wo
       left join lateral (
         select string_agg(u.full_name, ', ' order by u.full_name) as technician_name
         from work_order_assignments woa
         join technicians t on t.id = woa.technician_id
         join users u on u.id = t.user_id
         where woa.work_order_id = wo.id and woa.unassigned_at is null
       ) assn on true
       where wo.customer_id = $1
       order by wo.appointment_at desc nulls last, wo.created_at desc`,
      [id],
    );

    const history = await Promise.all(
      result.rows.map(async (row) => {
        const signedFiles = await Promise.all(
          (row.files || []).map(async (file: any) => {
            try {
              return {
                id: file.id,
                original_name: file.original_name,
                purpose: file.purpose,
                mime_type: file.mime_type,
                signed_url: await createSignedFileUrl(file.path),
              };
            } catch {
              return {
                id: file.id,
                original_name: file.original_name,
                purpose: file.purpose,
                mime_type: file.mime_type,
                signed_url: null,
              };
            }
          })
        );
        return {
          ...row,
          files: signedFiles,
        };
      })
    );

    return jsonOk({ history });
  } catch (error) {
    return handleRouteError(error);
  }
}

