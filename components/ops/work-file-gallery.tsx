"use client";

import { Download, Eye, Trash2 } from "lucide-react";
import { filePurposeLabel } from "@/lib/types";
import { PendingButton } from "@/components/ops/ui";
import type { WorkFile } from "@/components/ops/types";

export function WorkFileGallery({
  files,
  canDelete = false,
  deletingFileId = null,
  onDelete,
}: {
  files: WorkFile[];
  canDelete?: boolean | ((file: WorkFile) => boolean);
  deletingFileId?: string | null;
  onDelete?: (file: WorkFile) => void;
}) {
  if (files.length === 0) {
    return <p className="text-sm text-zinc-500">Không có tệp phù hợp.</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {files.map((file) => {
        const fileCanDelete = typeof canDelete === "function" ? canDelete(file) : canDelete;
        return (
          <div key={file.id} className="grid gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-700">
            {file.signed_url ? (
              <a
                className="block overflow-hidden rounded-md border border-zinc-200 bg-white"
                href={file.signed_url}
                target="_blank"
                rel="noreferrer"
                aria-label={`Xem ${file.original_name}`}
              >
                <div
                  className="h-36 bg-contain bg-center bg-no-repeat"
                  style={{ backgroundImage: `url("${file.signed_url}")` }}
                />
              </a>
            ) : (
              <div className="flex h-36 items-center justify-center rounded-md border border-dashed border-zinc-300 bg-white text-zinc-500">
                Không tải được ảnh
              </div>
            )}
            <div className="min-w-0">
              <p className="font-bold text-zinc-900">{filePurposeLabel(file.purpose)}</p>
              <p className="mt-1 truncate text-zinc-500">{file.original_name}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {file.signed_url ? (
                <>
                  <a className="btn-secondary h-8 text-xs" href={file.signed_url} target="_blank" rel="noreferrer">
                    <Eye size={14} />Xem
                  </a>
                  <a className="btn-secondary h-8 text-xs" href={file.signed_url} download={file.original_name}>
                    <Download size={14} />Tải xuống
                  </a>
                </>
              ) : null}
              {fileCanDelete && onDelete ? (
                <PendingButton
                  className="btn-secondary h-8 text-xs col-span-2"
                  onClick={() => onDelete(file)}
                  type="button"
                  pending={deletingFileId === file.id}
                  pendingLabel="Đang xóa..."
                >
                  <Trash2 size={14} />Xóa
                </PendingButton>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
