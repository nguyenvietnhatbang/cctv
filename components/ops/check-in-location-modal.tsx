"use client";

import { CHECK_IN_RADIUS_METERS } from "@/components/ops/check-in";
import { Modal, PendingButton } from "@/components/ops/ui";

export function CheckInLocationModal({
  distance,
  pending,
  onCancel,
  onConfirm,
}: {
  distance: number;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <Modal title="Xác nhận thay đổi vị trí khách hàng" size="sm" onClose={onCancel}>
      <p className="text-sm leading-6 text-zinc-700">
        Vị trí hiện tại cách tọa độ khách hàng khoảng <strong>{Math.round(distance)}m</strong>, vượt quá giới hạn {CHECK_IN_RADIUS_METERS}m.
      </p>
      <p className="mt-2 text-sm leading-6 text-zinc-600">
        Xác nhận sẽ thay tọa độ khách hàng bằng vị trí hiện tại và thực hiện check-in. Nếu hủy, tọa độ cũ được giữ nguyên và phiếu không được check-in.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-secondary h-10" type="button" onClick={onCancel} disabled={pending}>
          Không thay đổi
        </button>
        <PendingButton className="btn-primary h-10" type="button" onClick={onConfirm} pending={pending} pendingLabel="Đang cập nhật...">
          Cập nhật vị trí & check-in
        </PendingButton>
      </div>
    </Modal>
  );
}
