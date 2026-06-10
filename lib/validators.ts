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
});

export const updateWorkOrderSchema = z.object({
  type: z.enum(WORK_ORDER_TYPES).optional(),
  priority: z.enum(WORK_ORDER_PRIORITIES).optional(),
  description: requiredText.optional(),
  appointmentAt: z.string().datetime().optional().nullable(),
  internalNote: optionalText,
  laborCost: z.coerce.number().nonnegative().optional(),
  vatRate: z.coerce.number().min(0).max(100).optional(),
  completionNote: optionalText,
  acceptanceName: optionalText,
  acceptancePhone: optionalText,
  cancellationReason: optionalText,
});

export const assignWorkOrderSchema = z.object({
  technicianId: z.string().uuid(),
  note: optionalText,
});

export const changeStatusSchema = z.object({
  status: z.enum(WORK_ORDER_STATUSES),
  note: optionalText,
  checkInLat: z.coerce.number().optional(),
  checkInLng: z.coerce.number().optional(),
});

export const createMaterialSchema = z.object({
  name: requiredText,
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().nonnegative().default(0),
});

export const updateMaterialSchema = z.object({
  name: requiredText.optional(),
  quantity: z.coerce.number().positive().optional(),
  unitPrice: z.coerce.number().nonnegative().optional(),
});

export const updatePaymentSchema = z.object({
  status: z.enum(PAYMENT_STATUSES),
  method: z.enum(PAYMENT_METHODS).optional().nullable(),
  transactionRef: optionalText,
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
});

export const notificationReadSchema = z.object({
  read: z.boolean().default(true),
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
