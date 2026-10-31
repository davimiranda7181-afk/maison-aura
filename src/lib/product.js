// Regras de produto: preço, promoção, disponibilidade e etiquetas, todas derivadas dos dados.

/** Preço efetivo de uma variação (promocional só quando menor que o normal). */
export const unitPrice = (v) => (hasPromoVariant(v) ? Number(v.promo_price) : Number(v.price));
export const hasPromoVariant = (v) => v.promo_price != null && Number(v.promo_price) > 0 && Number(v.promo_price) < Number(v.price);
export const inStock = (v) => Number(v.stock) > 0;

export const isAvailable = (p) => p.variants.some(inStock);
export const hasPromo = (p) => p.variants.some((v) => inStock(v) && hasPromoVariant(v));

/** Variação usada no cartão: a mais barata entre as disponíveis (ou entre todas, se nenhuma estiver). */
export function displayVariant(p) {
  const pool = p.variants.filter(inStock);
  const list = pool.length ? pool : p.variants;
  return list.reduce((a, b) => (unitPrice(b) < unitPrice(a) ? b : a), list[0]);
}

export const minPrice = (p) => unitPrice(displayVariant(p));
export const hasPriceRange = (p) => new Set(p.variants.map(unitPrice)).size > 1;

/** "Novidade" só quando o cadastro é recente (prazo configurado na loja). */
export function isNew(p, days = 30, now = Date.now()) {
  if (!p.created_at || !days) return false;
  const t = Date.parse(p.created_at);
  return Number.isFinite(t) && now - t >= 0 && now - t <= days * 864e5;
}

export const discountPct = (v) => (hasPromoVariant(v) ? Math.round((1 - Number(v.promo_price) / Number(v.price)) * 100) : 0);

export const primaryImage = (p) => p.images[0] || null;
