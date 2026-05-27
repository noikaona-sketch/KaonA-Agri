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

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function estimateBackgroundLuma(data: Uint8ClampedArray, w: number, h: number): number {
  const sample: number[] = [];
  const take = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    sample.push(luminance(data[i], data[i + 1], data[i + 2]));
  };
  for (let i = 0; i < 32; i += 1) {
    const x = Math.round((i / 31) * (w - 1));
    take(x, 0); take(x, h - 1);
  }
  for (let i = 0; i < 32; i += 1) {
    const y = Math.round((i / 31) * (h - 1));
    take(0, y); take(w - 1, y);
  }
  sample.sort((x, y) => x - y);
  return sample[Math.floor(sample.length / 2)] ?? 240;
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
  const probeW = 800;
  const probeH = Math.max(1, Math.round((srcH * probeW) / srcW));
  const probe = document.createElement('canvas');
  probe.width = probeW;
  probe.height = probeH;
  const pctx = probe.getContext('2d');
  if (!pctx) throw new Error('Missing canvas context');
  pctx.drawImage(img, 0, 0, probeW, probeH);
  const px = pctx.getImageData(0, 0, probeW, probeH).data;

  const bgLuma = estimateBackgroundLuma(px, probeW, probeH);
  const luma: number[] = new Array(probeW * probeH);
  const edge: number[] = new Array(probeW * probeH).fill(0);
  for (let i = 0; i < luma.length; i += 1) {
    const j = i * 4;
    luma[i] = luminance(px[j], px[j + 1], px[j + 2]);
  }

  let edgeSum = 0;
  for (let y = 1; y < probeH - 1; y += 1) {
    for (let x = 1; x < probeW - 1; x += 1) {
      const idx = y * probeW + x;
      const gx = -luma[idx - probeW - 1] + luma[idx - probeW + 1] - 2 * luma[idx - 1] + 2 * luma[idx + 1] - luma[idx + probeW - 1] + luma[idx + probeW + 1];
      const gy = -luma[idx - probeW - 1] - 2 * luma[idx - probeW] - luma[idx - probeW + 1] + luma[idx + probeW - 1] + 2 * luma[idx + probeW] + luma[idx + probeW + 1];
      const mag = Math.sqrt(gx * gx + gy * gy);
      edge[idx] = mag;
      edgeSum += mag;
    }
  }
  const edgeThreshold = (edgeSum / (probeW * probeH)) * 1.8;

  let left = probeW; let right = 0; let top = probeH; let bottom = 0;
  for (let y = 1; y < probeH - 1; y += 1) {
    for (let x = 1; x < probeW - 1; x += 1) {
      const idx = y * probeW + x;
      const distBg = Math.abs(luma[idx] - bgLuma);
      const isCandidate = edge[idx] > edgeThreshold || distBg > 32;
      if (!isCandidate) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }

  let cropApplied = false;
  let warning: string | null = null;
  let sx = 0; let sy = 0; let sw = srcW; let sh = srcH;
  let rotateDeg = 0;

  if (right > left && bottom > top) {
    const scaleX = srcW / probeW;
    const scaleY = srcH / probeH;
    const bw = right - left + 1;
    const bh = bottom - top + 1;
    const padX = Math.round(bw * 0.04);
    const padY = Math.round(bh * 0.07);

    sx = clamp(Math.round((left - padX) * scaleX), 0, srcW - 1);
    sy = clamp(Math.round((top - padY) * scaleY), 0, srcH - 1);
    const ex = clamp(Math.round((right + padX) * scaleX), sx + 1, srcW);
    const ey = clamp(Math.round((bottom + padY) * scaleY), sy + 1, srcH);
    sw = ex - sx;
    sh = ey - sy;

    const aspect = sw / Math.max(1, sh);
    const coverage = (sw * sh) / (srcW * srcH);
    const aspectOk = aspect > 1.45 && aspect < 1.75;
    const coverageOk = coverage > 0.20 && coverage < 0.95;

    if (!aspectOk || !coverageOk) {
      warning = 'ใช้รูปเต็มแทน กรุณาตรวจสอบข้อมูลอีกครั้ง';
      sx = 0; sy = 0; sw = srcW; sh = srcH;
    } else {
      cropApplied = true;
      const centerY = Math.round((top + bottom) / 2);
      let minXTop = probeW; let maxXTop = 0; let minXBottom = probeW; let maxXBottom = 0;
      for (let x = left; x <= right; x += 1) {
        const t = (top * probeW + x);
        const b = (bottom * probeW + x);
        if (edge[t] > edgeThreshold * 0.8) { minXTop = Math.min(minXTop, x); maxXTop = Math.max(maxXTop, x); }
        if (edge[b] > edgeThreshold * 0.8) { minXBottom = Math.min(minXBottom, x); maxXBottom = Math.max(maxXBottom, x); }
      }
      if (maxXTop > minXTop && maxXBottom > minXBottom) {
        const topCenter = (minXTop + maxXTop) / 2;
        const bottomCenter = (minXBottom + maxXBottom) / 2;
        const dx = bottomCenter - topCenter;
        const dy = Math.max(1, bottom - top);
        rotateDeg = clamp((-Math.atan2(dx, dy) * 180) / Math.PI, -8, 8);
      } else {
        void centerY;
      }
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
  octx.fillStyle = '#ffffff';
  octx.fillRect(0, 0, drawW, drawH);
  octx.filter = 'contrast(1.08) saturate(1.03)';
  if (cropApplied && Math.abs(rotateDeg) > 0.5) {
    octx.save();
    octx.translate(drawW / 2, drawH / 2);
    octx.rotate((rotateDeg * Math.PI) / 180);
    octx.drawImage(img, sx, sy, sw, sh, -drawW / 2, -drawH / 2, drawW, drawH);
    octx.restore();
  } else {
    octx.drawImage(img, sx, sy, sw, sh, 0, 0, drawW, drawH);
  }
  octx.filter = 'none';

  let quality = 0.88;
  let blob = await new Promise<Blob>((resolve, reject) => out.toBlob((b) => b ? resolve(b) : reject(new Error('compress failed')), 'image/jpeg', quality));
  while (blob.size > 500 * 1024 && quality > 0.62) {
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
