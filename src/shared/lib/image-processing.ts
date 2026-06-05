export type ProcessedImage = {
  processedFile: File;
  widthPx: number;
  heightPx: number;
  fileSizeBytes: number;
  originalSizeBytes: number;
  compressionRatio: number;
};

// ── Core resize+compress ──────────────────────────────────────────────────────
async function resizeAndCompress(
  sourceFile: File,
  maxDimension: number,
  quality: number,
  prefix = 'img',
): Promise<ProcessedImage> {
  const originalSizeBytes = sourceFile.size;
  const bitmap = await createImageBitmap(sourceFile);
  const scale  = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width  = Math.max(1, Math.round(bitmap.width  * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas  = document.createElement('canvas');
  canvas.width  = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((res, rej) =>
    canvas.toBlob(b => b ? res(b) : rej(new Error('Compression failed')), 'image/jpeg', quality)
  );

  return {
    processedFile:    new File([blob], `${prefix}_${Date.now()}.jpg`, { type: 'image/jpeg' }),
    widthPx:          width,
    heightPx:         height,
    fileSizeBytes:    blob.size,
    originalSizeBytes,
    compressionRatio: Math.round((1 - blob.size / originalSizeBytes) * 100),
  };
}

// ── Presets ───────────────────────────────────────────────────────────────────

/** Evidence / inspection photos — 1280px, quality 75% → ~150–350 KB */
export async function processImageForEvidence(sourceFile: File): Promise<ProcessedImage> {
  return resizeAndCompress(sourceFile, 1280, 0.75, 'evidence');
}

/** Field visit / survey photos — 1280px, quality 75% */
export async function compressFieldPhoto(sourceFile: File): Promise<ProcessedImage> {
  return resizeAndCompress(sourceFile, 1280, 0.75, 'field');
}

/** AI crop analysis — 1024px, quality 80% (needs enough detail for vision) */
export async function compressCropPhoto(sourceFile: File): Promise<ProcessedImage> {
  return resizeAndCompress(sourceFile, 1024, 0.80, 'crop');
}

/** ID card / document — 1600px, quality 85% (needs to be readable) */
export async function compressDocument(sourceFile: File): Promise<ProcessedImage> {
  return resizeAndCompress(sourceFile, 1600, 0.85, 'doc');
}

/** Generic upload — 1280px, quality 75% */
export async function compressForUpload(sourceFile: File): Promise<ProcessedImage> {
  return resizeAndCompress(sourceFile, 1280, 0.75, 'photo');
}
