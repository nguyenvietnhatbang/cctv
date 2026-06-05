import { createSession, loginWithPassword } from "@/lib/auth";
import { handleRouteError, jsonOk } from "@/lib/http";
import { loginSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = loginSchema.parse(await request.json());
    const user = await loginWithPassword(body.identifier, body.password);
    await createSession(user);
    return jsonOk({ user });
  } catch (error) {
    return handleRouteError(error);
  }
}
