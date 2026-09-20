import { requireUser } from "@/lib/auth";
import { handleRouteError, HttpError, jsonOk } from "@/lib/http";
import {
  getAllPermissions,
  getRolePermissionMatrix,
  updateRolePermissionMatrix,
} from "@/lib/permissions";
import type { Role } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser(["admin"]);
    if (!user) {
      throw new HttpError(403, "Chỉ quản trị viên mới có quyền xem cấu hình phân quyền");
    }

    const [permissions, matrix] = await Promise.all([
      getAllPermissions(),
      getRolePermissionMatrix(),
    ]);

    return jsonOk({
      permissions,
      matrix,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUser(["admin"]);
    if (!user) {
      throw new HttpError(403, "Chỉ quản trị viên mới có quyền cập nhật cấu hình phân quyền");
    }

    const body = (await request.json()) as { matrix?: Record<Role, string[]> };
    if (!body.matrix || typeof body.matrix !== "object") {
      throw new HttpError(400, "Dữ liệu ma trận quyền không hợp lệ");
    }

    const updatedMatrix = await updateRolePermissionMatrix(body.matrix);

    return jsonOk({
      message: "Cập nhật cấu hình phân quyền thành công",
      matrix: updatedMatrix,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
