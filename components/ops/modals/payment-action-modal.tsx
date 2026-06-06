"use client";

import { FormEvent } from "react";
import { Modal } from "@/components/ops/ui";
import type { WorkOrderDetail } from "@/components/ops/types";
import { PaymentForm } from "@/components/ops/modals/payment-form";

export function PaymentActionModal({
  detail,
  onClose,
  onSubmit,
  isSubmitting = false,
}: {
  detail: WorkOrderDetail;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSubmitting?: boolean;
}) {
  return (
    <Modal title={`Xử lý thanh toán ${detail.workOrder.code}`} size="lg" onClose={onClose}>
      <PaymentForm detail={detail} onSubmit={onSubmit} isSubmitting={isSubmitting} />
    </Modal>
  );
}
