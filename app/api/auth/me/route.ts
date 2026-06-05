import { getCurrentUser } from "@/lib/auth";
import { jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  return jsonOk({ user });
}
