export type ProcessedImage = {
  processedFile: File;
  widthPx: number;
  heightPx: number;
  fileSizeBytes: number;
};

export async function processImageForEvidence(sourceFile: File): Promise<ProcessedImage> {
  const bitmap = await createImageBitmap(sourceFile);
  const maxDimension = 2048;
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to process image: missing canvas context.');

  context.drawImage(bitmap, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (nextBlob) => {
        if (!nextBlob) return reject(new Error('Image compression failed.'));
        resolve(nextBlob);
      },
      'image/jpeg',
      0.88,
    );
  });

  return {
    processedFile: new File([blob], `${Date.now()}.jpg`, { type: 'image/jpeg' }),
    widthPx: width,
    heightPx: height,
    fileSizeBytes: blob.size,
  };
}
