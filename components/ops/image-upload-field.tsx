"use client";

import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import Image from "next/image";

type ImageUploadFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  previewLabel?: string;
};

export function ImageUploadField({ previewLabel = "Xem trước ảnh", onChange, className = "input", ...props }: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const input = inputRef.current;
    const form = input?.form;
    if (!form) return;

    function clearPreview() {
      setPreviewUrl(null);
    }

    form.addEventListener("reset", clearPreview);
    return () => form.removeEventListener("reset", clearPreview);
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <div className="grid gap-2">
      <input
        {...props}
        ref={inputRef}
        type="file"
        className={className}
        accept={props.accept ?? "image/*"}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0] ?? null;
          setPreviewUrl((current) => {
            if (current) URL.revokeObjectURL(current);
            return file?.type.startsWith("image/") ? URL.createObjectURL(file) : null;
          });
          onChange?.(event);
        }}
      />
      {previewUrl ? (
        <div className="relative h-56 overflow-hidden rounded-md border border-zinc-200 bg-zinc-50">
          <Image src={previewUrl} alt={previewLabel} fill unoptimized className="object-contain" />
        </div>
      ) : null}
    </div>
  );
}
