"use client";

import { useState, type ButtonHTMLAttributes, type FormHTMLAttributes, type ReactNode } from "react";
import { X } from "lucide-react";
import {
  WORK_ORDER_STATUS_LABELS,
  WORK_ORDER_STATUS_TONE,
  DISPLAY_STATUS_LABELS,
  DISPLAY_STATUS_TONE,
  getDisplayStatus,
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
    const disp = getDisplayStatus(order);
    return (
      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${DISPLAY_STATUS_TONE[disp]}`}>
        {DISPLAY_STATUS_LABELS[disp]}
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
