"use client";

import { FormEvent } from "react";
import { Trash2, Upload } from "lucide-react";
import type { WorkFile, WorkOrderDetail } from "@/components/ops/types";

export function FileUploadForm({
  detail,
  locked,
  onSubmit,
  onDelete,
}: {
  detail: WorkOrderDetail;
  locked: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: (file: WorkFile) => void;
}) {
  return (
    <div className="rounded-md border border-zinc-200 p-4">
      <h3 className="section-title">Ảnh / chữ ký</h3>
      <form onSubmit={onSubmit} className="mt-3 grid gap-2">
        <select name="purpose" className="input" defaultValue="before">
          <option value="initial">Ảnh hiện trạng</option>
          <option value="before">Ảnh trước xử lý</option>
          <option value="after">Ảnh sau xử lý</option>
          <option value="signature">Chữ ký nghiệm thu</option>
        </select>
        <input name="file" type="file" className="input" accept="image/*" capture="environment" required />
        <button className="btn-secondary h-10" type="submit"><Upload size={15} />Upload</button>
      </form>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {detail.files.map((file) => (
          <div key={file.id} className="grid gap-2 rounded-md bg-zinc-100 p-2 text-xs text-zinc-700">
            <a href={file.signed_url ?? "#"} target="_blank" rel="noreferrer" className="font-semibold underline">
              {file.purpose}: {file.original_name}
            </a>
            {!locked && file.purpose !== "signature" ? (
              <button className="btn-secondary h-8" onClick={() => onDelete(file)} type="button">
                <Trash2 size={14} />Xóa
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
