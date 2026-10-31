// Busca, filtros e ordenação do catálogo. Funções puras, testadas em tests/unit/filters.test.js.
// Regra: opções do mesmo grupo somam (OU); grupos diferentes se combinam (E).
import { norm } from './format.js';
import { FAMILIES, GENDERS, OCCASIONS, STYLES } from '../data/labels.js';
import { minPrice, hasPromo, isAvailable, isNew } from './product.js';

export const PRICE_RANGES = [
  { id: 'ate-300', label: 'Até R$ 300', test: (p) => p <= 300 },
  { id: '300-450', label: 'R$ 300 a R$ 450', test: (p) => p > 300 && p <= 450 },
  { id: '450-600', label: 'R$ 450 a R$ 600', test: (p) => p > 450 && p <= 600 },
  { id: 'acima-600', label: 'Acima de R$ 600', test: (p) => p > 600 },
];

export const SORTS = { rel: 'Relevância', novos: 'Mais recentes', menor: 'Menor preço', maior: 'Maior preço', az: 'Nome (A–Z)' };

export const emptyFilters = () => ({ q: '', price: [], brand: [], gender: [], family: [], conc: [], ml: [], promo: false, stock: false, sort: 'rel' });

export function haystack(p) {
  return norm([
    p.name, p.brand.name, p.concentration, FAMILIES[p.family], GENDERS[p.gender],
    ...(p.notes ? [...p.notes.top, ...p.notes.heart, ...p.notes.base] : []),
    ...p.styles.map((s) => STYLES[s]), ...p.occasions.map((o) => OCCASIONS[o]),
    ...p.kit_contents, p.type === 'kit' ? 'kit presente coffret' : 'perfume',
  ].filter(Boolean).join(' '));
}

export function matchesQuery(p, q) {
  const words = norm(q).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const h = haystack(p);
  return words.every((w) => h.includes(w));
}

const volumes = (p) => (p.type === 'perfume' ? p.variants.map((v) => String(v.volume_ml)).filter((x) => x !== 'null') : []);

export function applyFilters(list, f) {
  const out = list.filter((p) => {
    const price = minPrice(p);
    if (!matchesQuery(p, f.q)) return false;
    if (f.price.length && !f.price.some((id) => PRICE_RANGES.find((r) => r.id === id)?.test(price))) return false;
    if (f.brand.length && !f.brand.includes(p.brand.slug)) return false;
    if (f.gender.length && !f.gender.includes(p.gender)) return false;
    if (f.family.length && !f.family.includes(p.family)) return false;
    if (f.conc.length && !f.conc.includes(p.concentration)) return false;
    if (f.ml.length && !volumes(p).some((m) => f.ml.includes(m))) return false;
    if (f.promo && !hasPromo(p)) return false;
    if (f.stock && !isAvailable(p)) return false;
    return true;
  });
  return sortProducts(out, f.sort);
}

export function sortProducts(list, sort, newDays = 30) {
  const a = [...list];
  const byName = (x, y) => x.name.localeCompare(y.name, 'pt-BR');
  const avail = (x, y) => Number(isAvailable(y)) - Number(isAvailable(x));
  switch (sort) {
    case 'menor': return a.sort((x, y) => minPrice(x) - minPrice(y) || byName(x, y));
    case 'maior': return a.sort((x, y) => minPrice(y) - minPrice(x) || byName(x, y));
    case 'az': return a.sort(byName);
    case 'novos': return a.sort((x, y) => (Date.parse(y.created_at) || 0) - (Date.parse(x.created_at) || 0) || byName(x, y));
    default: return a.sort((x, y) => avail(x, y) || Number(y.featured) - Number(x.featured) || Number(isNew(y, newDays)) - Number(isNew(x, newDays)) || (x.sort ?? 0) - (y.sort ?? 0) || byName(x, y));
  }
}

/** Opções de cada filtro com a contagem dentro da lista da categoria atual. */
export function facets(base) {
  const count = (fn) => base.filter(fn).length;
  const brands = [...new Map(base.map((p) => [p.brand.slug, p.brand.name])).entries()].sort((x, y) => x[1].localeCompare(y[1], 'pt-BR'));
  const concs = [...new Set(base.map((p) => p.concentration).filter(Boolean))].sort();
  const mls = [...new Set(base.flatMap(volumes))].map(Number).sort((x, y) => x - y).map(String);
  return {
    price: PRICE_RANGES.map((r) => [r.id, r.label, count((p) => r.test(minPrice(p)))]),
    brand: brands.map(([slug, name]) => [slug, name, count((p) => p.brand.slug === slug)]),
    gender: Object.entries(GENDERS).map(([k, l]) => [k, l, count((p) => p.gender === k)]),
    family: Object.entries(FAMILIES).map(([k, l]) => [k, l, count((p) => p.family === k)]),
    conc: concs.map((c) => [c, c, count((p) => p.concentration === c)]),
    ml: mls.map((m) => [m, `${m} ml`, count((p) => volumes(p).includes(m))]),
  };
}
