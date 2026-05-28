export type CornSeedProductFields = {
  category?: string | null;
  product_type?: string | null;
  crop_type?: string | null;
  name?: string | null;
};

const CROP_KEYWORDS = [
  { key: 'corn', terms: ['corn', 'maize', 'ข้าวโพด'] },
  { key: 'rice', terms: ['rice', 'ข้าว'] },
] as const;

function normalize(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

function getCropKey(value: string | null | undefined) {
  const normalized = normalize(value);
  if (!normalized) return null;

  return CROP_KEYWORDS.find(({ terms }) => terms.some((term) => normalized.includes(term)))?.key ?? null;
}

function isSeedProduct(product: CornSeedProductFields | null | undefined) {
  if (!product) return false;
  return normalize(product.category) === 'seed' || normalize(product.product_type) === 'seed';
}

function matchesCrop(value: string | null | undefined, selectedCrop: string | null | undefined) {
  const selected = normalize(selectedCrop);
  if (!selected) return false;

  const selectedKey = getCropKey(selected);
  if (selectedKey) return getCropKey(value) === selectedKey;

  return normalize(value).includes(selected);
}

export function isSeedProductMatchingCrop(product: CornSeedProductFields | null | undefined, selectedCrop: string | null | undefined) {
  if (!isSeedProduct(product)) return false;

  return matchesCrop(product?.crop_type, selectedCrop) || matchesCrop(product?.name, selectedCrop);
}

export function isCornSeedProduct(product: CornSeedProductFields | null | undefined) {
  return isSeedProductMatchingCrop(product, 'corn');
}
