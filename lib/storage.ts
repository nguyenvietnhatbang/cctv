import "server-only";

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const ALLOWED_IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
]);

export function assertAllowedImage(type: string, filename: string) {
  const ext = filename.includes(".") ? filename.slice(filename.lastIndexOf(".")).toLowerCase() : "";
  const mime = (type || "").toLowerCase();
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mime) && !ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
    throw new Error("Hệ thống chỉ chấp nhận các định dạng ảnh: jpg, jpeg, png, webp, gif");
  }
}

function getCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
  const folder = process.env.CLOUDINARY_FOLDER || "web-images";

  if (cloudName && uploadPreset) {
    return { cloudName, apiKey, uploadPreset, folder };
  }
  return null;
}

function getStorageClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function getStorageBucket() {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "anh_chup";
  return bucket;
}

export function getMaxUploadBytes() {
  const maxMb = Number(process.env.MAX_UPLOAD_MB ?? "8");
  return maxMb * 1024 * 1024;
}

async function optimizeImageBuffer(buffer: Buffer, mimeType: string): Promise<{ buffer: Buffer; contentType: string }> {
  // GIF hoặc ảnh không phải jpeg/png/webp thì không nén lại bằng sharp để tránh lỗi
  if (mimeType === "image/gif") {
    return { buffer, contentType: mimeType };
  }

  // Nếu ảnh đã nhỏ (< 300KB), không cần tối ưu thêm
  if (buffer.length < 300 * 1024) {
    return { buffer, contentType: mimeType || "image/jpeg" };
  }

  try {
    const optimized = await sharp(buffer)
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, progressive: true })
      .toBuffer();

    return {
      buffer: optimized.length < buffer.length ? optimized : buffer,
      contentType: "image/jpeg",
    };
  } catch {
    return { buffer, contentType: mimeType || "image/jpeg" };
  }
}

export async function uploadWorkOrderFile(path: string, file: File) {
  assertAllowedImage(file.type, file.name);

  const cloudinary = getCloudinaryConfig();
  const rawBytes = Buffer.from(await file.arrayBuffer());
  const { buffer, contentType } = await optimizeImageBuffer(rawBytes, file.type || "image/jpeg");

  if (cloudinary) {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(buffer)], { type: contentType });
    formData.append("file", blob, file.name);
    formData.append("upload_preset", cloudinary.uploadPreset);
    if (cloudinary.folder) {
      formData.append("folder", cloudinary.folder);
    }

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudinary.cloudName}/image/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Lỗi tải ảnh lên Cloudinary (${response.status})`);
    }

    const data = await response.json();
    return {
      bucket: "cloudinary",
      path: data.secure_url as string,
      size: (data.bytes as number) || buffer.length,
    };
  }

  // Fallback to Supabase Storage nếu chưa cấu hình Cloudinary
  const supabase = getStorageClient();
  const bucket = getStorageBucket();

  const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType,
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { bucket, path, size: buffer.length };
}

export async function uploadWorkOrderBytes(path: string, bytes: Buffer, contentType: string) {
  assertAllowedImage(contentType, path);

  const cloudinary = getCloudinaryConfig();
  if (cloudinary) {
    const base64Data = `data:${contentType};base64,${bytes.toString("base64")}`;
    const formData = new FormData();
    formData.append("file", base64Data);
    formData.append("upload_preset", cloudinary.uploadPreset);
    if (cloudinary.folder) {
      formData.append("folder", cloudinary.folder);
    }

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudinary.cloudName}/image/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Lỗi tải ảnh lên Cloudinary (${response.status})`);
    }

    const data = await response.json();
    return {
      bucket: "cloudinary",
      path: data.secure_url as string,
      size: (data.bytes as number) || bytes.length,
    };
  }

  // Fallback to Supabase Storage
  const supabase = getStorageClient();
  const bucket = getStorageBucket();

  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType,
    upsert: true,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { bucket, path, size: bytes.length };
}

export async function createSignedFileUrl(path: string, bucket?: string, expiresIn = 60 * 15) {
  // 1. Nếu là file trên Cloudinary hoặc đường dẫn URL đầy đủ -> Trả về trực tiếp ngay lập tức (0ms)
  if (bucket === "cloudinary" || path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  // 2. Dữ liệu cũ trên Supabase Storage
  try {
    const supabase = getStorageClient();
    const targetBucket = bucket || getStorageBucket();
    const { data, error } = await supabase.storage.from(targetBucket).createSignedUrl(path, expiresIn);

    if (error) {
      throw new Error(error.message);
    }

    return data.signedUrl;
  } catch (error) {
    // Fallback: nếu bucket public hoặc không có service key thì dùng public url
    const supabaseUrl = process.env.SUPABASE_URL;
    const targetBucket = bucket || getStorageBucket();
    if (supabaseUrl) {
      return `${supabaseUrl}/storage/v1/object/public/${targetBucket}/${path}`;
    }
    throw error;
  }
}

export async function deleteWorkOrderFile(path: string, bucket?: string) {
  if (bucket === "cloudinary" || path.includes("cloudinary.com")) {
    // Cloudinary unsigned preset không cung cấp quyền xóa trực tiếp qua public API.
    // Việc xóa record trong CSDL sẽ ngắt file khỏi hệ thống.
    return;
  }

  try {
    const supabase = getStorageClient();
    const targetBucket = bucket || getStorageBucket();
    const { error } = await supabase.storage.from(targetBucket).remove([path]);

    if (error) {
      console.error("Lỗi khi xóa file trên Supabase Storage:", error.message);
    }
  } catch (err) {
    console.error("Không thể kết nối Supabase Storage để xóa file:", err);
  }
}
