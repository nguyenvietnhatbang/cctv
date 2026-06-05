import { deleteSession } from "@/lib/auth";
import { handleRouteError, jsonNoContent } from "@/lib/http";

export const runtime = "nodejs";

export async function POST() {
  try {
    await deleteSession();
    return jsonNoContent();
  } catch (error) {
    return handleRouteError(error);
  }
}
