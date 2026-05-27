/**
 * KaonA Image Utilities
 * compress + crop ก่อน upload ทุกจุด
 */

export type CompressOptions = {
  maxWidth?:   number;   // default 1200
  maxHeight?:  number;   // default 1200
  quality?:    number;   // 0-1, default 0.82
  outputType?: 'image/jpeg' | 'image/webp';
  crop?: {
    aspect?: number;           // w/h ratio เช่น 16/9, 4/3, 1.586 (บัตรประชาชน)
    autoCrop?: boolean;        // ตัดขอบสีขาว/สีเดียวออก
  };
};

export type IdCardPreprocessResult = {
  blob: Blob;
  cropApplied: boolean;
  warning: string | null;
  width: number;
  height: number;
};

const ID_CARD_ASPECT = 85.6 / 54;   // มาตรฐานบัตร ISO 7810 ID-1

/**
 * compress + optional crop รูปภาพ
 * รองรับ File, Blob, HTMLImageElement
 */
export async function compressImage(
  input: File | Blob,
  options: CompressOptions = {}
): Promise<Blob> {
  const {
    maxWidth  = 1200,
    maxHeight = 1200,
    quality   = 0.82,
    outputType = 'image/jpeg',
    crop,
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(input);

    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const canvas = document.createElement('canvas');
        const ctx    = canvas.getContext('2d')!;

        let { naturalWidth: w, naturalHeight: h } = img;
        let sx = 0, sy = 0, sw = w, sh = h;

        // ── Auto-crop white/single-color border ─────────────────────
        if (crop?.autoCrop) {
          const tmpC = document.createElement('canvas');
          tmpC.width = w; tmpC.height = h;
          const tmpCtx = tmpC.getContext('2d')!;
          tmpCtx.drawImage(img, 0, 0);
          const data = tmpCtx.getImageData(0, 0, w, h).data;

          let top = 0, bottom = h - 1, left = 0, right = w - 1;
          const threshold = 245;

          const isLight = (x: number, y: number) => {
            const i = (y * w + x) * 4;
            return data[i] >= threshold && data[i+1] >= threshold && data[i+2] >= threshold;
          };

          while (top < h && [...Array(w)].every((_, x) => isLight(x, top))) top++;
          while (bottom > top && [...Array(w)].every((_, x) => isLight(x, bottom))) bottom--;
          while (left < w && [...Array(h)].every((_, y) => isLight(left, y))) left++;
          while (right > left && [...Array(h)].every((_, y) => isLight(right, y))) right--;

          sx = Math.max(0, left - 4);
          sy = Math.max(0, top  - 4);
          sw = Math.min(w, right  - left + 8);
          sh = Math.min(h, bottom - top  + 8);
        }

        // ── Aspect ratio crop (center) ───────────────────────────────
        if (crop?.aspect) {
          const targetAspect = crop.aspect;
          const currentAspect = sw / sh;
          if (currentAspect > targetAspect) {
            const newW = sh * targetAspect;
            sx += (sw - newW) / 2;
            sw = newW;
          } else if (currentAspect < targetAspect) {
            const newH = sw / targetAspect;
            sy += (sh - newH) / 2;
            sh = newH;
          }
        }

        // ── Scale down ───────────────────────────────────────────────
        let dw = sw, dh = sh;
        if (dw > maxWidth)  { dh = (dh * maxWidth)  / dw; dw = maxWidth; }
        if (dh > maxHeight) { dw = (dw * maxHeight) / dh; dh = maxHeight; }
        dw = Math.round(dw); dh = Math.round(dh);

        canvas.width  = dw;
        canvas.height = dh;

        // white background (for jpeg)
        if (outputType === 'image/jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, dw, dh);
        }

        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error('toBlob failed')),
          outputType,
          quality
        );
      } catch (e) { reject(e); }
    };

    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}

/**
 * compress สำหรับบัตรประชาชน — crop + resize เล็กลง
 */
