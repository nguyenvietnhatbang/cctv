import { ZodError } from "zod";

type PgError = {
  code?: string;
  constraint?: string;
  detail?: string;
};

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

  const pgError = error as PgError;
  if (pgError?.code === "23503") {
    return Response.json(
      { error: "Không thể xóa hoặc cập nhật vì dữ liệu đang được liên kết." },
      { status: 409 },
    );
  }

  if (pgError?.code === "23505") {
    return Response.json(
      { error: "Dữ liệu đã tồn tại, vui lòng kiểm tra lại." },
      { status: 409 },
    );
  }

  if (pgError?.code === "23514") {
    return Response.json(
      { error: "Dữ liệu không hợp lệ theo ràng buộc hệ thống." },
      { status: 422 },
    );
  }

  if (pgError?.code === "22P02") {
    return Response.json(
      { error: "Dữ liệu không hợp lệ." },
      { status: 422 },
    );
  }

  console.error(error);
  return Response.json({ error: "Lỗi hệ thống" }, { status: 500 });
}
