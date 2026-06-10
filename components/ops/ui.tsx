"use client";

import { useState, type ButtonHTMLAttributes, type FormHTMLAttributes, type ReactNode } from "react";
import { X } from "lucide-react";
import {
  WORK_ORDER_STATUS_LABELS,
  WORK_ORDER_STATUS_TONE,
  DISPLAY_STATUS_LABELS,
  DISPLAY_STATUS_TONE,
  getDisplayStatus,
  getWorkOrderStage,
  getWorkOrderDeadlineLabel,
  WORK_ORDER_STAGE_LABELS,
  WORK_ORDER_STAGE_TONE,
  type WorkOrderStatus,
} from "@/lib/types";

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
      <span>{label}</span>
      {children}
    </label>
  );
}

function fieldLabel(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  const explicitLabel = element.getAttribute("aria-label");
  if (explicitLabel) return explicitLabel.toLowerCase();
  const placeholder = element.getAttribute("placeholder");
  if (placeholder) return placeholder.toLowerCase();
  const name = element.getAttribute("name");
  return name ? `trường ${name}` : "trường này";
}

function vietnameseValidationMessage(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  const label = fieldLabel(element);
  const validity = element.validity;
  if (validity.valueMissing) return `Vui lòng nhập ${label}.`;
  if (validity.typeMismatch && element instanceof HTMLInputElement && element.type === "email") return "Email chưa đúng định dạng.";
  if (validity.tooShort && element instanceof HTMLInputElement) return `${label} cần ít nhất ${element.minLength} ký tự.`;
  if (validity.rangeUnderflow && element instanceof HTMLInputElement) return `${label} không được nhỏ hơn ${element.min}.`;
  if (validity.rangeOverflow && element instanceof HTMLInputElement) return `${label} không được lớn hơn ${element.max}.`;
  if (validity.stepMismatch) return `${label} chưa đúng bước nhập cho phép.`;
  if (validity.badInput) return `Giá trị của ${label} chưa hợp lệ.`;
  return `Vui lòng kiểm tra lại ${label}.`;
}

export function ValidatedForm({
  children,
  onInvalidCapture,
  onInputCapture,
  ...props
}: FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form
      {...props}
      noValidate={false}
      onInvalidCapture={(event) => {
        const target = event.target;
        if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) {
          target.setCustomValidity(vietnameseValidationMessage(target));
        }
        onInvalidCapture?.(event);
      }}
      onInputCapture={(event) => {
        const target = event.target;
        if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) {
          target.setCustomValidity("");
        }
        onInputCapture?.(event);
      }}
    >
      {children}
    </form>
  );
}

export function PendingButton({
  pending,
  pendingLabel = "Đang xử lý...",
  children,
  disabled,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  pending?: boolean;
  pendingLabel?: string;
}) {
  return (
    <button {...props} className={className} disabled={disabled || pending} aria-busy={pending || undefined}>
      {pending ? <span className="button-spinner" aria-hidden="true" /> : null}
      {pending ? pendingLabel : children}
    </button>
  );
}

export function LoadingScreen({ label = "Đang tải dữ liệu..." }: { label?: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-zinc-100 px-4 text-zinc-700">
      <div className="grid justify-items-center gap-3 rounded-lg border border-zinc-200 bg-white px-6 py-5 shadow-sm">
        <span className="loading-spinner" aria-hidden="true" />
        <p className="text-sm font-semibold">{label}</p>
      </div>
    </div>
  );
}

export function StatusBadge({
  status,
  order,
}: {
  status?: WorkOrderStatus;
  order?: { status: string; appointment_at: string | null; updated_at?: string };
}) {
  if (order) {
    const s = order.status as WorkOrderStatus;
    return (
      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${WORK_ORDER_STATUS_TONE[s] ?? "bg-zinc-100 text-zinc-700 ring-zinc-200"}`}>
        {WORK_ORDER_STATUS_LABELS[s] ?? order.status}
      </span>
    );
  }

  if (status) {
    if (status in DISPLAY_STATUS_LABELS) {
      const disp = status as keyof typeof DISPLAY_STATUS_LABELS;
      return (
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${DISPLAY_STATUS_TONE[disp]}`}>
          {DISPLAY_STATUS_LABELS[disp]}
        </span>
      );
    }
    const s = status as WorkOrderStatus;
    return (
      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${WORK_ORDER_STATUS_TONE[s]}`}>
        {WORK_ORDER_STATUS_LABELS[s]}
      </span>
    );
  }

  return null;
}

export function DeadlineBadge({
  order,
}: {
  order: { status: string; appointment_at: string | null; updated_at?: string };
}) {
  const label = getWorkOrderDeadlineLabel(order);
  if (!label) return null;
  const displayStatus = getDisplayStatus(order);

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${DISPLAY_STATUS_TONE[displayStatus]}`}>
      {label}
    </span>
  );
}

