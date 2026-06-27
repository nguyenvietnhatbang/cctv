import { z } from "zod";
import {
  FILE_PURPOSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  ROLES,
  TECHNICIAN_STATUSES,
  USER_STATUSES,
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_STATUSES,
  WORK_ORDER_TYPES,
} from "@/lib/types";

const optionalText = z.string().trim().optional().nullable().transform((value) => value || null);
const requiredText = z.string().trim().min(1, "Bắt buộc nhập");
function normalizeMoneyInput(value: unknown) {
  if (typeof value !== "string") return value;
  const source = value.trim();
  const normalized = source.includes(",")
    ? source.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "")
    : /^\s*-?\d{1,3}(?:\.\d{3})+\s*$/.test(value)
      ? source.replace(/\./g, "")
      : source.replace(/[^\d.-]/g, "");
  return normalized ? Number(normalized) : "";
}

const moneyInput = z.preprocess((value) => {
  return normalizeMoneyInput(value);
}, z.number().nonnegative());
const optionalMoneyInput = z.preprocess((value) => {
  if (typeof value === "string" && !value.trim()) return undefined;
  return normalizeMoneyInput(value);
}, z.number().nonnegative().optional());
const nullableMoneyInput = z.preprocess((value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && !value.trim()) return null;
  return normalizeMoneyInput(value);
}, z.number().nonnegative().nullable().optional());
const percentInput = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const normalized = value.trim().replace(",", ".");
  return normalized ? Number(normalized) : 0;
}, z.number().min(0).max(100));
const positiveDecimalInput = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const normalized = value.trim().replace(",", ".");
  return normalized ? Number(normalized) : value;
}, z.number().positive());

export const loginSchema = z.object({
  identifier: requiredText,
  password: z.string().min(1, "Bắt buộc nhập mật khẩu"),
});

export const createUserSchema = z.object({
  fullName: requiredText,
  email: z.string().email().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự"),
  role: z.enum(ROLES),
  status: z.enum(USER_STATUSES).default("active"),
  technician: z
    .object({
      serviceArea: optionalText,
      status: z.enum(TECHNICIAN_STATUSES).default("available"),
    })
    .optional(),
});

export const createCustomerSchema = z.object({
  name: requiredText,
  phone: requiredText,
  address: requiredText,
  addressNote: optionalText,
  lat: z.coerce.number().min(-90).max(90).optional().nullable(),
  lng: z.coerce.number().min(-180).max(180).optional().nullable(),
  contacts: z.array(z.object({
    name: requiredText,
    phone: requiredText,
    note: optionalText,
  })).optional(),
});

export const createTechnicianSchema = z.object({
  userId: z.string().uuid(),
  serviceArea: optionalText,
  status: z.enum(TECHNICIAN_STATUSES).default("available"),
});

export const createWorkOrderSchema = z.object({
  customerId: z.string().uuid().optional(),
  customer: createCustomerSchema.optional(),
  type: z.enum(WORK_ORDER_TYPES),
  priority: z.enum(WORK_ORDER_PRIORITIES).default("normal"),
  description: requiredText,
  appointmentAt: z.string().datetime().optional().nullable(),
  internalNote: optionalText,
  technicianId: z.string().uuid().optional().nullable(),
  technicianIds: z.array(z.string().uuid()).optional(),
});

export const updateWorkOrderSchema = z.object({
  type: z.enum(WORK_ORDER_TYPES).optional(),
  priority: z.enum(WORK_ORDER_PRIORITIES).optional(),
  description: requiredText.optional(),
  appointmentAt: z.string().datetime().optional().nullable(),
  internalNote: optionalText,
  laborCost: optionalMoneyInput,
  materialCost: optionalMoneyInput,
  vatRate: percentInput.optional(),
  completionNote: optionalText,
  acceptanceName: optionalText,
  acceptancePhone: optionalText,
  cancellationReason: optionalText,
});

export const assignWorkOrderSchema = z.object({
  technicianId: z.string().uuid().optional(),
  technicianIds: z.array(z.string().uuid()).optional(),
  note: optionalText,
}).refine((value) => Boolean(value.technicianId || value.technicianIds?.length), {
  message: "Cần chọn ít nhất một kỹ thuật viên",
});

export const changeStatusSchema = z.object({
  status: z.enum(WORK_ORDER_STATUSES),
  note: optionalText,
  checkInLat: z.coerce.number().min(-90).max(90).optional(),
  checkInLng: z.coerce.number().min(-180).max(180).optional(),
  updateCustomerLocation: z.boolean().optional().default(false),
});

export const createMaterialSchema = z.object({
  name: requiredText,
  quantity: positiveDecimalInput,
  unitPrice: moneyInput.default(0),
});

export const updateMaterialSchema = z.object({
  name: requiredText.optional(),
  quantity: positiveDecimalInput.optional(),
  unitPrice: optionalMoneyInput,
});

export const updatePaymentSchema = z.object({
  status: z.enum(PAYMENT_STATUSES),
  method: z.enum(PAYMENT_METHODS).optional().nullable(),
  amount: nullableMoneyInput,
  debtDueDate: z.string().date().optional().nullable(),
  note: optionalText,
});

export const uploadPurposeSchema = z.object({
  purpose: z.enum(FILE_PURPOSES),
});

export const acceptanceSchema = z.object({
  acceptanceName: requiredText,
  acceptancePhone: z.string().trim().optional().nullable(),
  signatureDataUrl: z.string().startsWith("data:image/png;base64,"),
  agreed: z.literal(true),
  payment: updatePaymentSchema.optional(),
});

export const notificationReadSchema = z.object({
  readBefore: z.string().datetime(),
});

export const notificationCursorSchema = z.object({
  after: z.string().datetime().optional(),
});

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }),
  deviceName: z.string().trim().max(120).optional().nullable(),
  displayMode: z.enum(["browser", "standalone"]).optional().default("browser"),
});

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
});

export const updateUserSchema = z.object({
  fullName: requiredText.optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  role: z.enum(ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
});

export const changeOwnPasswordSchema = z.object({
  currentPassword: z.string().min(1, "Bắt buộc nhập mật khẩu hiện tại"),
  newPassword: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự"),
});

export const adminResetPasswordSchema = z.object({
  newPassword: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự"),
});

export const updateTechnicianSchema = z.object({
  serviceArea: optionalText,
  status: z.enum(TECHNICIAN_STATUSES).optional(),
});
