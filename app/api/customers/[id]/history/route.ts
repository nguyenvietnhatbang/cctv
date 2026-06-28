import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { handleRouteError, HttpError, jsonOk } from "@/lib/http";
import { createSignedFileUrl } from "@/lib/storage";
import { z } from "zod";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

type HistoryFile = {
  id: string;
  path: string;
  original_name: string;
  mime_type: string;
  purpose: string;
};

export async function GET(request: Request, context: Context) {
  try {
    await requireUser();
    const { id } = await context.params;
    const parsedCustomerId = z.string().uuid().safeParse(id);
    if (!parsedCustomerId.success) {
      throw new HttpError(422, "Khách hàng không hợp lệ");
    }

    const { searchParams } = new URL(request.url);
    const pageParam = searchParams.get("page");
    const pageSizeParam = searchParams.get("pageSize");
    const limitParam = searchParams.get("limit");
    const page = pageParam ? Number(pageParam) : 1;
    const limit = pageSizeParam ? Number(pageSizeParam) : limitParam ? Number(limitParam) : 80;
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      throw new HttpError(422, "Giới hạn lịch sử khách hàng không hợp lệ");
    }
    if (!Number.isInteger(page) || page < 1) {
      throw new HttpError(422, "Trang lịch sử khách hàng không hợp lệ");
    }
    const offset = pageSizeParam || pageParam ? (page - 1) * limit : 0;

    const countResult = await query<{ total: string }>(
      `select count(*)::text as total
       from work_orders wo
       where wo.customer_id = $1`,
      [parsedCustomerId.data],
    );

    const result = await query<{ files: HistoryFile[] }>(
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
       order by wo.appointment_at desc nulls last, wo.created_at desc
       limit $2 offset $3`,
      [parsedCustomerId.data, limit, offset],
    );

    const history = await Promise.all(
      result.rows.map(async (row) => {
        const signedFiles = await Promise.all(
          (row.files || []).map(async (file) => {
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

    const total = Number(countResult.rows[0]?.total ?? 0);
    return jsonOk({
      history,
      total,
      page,
      pageSize: limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