export function StageBadge({
  status,
}: {
  status: WorkOrderStatus;
}) {
  const stage = getWorkOrderStage(status);

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${WORK_ORDER_STAGE_TONE[stage]}`}>
      {WORK_ORDER_STAGE_LABELS[stage]}
    </span>
  );
}

export function Modal({
  title,
  size = "md",
  children,
  onClose,
}: {
  title: string;
  size?: "sm" | "md" | "lg" | "xl";
  children: ReactNode;
  onClose: () => void;
}) {
  const width = {
    sm: "max-w-md",
    md: "max-w-2xl",
    lg: "max-w-4xl",
    xl: "max-w-6xl",
  }[size];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/45 p-3">
      <section className={`max-h-[92vh] w-full ${width} overflow-hidden rounded-lg bg-white shadow-xl`}>
        <header className="flex items-center justify-between gap-4 border-b border-zinc-200 px-4 py-3">
          <h2 className="text-base font-bold text-zinc-950">{title}</h2>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Đóng">
            <X size={18} />
          </button>
        </header>
        <div className="max-h-[calc(92vh-3.5rem)] overflow-auto p-4">{children}</div>
      </section>
    </div>
  );
}

export function ConfirmModal({
  title,
  body,
  confirmLabel = "Xóa",
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);

  async function confirm() {
    setConfirming(true);
    try {
      await onConfirm();
    } catch {
      // The caller owns user-facing error state.
    } finally {
      setConfirming(false);
    }
  }

  return (
    <Modal title={title} size="sm" onClose={onCancel}>
      <p className="text-sm leading-6 text-zinc-600">{body}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-secondary h-10" onClick={onCancel} type="button" disabled={confirming}>
          Hủy
        </button>
        <PendingButton className="btn-danger h-10" onClick={confirm} type="button" pending={confirming} pendingLabel="Đang xử lý...">
          {confirmLabel}
        </PendingButton>
      </div>
    </Modal>
  );
}

export function Toolbar({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-zinc-500">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
      {children}
    </div>
  );
}

export function TableShell({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="table-shell">{children}</div>;
}

export const TABLE_PAGE_SIZE = 10;

export function getPageCount(total: number, pageSize = TABLE_PAGE_SIZE) {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function clampTablePage(page: number, total: number, pageSize = TABLE_PAGE_SIZE) {
  return Math.min(Math.max(1, page), getPageCount(total, pageSize));
}

export function getPageItems<T>(items: T[], page: number, pageSize = TABLE_PAGE_SIZE) {
  const safePage = clampTablePage(page, items.length, pageSize);
  return items.slice((safePage - 1) * pageSize, safePage * pageSize);
}

export function TablePagination({
  page,
  total,
  pageSize = TABLE_PAGE_SIZE,
  onPageChange,
}: {
  page: number;
  total: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
}) {
  const pageCount = getPageCount(total, pageSize);
  const safePage = clampTablePage(page, total, pageSize);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(total, safePage * pageSize);

  if (total === 0) return null;

  return (
    <div className="table-pagination">
      <span className="text-xs font-semibold text-zinc-500">
        Hiển thị {start}-{end} / {total}
      </span>
      <div className="flex items-center gap-1">
        <button className="btn-secondary h-8 px-2 text-xs" type="button" disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)}>
          Trước
        </button>
        <span className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700">
          {safePage}/{pageCount}
        </span>
        <button className="btn-secondary h-8 px-2 text-xs" type="button" disabled={safePage >= pageCount} onClick={() => onPageChange(safePage + 1)}>
          Sau
        </button>
      </div>
    </div>
  );
}
