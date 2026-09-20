import { getCurrentUser } from "@/lib/auth";
import { jsonOk } from "@/lib/http";
import { getUserPermissions } from "@/lib/permissions";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  const permissions = user ? await getUserPermissions(user.role) : [];
  return jsonOk({ user, permissions });
}
