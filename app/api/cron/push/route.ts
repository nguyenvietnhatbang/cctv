import { handleRouteError, jsonOk } from "@/lib/http";
import { processPushJobs } from "@/lib/push";

export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return Response.json({ error: "Không có quyền xử lý Push" }, { status: 401 });
    }

    const result = await processPushJobs(100);
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