export async function compressIdCard(file: File | Blob): Promise<Blob> {
  return compressImage(file, {
    maxWidth:  900,
    maxHeight: 600,
    quality:   0.88,
    outputType: 'image/jpeg',
    crop: {
      aspect:   ID_CARD_ASPECT,
      autoCrop: true,
    },
  });
}

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export async function preprocessThaiIdCard(file: File | Blob): Promise<IdCardPreprocessResult> {
  const img = new Image();
  const url = URL.createObjectURL(file);
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = url;
  });
  URL.revokeObjectURL(url);

  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;
  const probeW = 640;
  const probeH = Math.max(1, Math.round((srcH * probeW) / srcW));
  const probe = document.createElement('canvas');
  probe.width = probeW;
  probe.height = probeH;
  const pctx = probe.getContext('2d');
  if (!pctx) throw new Error('Missing canvas context');
  pctx.drawImage(img, 0, 0, probeW, probeH);
  const pixels = pctx.getImageData(0, 0, probeW, probeH).data;

  const luma: number[] = new Array(probeW * probeH);
  for (let i = 0; i < luma.length; i += 1) {
    const j = i * 4;
    luma[i] = luminance(pixels[j], pixels[j + 1], pixels[j + 2]);
  }

  let totalEdge = 0;
  const edgeMap: number[] = new Array(probeW * probeH).fill(0);
  for (let y = 1; y < probeH - 1; y += 1) {
    for (let x = 1; x < probeW - 1; x += 1) {
      const idx = y * probeW + x;
      const gx =
        -luma[idx - probeW - 1] + luma[idx - probeW + 1] - 2 * luma[idx - 1] + 2 * luma[idx + 1] - luma[idx + probeW - 1] + luma[idx + probeW + 1];
      const gy =
        -luma[idx - probeW - 1] - 2 * luma[idx - probeW] - luma[idx - probeW + 1] + luma[idx + probeW - 1] + 2 * luma[idx + probeW] + luma[idx + probeW + 1];
      const mag = Math.sqrt(gx * gx + gy * gy);
      edgeMap[idx] = mag;
      totalEdge += mag;
    }
  }
  const edgeThreshold = (totalEdge / (probeW * probeH)) * 1.7;

  let left = probeW;
  let right = 0;
  let top = probeH;
  let bottom = 0;
  for (let y = 0; y < probeH; y += 1) {
    for (let x = 0; x < probeW; x += 1) {
      const idx = y * probeW + x;
      if (edgeMap[idx] > edgeThreshold) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }

  let cropApplied = false;
  let warning: string | null = null;
  let sx = 0; let sy = 0; let sw = srcW; let sh = srcH;
  if (right > left && bottom > top) {
    const pad = 20;
    const scaleX = srcW / probeW;
    const scaleY = srcH / probeH;
    sx = Math.max(0, Math.round((left - pad) * scaleX));
    sy = Math.max(0, Math.round((top - pad) * scaleY));
    sw = Math.min(srcW - sx, Math.round((right - left + pad * 2) * scaleX));
    sh = Math.min(srcH - sy, Math.round((bottom - top + pad * 2) * scaleY));

    const aspect = sw / Math.max(1, sh);
    if (sw < srcW * 0.35 || sh < srcH * 0.25 || aspect < 1.3 || aspect > 1.9) {
      warning = 'ใช้รูปเต็มแทน กรุณาตรวจสอบข้อมูลอีกครั้ง';
      sx = 0; sy = 0; sw = srcW; sh = srcH;
    } else {
      cropApplied = true;
    }
  } else {
    warning = 'ใช้รูปเต็มแทน กรุณาตรวจสอบข้อมูลอีกครั้ง';
  }

  const targetW = 1280;
  const drawW = Math.min(targetW, sw);
  const drawH = Math.max(1, Math.round((sh * drawW) / sw));
  const out = document.createElement('canvas');
  out.width = drawW;
  out.height = drawH;
  const octx = out.getContext('2d');
  if (!octx) throw new Error('Missing canvas context');
  octx.filter = 'contrast(1.06) saturate(1.02)';
  octx.drawImage(img, sx, sy, sw, sh, 0, 0, drawW, drawH);
  octx.filter = 'none';

  let quality = 0.86;
  let blob = await new Promise<Blob>((resolve, reject) => out.toBlob((b) => b ? resolve(b) : reject(new Error('compress failed')), 'image/jpeg', quality));
  while (blob.size > 500 * 1024 && quality > 0.66) {
    quality -= 0.05;
    blob = await new Promise<Blob>((resolve, reject) => out.toBlob((b) => b ? resolve(b) : reject(new Error('compress failed')), 'image/jpeg', quality));
  }

  return { blob, cropApplied, warning, width: drawW, height: drawH };
}

/**
 * compress สำหรับรูปทั่วไป (แปลง, รูปโปรไฟล์, เมล็ดพันธุ์)
 */
export async function compressGeneral(file: File | Blob, maxPx = 1200): Promise<Blob> {
  return compressImage(file, {
    maxWidth:  maxPx,
    maxHeight: maxPx,
    quality:   0.82,
    outputType: 'image/jpeg',
  });
}

/**
 * compress thumbnail (สำหรับ preview เล็ก)
 */
export async function compressThumb(file: File | Blob): Promise<Blob> {
  return compressImage(file, {
    maxWidth:  400,
    maxHeight: 400,
    quality:   0.75,
    outputType: 'image/jpeg',
  });
}

/**
 * convert Blob → File พร้อม rename
 */
export function blobToFile(blob: Blob, originalName: string, suffix = '_compressed'): File {
  const ext  = 'jpg';
  const base = originalName.replace(/\.[^.]+$/, '');
  return new File([blob], `${base}${suffix}.${ext}`, { type: 'image/jpeg' });
}

/**
 * format file size
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
