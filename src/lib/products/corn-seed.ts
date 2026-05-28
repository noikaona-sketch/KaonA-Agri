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
  const category = normalize(product.category);
  const productType = normalize(product.product_type);
  return category === 'seed' || productType === 'seed' || category.includes('เมล็ด') || productType.includes('เมล็ด');
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

  const selectedKey = getCropKey(selectedCrop);
  const cropType = normalize(product?.crop_type);
  const name = normalize(product?.name);
  const hasExplicitCropSignal = Boolean(cropType || getCropKey(name));

  if (matchesCrop(cropType, selectedCrop) || matchesCrop(name, selectedCrop)) return true;

  // Some legacy corn seed products were created as seed products without crop_type,
  // and the product name can be only a variety code. Keep them visible for the
  // current corn-only bill/quota flow unless they explicitly look like another crop.
  return selectedKey === 'corn' && !hasExplicitCropSignal;
}

export function isCornSeedProduct(product: CornSeedProductFields | null | undefined) {
  return isSeedProductMatchingCrop(product, 'corn');
}
