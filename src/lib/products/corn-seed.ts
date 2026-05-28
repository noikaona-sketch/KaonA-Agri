export type CornSeedProductFields = {
  category?: string | null;
  product_type?: string | null;
  crop_type?: string | null;
  name?: string | null;
};

const CORN_KEYWORDS = ['corn', 'maize', 'ข้าวโพด'];

function normalize(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

function containsCorn(value: string | null | undefined) {
  const normalized = normalize(value);
  return CORN_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export function isCornSeedProduct(product: CornSeedProductFields | null | undefined) {
  if (!product) return false;

  const isSeed = normalize(product.category) === 'seed' || normalize(product.product_type) === 'seed';
  const isCorn = containsCorn(product.crop_type) || containsCorn(product.name);

  return isSeed && isCorn;
}
