"use client";

import { FormEvent } from "react";
import { Save, Trash2 } from "lucide-react";
import { money } from "@/components/ops/format";
import type { Material, WorkOrderDetail } from "@/components/ops/types";

export function MaterialsForm({
  detail,
  locked,
  onCreate,
  onUpdate,
  onDelete,
}: {
  detail: WorkOrderDetail;
  locked: boolean;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  onUpdate: (material: Material, event: FormEvent<HTMLFormElement>) => void;
  onDelete: (material: Material) => void;
}) {
  return (
    <div className="rounded-md border border-zinc-200 p-4">
      <h3 className="section-title">Vật tư</h3>
      {locked ? (
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Vật tư đã khóa sau nghiệm thu/thanh toán.</p>
      ) : (
        <form onSubmit={onCreate}>
          <div className="mt-3 grid grid-cols-[1fr_74px_96px] gap-2">
            <input name="name" className="input" placeholder="Tên" required />
            <input name="quantity" className="input" type="number" step="0.01" placeholder="SL" required />
            <input name="unitPrice" className="input" type="number" step="1000" placeholder="Giá" required />
          </div>
          <button className="btn-secondary mt-2 h-10 w-full" type="submit">Thêm vật tư</button>
        </form>
      )}
      <div className="mt-3 grid gap-2">
        {detail.materials.map((material) => (
          locked ? (
            <div key={material.id} className="flex justify-between rounded-md bg-zinc-50 px-3 py-2 text-sm">
              <span>{material.name} · {material.quantity}</span>
              <strong>{money(material.line_total)}</strong>
            </div>
          ) : (
            <form key={material.id} onSubmit={(event) => onUpdate(material, event)} className="grid gap-2 rounded-md bg-zinc-50 p-2">
              <div className="grid grid-cols-[1fr_74px_96px] gap-2">
                <input name="name" className="input" defaultValue={material.name} aria-label="Tên vật tư" required />
                <input name="quantity" className="input" type="number" step="0.01" defaultValue={Number(material.quantity)} aria-label="Số lượng" required />
                <input name="unitPrice" className="input" type="number" step="1000" defaultValue={Number(material.unit_price)} aria-label="Đơn giá" required />
              </div>
              <div className="flex items-center justify-between gap-2">
                <strong className="text-sm">{money(material.line_total)}</strong>
                <div className="flex gap-2">
                  <button className="icon-button" type="submit" aria-label="Lưu vật tư"><Save size={15} /></button>
                  <button className="icon-button" onClick={() => onDelete(material)} type="button" aria-label="Xóa vật tư"><Trash2 size={15} /></button>
                </div>
              </div>
            </form>
          )
        ))}
      </div>
    </div>
  );
}
