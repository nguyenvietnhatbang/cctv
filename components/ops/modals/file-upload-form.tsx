"use client";

import { FormEvent } from "react";
import { Upload } from "lucide-react";
import { PendingButton, ValidatedForm } from "@/components/ops/ui";
import type { WorkFile, WorkOrderDetail } from "@/components/ops/types";
import { ImageUploadField } from "@/components/ops/image-upload-field";
import { WorkFileGallery } from "@/components/ops/work-file-gallery";

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
      {locked ? (
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Tệp hiện trường đã khóa sau nghiệm thu/thanh toán.</p>
      ) : null}
      <ValidatedForm onSubmit={onSubmit} aria-busy={isUploading} className="mt-3 grid gap-2">
        <select name="purpose" className="input" defaultValue="before" disabled={locked || isUploading}>
          <option value="initial">Ảnh hiện trạng</option>
          <option value="before">Ảnh trước xử lý</option>
          <option value="after">Ảnh sau xử lý</option>
          <option value="signature">Chữ ký nghiệm thu</option>
        </select>
        <ImageUploadField name="file" capture="environment" required disabled={locked || isUploading} aria-label="tệp ảnh" previewLabel="Xem trước ảnh phiếu" />
        <PendingButton className="btn-secondary h-10" type="submit" disabled={locked} pending={isUploading} pendingLabel="Đang tải lên..."><Upload size={15} />Tải ảnh lên</PendingButton>
      </ValidatedForm>
      <div className="mt-3">
        <WorkFileGallery
          files={detail.files}
          canDelete={(file) => !locked && file.purpose !== "signature"}
          onDelete={onDelete}
          deletingFileId={deletingFileId}
        />
      </div>
    </div>
  );
}
