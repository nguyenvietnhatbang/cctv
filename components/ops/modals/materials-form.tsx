"use client";

import { FormEvent } from "react";
import { Save, Trash2 } from "lucide-react";
import { money } from "@/components/ops/format";
import { MoneyInput } from "@/components/ops/money-input";
import { PendingButton, ValidatedForm } from "@/components/ops/ui";
import type { Material, WorkOrderDetail } from "@/components/ops/types";

export function MaterialsForm({
  detail,
  locked,
  onCreate,
  onUpdate,
  onDelete,
  pendingAction = null,
}: {
  detail: WorkOrderDetail;
  locked: boolean;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  onUpdate: (material: Material, event: FormEvent<HTMLFormElement>) => void;
  onDelete: (material: Material) => void;
  pendingAction?: { type: "create" } | { type: "update" | "delete"; id: string } | null;
}) {
  function isCurrentMaterialPending(materialId: string) {
    return pendingAction?.type !== "create" && pendingAction?.id === materialId;
  }

  const hasDummyRow = detail.materials.some((m) => m.name === "Vật tư (nhập nhanh)");

  return (
    <div className="modal-section">
      <h3 className="section-title">Vật tư</h3>
      {hasDummyRow && !locked ? (
        <p className="mt-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
          <strong>Lưu ý:</strong> Bạn đã nhập nhanh tổng chi phí vật tư trước đó. Hãy xóa hoặc cập nhật dòng &quot;Vật tư (nhập nhanh)&quot; khi nhập chi tiết vật tư để tránh tính trùng chi phí.
        </p>
      ) : null}
      {locked ? (
        <p className="mt-2 rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-600">Không thể điều chỉnh vật tư của phiếu đã hủy.</p>
      ) : (
        <ValidatedForm onSubmit={onCreate} aria-busy={pendingAction?.type === "create"}>
          <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_5rem_7rem]">
            <label className="grid gap-1 text-xs font-semibold text-zinc-600">
              Tên vật tư
              <input name="name" className="input" placeholder="VD: Camera, dây mạng, đầu ghi..." required disabled={pendingAction?.type === "create"} />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-zinc-600">
              Số lượng
              <input name="quantity" className="input" type="number" step="0.01" placeholder="VD: 2" required disabled={pendingAction?.type === "create"} />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-zinc-600">
              Đơn giá
              <MoneyInput name="unitPrice" className="input" placeholder="VD: 250.000" required disabled={pendingAction?.type === "create"} />
            </label>
          </div>
          <PendingButton className="btn-secondary mt-2 h-10 w-full" type="submit" pending={pendingAction?.type === "create"} pendingLabel="Đang thêm...">Thêm vật tư</PendingButton>
        </ValidatedForm>
      )}
      <div className="mt-3 grid gap-2">
        {detail.materials.map((material) => (
          locked ? (
            <div key={material.id} className="flex justify-between rounded-md bg-zinc-50 px-3 py-2 text-sm">
              <span>{material.name} · {material.quantity}</span>
              <strong>{money(material.line_total)}</strong>
            </div>
          ) : (
            <ValidatedForm key={material.id} onSubmit={(event) => onUpdate(material, event)} className="grid gap-2 rounded-md bg-zinc-50 p-2" aria-busy={isCurrentMaterialPending(material.id)}>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_5rem_7rem]">
                <label className="grid gap-1 text-xs font-semibold text-zinc-600">
                  Tên vật tư
                  <input name="name" className="input" defaultValue={material.name} required disabled={isCurrentMaterialPending(material.id)} />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-zinc-600">
                  Số lượng
                  <input name="quantity" className="input" type="number" step="0.01" defaultValue={Number(material.quantity)} required disabled={isCurrentMaterialPending(material.id)} />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-zinc-600">
                  Đơn giá
                  <MoneyInput name="unitPrice" className="input" defaultValue={Number(material.unit_price)} required disabled={isCurrentMaterialPending(material.id)} />
                </label>
              </div>
              <div className="flex items-center justify-between gap-2">
                <strong className="text-sm">{money(material.line_total)}</strong>
                <div className="flex gap-2">
                  <PendingButton className="icon-button" type="submit" aria-label="Lưu vật tư" pending={pendingAction?.type === "update" && pendingAction.id === material.id} pendingLabel=""><Save size={15} /></PendingButton>
                  <PendingButton className="icon-button" onClick={() => onDelete(material)} type="button" aria-label="Xóa vật tư" pending={pendingAction?.type === "delete" && pendingAction.id === material.id} pendingLabel=""><Trash2 size={15} /></PendingButton>
                </div>
              </div>
            </ValidatedForm>
          )
        ))}
      </div>
    </div>
  );
}
