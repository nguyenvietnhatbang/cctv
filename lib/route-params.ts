import { z } from "zod";
import { HttpError } from "@/lib/http";

export function parseUuidParam(value: string, message = "Định danh không hợp lệ") {
  const parsed = z.string().uuid().safeParse(value);
  if (!parsed.success) {
    throw new HttpError(422, message);
  }

  return parsed.data;
}
