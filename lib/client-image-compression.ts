/**
 * Nén ảnh phía client (trình duyệt / điện thoại di động) trước khi upload.
 * - Tự động giảm kích thước ảnh về cạnh lớn nhất tối đa 1600px (đảm bảo cực kỳ sắc nét cho camera, linh kiện, biên bản bàn giao, chữ viết).
 * - Nén định dạng JPEG chất lượng 82% giúp giảm từ 3MB - 5MB xuống còn ~150KB - 300KB (nhẹ hơn 85-90%).
 * - Giữ nguyên file GIF hoặc file đã nhẹ (< 150KB).
 * - Nếu nén gặp lỗi hoặc ảnh sau nén lớn hơn ảnh gốc thì giữ nguyên ảnh gốc an toàn.
 */
export async function compressImageFile(
  file: File,
  options: {
    maxDimension?: number;
    quality?: number;
  } = {}
): Promise<File> {
  const { maxDimension = 1600, quality = 0.82 } = options;

  if (typeof window === "undefined") {
    return file;
  }

  // Nếu không phải file ảnh hoặc là ảnh động GIF thì giữ nguyên
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return file;
  }

  // Nếu file đã rất nhỏ (< 150KB) thì không cần nén thêm
  if (file.size < 150 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const img = new Image();
          img.onload = () => {
            try {
              let width = img.naturalWidth || img.width;
              let height = img.naturalHeight || img.height;

              if (width <= 0 || height <= 0) {
                resolve(file);
                return;
              }

              // Giảm kích thước nếu vượt quá maxDimension
              if (width > maxDimension || height > maxDimension) {
                if (width > height) {
                  height = Math.round((height * maxDimension) / width);
                  width = maxDimension;
                } else {
                  width = Math.round((width * maxDimension) / height);
                  height = maxDimension;
                }
              }

              const canvas = document.createElement("canvas");
              canvas.width = width;
              canvas.height = height;

              const ctx = canvas.getContext("2d");
              if (!ctx) {
                resolve(file);
                return;
              }

              ctx.drawImage(img, 0, 0, width, height);

              // Xuất ra JPEG chất lượng tối ưu
              canvas.toBlob(
                (blob) => {
                  if (!blob || blob.size >= file.size) {
                    // Nếu nén xong không nhẹ hơn thì giữ file gốc
                    resolve(file);
                    return;
                  }

                  const baseName = file.name.replace(/\.[^/.]+$/, "");
                  const newFileName = `${baseName}.jpg`;
                  const compressedFile = new File([blob], newFileName, {
                    type: "image/jpeg",
                    lastModified: Date.now(),
                  });
                  resolve(compressedFile);
                },
                "image/jpeg",
                quality
              );
            } catch {
              resolve(file);
            }
          };
          img.onerror = () => resolve(file);
          img.src = e.target?.result as string;
        } catch {
          resolve(file);
        }
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    } catch {
      resolve(file);
    }
  });
}
