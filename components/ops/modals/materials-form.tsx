"use client";

import { FormEvent } from "react";
import { Save, Trash2 } from "lucide-react";
import { money } from "@/components/ops/format";
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

  return (
    <div className="rounded-md border border-zinc-200 p-4">
      <h3 className="section-title">Vật tư</h3>
      {locked ? (
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Vật tư đã khóa sau nghiệm thu/thanh toán.</p>
      ) : (
        <ValidatedForm onSubmit={onCreate} aria-busy={pendingAction?.type === "create"}>
          <div className="mt-3 grid grid-cols-[1fr_74px_96px] gap-2">
            <input name="name" className="input" placeholder="Tên vật tư" required disabled={pendingAction?.type === "create"} />
            <input name="quantity" className="input" type="number" step="0.01" placeholder="SL" required disabled={pendingAction?.type === "create"} />
            <input name="unitPrice" className="input" type="number" step="1000" placeholder="Giá" required disabled={pendingAction?.type === "create"} />
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
              <div className="grid grid-cols-[1fr_74px_96px] gap-2">
                <input name="name" className="input" defaultValue={material.name} aria-label="Tên vật tư" required disabled={isCurrentMaterialPending(material.id)} />
                <input name="quantity" className="input" type="number" step="0.01" defaultValue={Number(material.quantity)} aria-label="Số lượng" required disabled={isCurrentMaterialPending(material.id)} />
                <input name="unitPrice" className="input" type="number" step="1000" defaultValue={Number(material.unit_price)} aria-label="Đơn giá" required disabled={isCurrentMaterialPending(material.id)} />
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
