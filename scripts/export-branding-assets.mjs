import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const brandingDir = resolve(root, 'public/branding');

const exportsToCreate = [
  {
    source: 'logo-primary.svg',
    target: 'logo-primary.png',
    width: 840,
  },
  {
    source: 'logo-icon.svg',
    target: 'splash-icon.png',
    width: 512,
  },
  {
    source: 'favicon.svg',
    target: 'favicon.png',
    width: 192,
  },
];

async function loadSharp() {
  try {
    const mod = await import('sharp');
    return mod.default;
  } catch {
    throw new Error(
      'Missing optional dependency: sharp. Run `npm i -D sharp`, then run `npm run export:branding`.',
    );
  }
}

async function exportBrandingAssets() {
  const sharp = await loadSharp();
  await mkdir(brandingDir, { recursive: true });

  for (const item of exportsToCreate) {
    const sourcePath = resolve(brandingDir, item.source);
    const targetPath = resolve(brandingDir, item.target);
    const source = await readFile(sourcePath);
    const png = await sharp(source).resize({ width: item.width }).png().toBuffer();
    await writeFile(targetPath, png);
    console.log(`Exported ${item.target} from ${item.source}`);
  }
}

exportBrandingAssets().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
