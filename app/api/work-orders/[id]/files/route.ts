import { randomUUID } from "crypto";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { handleRouteError, HttpError, jsonCreated } from "@/lib/http";
import { parseUuidParam } from "@/lib/route-params";
import { getMaxUploadBytes, uploadWorkOrderFile } from "@/lib/storage";
import { isPaymentManagerRole, OPS_MANAGER_ROLES } from "@/lib/types";
import { uploadPurposeSchema } from "@/lib/validators";
import { assertCanMutateFieldWork, assertCanReadWorkOrder } from "@/lib/work-orders";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

function getExtension(name: string) {
  const extension = name.split(".").pop();
  return extension ? `.${extension.toLowerCase()}` : "";
}

export async function POST(request: Request, context: Context) {
  try {
    const user = await requireUser([...OPS_MANAGER_ROLES, "technician", "accountant"]);
    const { id: rawId } = await context.params;
    const id = parseUuidParam(rawId, "Phiếu không hợp lệ");

    const formData = await request.formData();
    const file = formData.get("file");
    const purpose = uploadPurposeSchema.parse({ purpose: formData.get("purpose") }).purpose;

    if (!(file instanceof File)) {
      return Response.json({ error: "Cần chọn file" }, { status: 422 });
    }

    if (purpose === "bill") {
      if (!isPaymentManagerRole(user.role) && user.role !== "technician" && user.role !== "team_lead") {
        throw new HttpError(403, "Bạn không có quyền upload bill thanh toán");
      }
      await assertCanReadWorkOrder(user, id);
    } else {
      await assertCanMutateFieldWork(user, id);
    }

    if (file.size > getMaxUploadBytes()) {
      return Response.json({ error: "File vượt quá dung lượng cho phép" }, { status: 422 });
    }

    const path = `work-orders/${id}/${purpose}/${randomUUID()}${getExtension(file.name)}`;
    const uploaded = await uploadWorkOrderFile(path, file);

    const result = await query(
      `insert into work_order_files
         (work_order_id, bucket, path, original_name, mime_type, size_bytes, purpose, uploaded_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning id, bucket, path, original_name, mime_type, size_bytes, purpose, uploaded_at`,
      [
        id,
        uploaded.bucket,
        uploaded.path,
        file.name,
        file.type || "application/octet-stream",
        file.size,
        purpose,
        user.id,
      ],
    );

    return jsonCreated({ file: result.rows[0] });
  } catch (error) {
    return handleRouteError(error);
  }
}
