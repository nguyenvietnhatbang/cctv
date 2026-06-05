import { ZodError } from "zod";

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return Response.json(data, init);
}

export function jsonCreated<T>(data: T) {
  return Response.json(data, { status: 201 });
}

export function jsonNoContent() {
  return new Response(null, { status: 204 });
}

export function handleRouteError(error: unknown) {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof ZodError) {
    return Response.json(
      { error: "Dữ liệu không hợp lệ", details: error.flatten() },
      { status: 422 },
    );
  }

  console.error(error);
  return Response.json({ error: "Lỗi hệ thống" }, { status: 500 });
}
