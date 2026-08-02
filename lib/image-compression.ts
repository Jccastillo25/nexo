import imageCompression from "browser-image-compression";

// Costo cero de almacenamiento: ninguna foto de evidencia debe superar
// ~100 KB antes de subirse a Supabase Storage (cuota gratuita).
const MAX_SIZE_MB = 0.1;

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  try {
    return await imageCompression(file, {
      maxSizeMB: MAX_SIZE_MB,
      maxWidthOrHeight: 1600,
      useWebWorker: true,
      fileType: "image/jpeg",
    });
  } catch (err) {
    console.error("No se pudo comprimir la imagen:", err);
    return file;
  }
}
