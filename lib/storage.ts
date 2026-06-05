import "server-only";

import { createClient } from "@supabase/supabase-js";

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
  const bucket = process.env.SUPABASE_STORAGE_BUCKET;
  if (!bucket) {
    throw new Error("Missing SUPABASE_STORAGE_BUCKET");
  }

  return bucket;
}

export function getMaxUploadBytes() {
  const maxMb = Number(process.env.MAX_UPLOAD_MB ?? "8");
  return maxMb * 1024 * 1024;
}

export async function uploadWorkOrderFile(path: string, file: File) {
  const supabase = getStorageClient();
  const bucket = getStorageBucket();
  const bytes = await file.arrayBuffer();

  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { bucket, path };
}

export async function uploadWorkOrderBytes(path: string, bytes: Buffer, contentType: string) {
  const supabase = getStorageClient();
  const bucket = getStorageBucket();

  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType,
    upsert: true,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { bucket, path };
}

export async function createSignedFileUrl(path: string, expiresIn = 60 * 15) {
  const supabase = getStorageClient();
  const bucket = getStorageBucket();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);

  if (error) {
    throw new Error(error.message);
  }

  return data.signedUrl;
}

export async function deleteWorkOrderFile(path: string) {
  const supabase = getStorageClient();
  const bucket = getStorageBucket();
  const { error } = await supabase.storage.from(bucket).remove([path]);

  if (error) {
    throw new Error(error.message);
  }
}
