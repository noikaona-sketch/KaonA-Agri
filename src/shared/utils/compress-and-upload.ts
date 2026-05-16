// compress-and-upload.ts
// Client-side image compression then Supabase Storage upload via API route
// PDF: no compression, upload as-is

const MAX_PX  = 1280;
const QUALITY = 0.75;

async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const src = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(src);
      let { width, height } = img;
      if (width > MAX_PX || height > MAX_PX) {
        const r = Math.min(MAX_PX / width, MAX_PX / height);
        width = Math.round(width * r); height = Math.round(height * r);
      }
      const c = document.createElement('canvas');
      c.width = width; c.height = height;
      const ctx = c.getContext('2d');
      if (!ctx) { reject(new Error('canvas failed')); return; }
      ctx.drawImage(img, 0, 0, width, height);
      c.toBlob((b) => b ? resolve(b) : reject(new Error('compress failed')), 'image/jpeg', QUALITY);
    };
    img.onerror = () => { URL.revokeObjectURL(src); reject(new Error('load failed')); };
    img.src = src;
  });
}

export type UploadResult = { url: string; path: string };

export async function compressAndUpload(file: File, reservationNo: string): Promise<UploadResult> {
  const isPdf = file.type === 'application/pdf';
  const path  = `reservations/${reservationNo}/${Date.now()}.${isPdf ? 'pdf' : 'jpg'}`;
  const blob: Blob = isPdf ? file : await compressImage(file);

  const res = await fetch('/api/admin/reservation-upload', {
    method: 'POST',
    headers: { 'x-file-path': path, 'x-file-type': blob.type },
    body: blob,
  });
  if (!res.ok) {
    const d = (await res.json()) as { error?: string };
    throw new Error(d.error ?? 'upload failed');
  }
  return (await res.json()) as UploadResult;
}
