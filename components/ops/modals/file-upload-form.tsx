"use client";

import { FormEvent } from "react";
import { Trash2, Upload } from "lucide-react";
import { PendingButton, ValidatedForm } from "@/components/ops/ui";
import type { WorkFile, WorkOrderDetail } from "@/components/ops/types";

export function FileUploadForm({
  detail,
  locked,
  onSubmit,
  onDelete,
  isUploading = false,
  deletingFileId = null,
}: {
  detail: WorkOrderDetail;
  locked: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: (file: WorkFile) => void;
  isUploading?: boolean;
  deletingFileId?: string | null;
}) {
  return (
    <div className="modal-section">
      <h3 className="section-title">Ảnh / chữ ký</h3>
      <ValidatedForm onSubmit={onSubmit} aria-busy={isUploading} className="mt-3 grid gap-2">
        <select name="purpose" className="input" defaultValue="before" disabled={isUploading}>
          <option value="initial">Ảnh hiện trạng</option>
          <option value="before">Ảnh trước xử lý</option>
          <option value="after">Ảnh sau xử lý</option>
          <option value="signature">Chữ ký nghiệm thu</option>
        </select>
        <input name="file" type="file" className="input" accept="image/*" capture="environment" required disabled={isUploading} aria-label="tệp ảnh" />
        <PendingButton className="btn-secondary h-10" type="submit" pending={isUploading} pendingLabel="Đang upload..."><Upload size={15} />Upload</PendingButton>
      </ValidatedForm>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {detail.files.map((file) => (
          <div key={file.id} className="grid gap-2 rounded-md bg-zinc-100 p-2 text-xs text-zinc-700">
            <a href={file.signed_url ?? "#"} target="_blank" rel="noreferrer" className="truncate font-semibold underline">
              {file.purpose}: {file.original_name}
            </a>
            {!locked && file.purpose !== "signature" ? (
              <PendingButton className="btn-secondary h-8" onClick={() => onDelete(file)} type="button" pending={deletingFileId === file.id} pendingLabel="Đang xóa...">
                <Trash2 size={14} />Xóa
              </PendingButton>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
