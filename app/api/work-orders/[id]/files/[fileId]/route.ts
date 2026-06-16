import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { handleRouteError, HttpError, jsonNoContent } from "@/lib/http";
import { deleteWorkOrderFile } from "@/lib/storage";
import { isPaymentManagerRole, OPS_MANAGER_ROLES, type WorkOrderStatus } from "@/lib/types";
import { assertCanMutateFieldWork } from "@/lib/work-orders";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string; fileId: string }>;
};

const LOCKED_FILE_STATUSES = new Set<WorkOrderStatus>(["completed", "paid", "debt", "cancelled"]);

export async function DELETE(_request: Request, context: Context) {
  try {
    const user = await requireUser([...OPS_MANAGER_ROLES, "technician", "accountant"]);
    const { id, fileId } = await context.params;

    const result = await query<{
      path: string;
      purpose: string;
      status: WorkOrderStatus;
    }>(
      `select f.path, f.purpose, wo.status
       from work_order_files f
       join work_orders wo on wo.id = f.work_order_id
       where f.work_order_id = $1 and f.id = $2
       limit 1`,
      [id, fileId],
    );

    const file = result.rows[0];
    if (!file) {
      throw new HttpError(404, "Không tìm thấy file");
    }

    if (file.purpose === "bill") {
      if (!isPaymentManagerRole(user.role)) {
        throw new HttpError(403, "Bạn không có quyền xóa bill thanh toán");
      }
    } else {
      await assertCanMutateFieldWork(user, id);
    }

    if (user.role !== "admin" && (file.purpose === "signature" || LOCKED_FILE_STATUSES.has(file.status))) {
      throw new HttpError(403, "File đã khóa sau nghiệm thu/thanh toán");
    }

    await deleteWorkOrderFile(file.path);
    await query("delete from work_order_files where work_order_id = $1 and id = $2", [id, fileId]);

    return jsonNoContent();
  } catch (error) {
    return handleRouteError(error);
  }
}
