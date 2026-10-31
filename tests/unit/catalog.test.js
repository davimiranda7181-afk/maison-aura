import { describe, it, expect } from 'vitest';
import { demoProducts } from '../../src/data/demo-products.js';
import { applyFilters, emptyFilters, facets, matchesQuery, sortProducts } from '../../src/lib/filters.js';
import { addItem, setQty, removeAt, resolveCart, sanitizeItems, MAX_QTY } from '../../src/lib/cart.js';
import { recommend, matchLabel } from '../../src/lib/finder.js';
import { unitPrice, hasPromo, isAvailable, isNew, displayVariant, minPrice } from '../../src/lib/product.js';
import { normalizeProduct } from '../../src/lib/catalog.js';

const NOW = Date.parse('2026-10-28T12:00:00Z');
const all = demoProducts(NOW);
const by = (slug) => all.find((p) => p.slug === slug);
const f = (o) => ({ ...emptyFilters(), ...o });
const slugs = (l) => l.map((p) => p.slug).sort();

describe('regras de produto', () => {
  it('preço promocional vale só quando menor que o normal', () => {
    expect(unitPrice({ price: 100, promo_price: 80 })).toBe(80);
    expect(unitPrice({ price: 100, promo_price: 100 })).toBe(100);
    expect(unitPrice({ price: 100, promo_price: 120 })).toBe(100);
    expect(unitPrice({ price: 100, promo_price: null })).toBe(100);
  });
  it('oferta exige promoção num volume com estoque', () => {
    expect(hasPromo(by('aura-noir'))).toBe(true);
    expect(hasPromo({ variants: [{ price: 100, promo_price: 80, stock: 0 }] })).toBe(false);
  });
  it('indisponível quando nenhum volume tem estoque', () => {
    expect(isAvailable(by('coffret-noite'))).toBe(false);
    expect(isAvailable(by('couro-ebano'))).toBe(true);
  });
  it('cartão usa o volume disponível mais barato', () => {
    expect(displayVariant(by('couro-ebano')).label).toBe('50 ml');
    expect(minPrice(by('aura-noir'))).toBe(389);
  });
  it('“Novidade” depende da data de cadastro', () => {
    expect(isNew(by('figueira-mate'), 30, NOW)).toBe(true);
    expect(isNew(by('aura-noir'), 30, NOW)).toBe(false);
    expect(isNew(by('figueira-mate'), 0, NOW)).toBe(false);
  });
});

describe('busca e filtros', () => {
  it('busca ignora acentos e maiúsculas e procura em notas, marca e família', () => {
    expect(matchesQuery(by('ambar-solar'), 'AMBAR')).toBe(true);
    expect(slugs(applyFilters(all, f({ q: 'baunilha' })))).toEqual(['ambar-solar', 'vanille-sauvage']);
    expect(slugs(applyFilters(all, f({ q: 'solene' })))).toHaveLength(5);
    expect(applyFilters(all, f({ q: 'inexistente xyz' }))).toEqual([]);
  });
  it('grupos diferentes combinam (E) e opções do mesmo grupo somam (OU)', () => {
    const fem = applyFilters(all, f({ gender: ['feminino'] }));
    const femFloral = applyFilters(all, f({ gender: ['feminino'], family: ['floral'] }));
    expect(slugs(femFloral)).toEqual(['lumiere-de-jasmin', 'rose-sepia']);
    expect(femFloral.length).toBeLessThan(fem.length);
    expect(slugs(applyFilters(all, f({ family: ['floral', 'citrico'] })))).toEqual(['lumiere-de-jasmin', 'neroli-blanc', 'rose-sepia', 'the-blanc']);
    const combo = applyFilters(all, f({ brand: ['atelier-solene'], conc: ['Eau de Toilette'], ml: ['100'], price: ['ate-300'] }));
    expect(slugs(combo)).toEqual(['neroli-blanc', 'the-blanc']);
  });
  it('filtro de volume ignora kits; disponibilidade e ofertas funcionam juntos', () => {
    expect(applyFilters(all, f({ ml: ['50'] })).every((p) => p.type === 'perfume')).toBe(true);
    expect(applyFilters(all, f({ stock: true })).some((p) => p.slug === 'coffret-noite')).toBe(false);
    expect(slugs(applyFilters(all, f({ promo: true, gender: ['feminino'] })))).toEqual(['coffret-lumiere', 'the-blanc', 'vanille-sauvage']);
  });
  it('ordenação por preço e nome', () => {
    const asc = applyFilters(all, f({ sort: 'menor' })).map(minPrice);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    const az = applyFilters(all, f({ sort: 'az' })).map((p) => p.name);
    expect(az).toEqual([...az].sort((a, b) => a.localeCompare(b, 'pt-BR')));
  });
  it('relevância coloca indisponíveis no fim', () => {
    const rel = sortProducts(all, 'rel');
    expect(rel[rel.length - 1].slug).toBe('coffret-noite');
  });
  it('contagens dos filtros refletem a lista', () => {
    const fc = facets(all);
    const total = fc.gender.reduce((a, [, , n]) => a + n, 0);
    expect(total).toBe(all.length);
    expect(fc.ml.map((x) => x[0])).toEqual(['30', '50', '100']);
  });
});

describe('sacola', () => {
  const map = new Map(all.map((p) => [p.id, p]));
  const aura = by('aura-noir');
  it('adiciona, soma e limita ao estoque', () => {
    let r = addItem([], aura, aura.variants[1], 1);
    expect(r.items).toEqual([{ productId: aura.id, variantId: aura.variants[1].id, qty: 1 }]);
    r = addItem(r.items, aura, aura.variants[1], 10);
    expect(r.items[0].qty).toBe(4);
    expect(r.capped).toBe(true);
    r = addItem(r.items, aura, aura.variants[1], 1);
    expect(r.added).toBe(0);
  });
  it('não adiciona volume sem estoque', () => {
    const ce = by('couro-ebano');
    expect(addItem([], ce, ce.variants[1]).reason).toBe('out');
  });
  it('recalcula preços a partir do catálogo atual', () => {
    const items = [{ productId: aura.id, variantId: aura.variants[1].id, qty: 2 }];
    expect(resolveCart(items, map).subtotal).toBe(978);
    const changed = { ...aura, variants: aura.variants.map((v, i) => (i === 1 ? { ...v, promo_price: null, price: 600 } : v)) };
    expect(resolveCart(items, new Map([[aura.id, changed]])).subtotal).toBe(1200);
  });
  it('marca itens removidos do catálogo ou sem estoque e não os soma', () => {
    const ce = by('couro-ebano');
    const items = [{ productId: 'apagado', variantId: 'x', qty: 1 }, { productId: ce.id, variantId: ce.variants[1].id, qty: 1 }, { productId: aura.id, variantId: aura.variants[0].id, qty: 99 }];
    const cv = resolveCart(sanitizeItems(items), map);
    expect(cv.lines.map((l) => l.status)).toEqual(['missing', 'out', 'ok']);
    expect(cv.lines[2].qty).toBe(6);
    expect(cv.lines[2].reduced).toBe(true);
    expect(cv.subtotal).toBe(6 * 389);
  });
  it('higieniza dados corrompidos do armazenamento', () => {
    expect(sanitizeItems('lixo')).toEqual([]);
    expect(sanitizeItems([null, { productId: 1 }, { productId: 'a', variantId: 'b', qty: -2 }, { productId: 'a', variantId: 'b', qty: 3 }, { productId: 'a', variantId: 'b', qty: 999 }])).toEqual([{ productId: 'a', variantId: 'b', qty: MAX_QTY }]);
  });
  it('altera e remove por posição', () => {
    const items = [{ productId: 'a', variantId: 'b', qty: 2 }, { productId: 'c', variantId: 'd', qty: 1 }];
    expect(setQty(items, 0, 0)).toEqual([items[1]]);
    expect(setQty(items, 1, 3)[1].qty).toBe(3);
    expect(removeAt(items, 1)).toEqual([items[0]]);
  });
});

describe('recomendação de fragrâncias', () => {
  it('usa os atributos cadastrados e explica por que combina', () => {
    const r = recommend(all, { family: 'citrico', occasion: 'trabalho', intensity: '1', style: 'fresca' });
    expect(r.length).toBe(3);
    expect(r[0].product.family).toBe('citrico');
    expect(r[0].hits).toEqual(['Cítrico', 'Trabalho', 'Intensidade suave', 'Fresca']);
    expect(matchLabel(r[0])).toBe('Atende a todas as suas escolhas');
  });
  it('é determinística e não inclui kits', () => {
    const a = recommend(all, { family: 'gourmand' }).map((x) => x.product.slug);
    const b = recommend(all, { family: 'gourmand' }).map((x) => x.product.slug);
    expect(a).toEqual(b);
    expect(recommend(all, { style: 'doce' }).every((x) => x.product.type === 'perfume')).toBe(true);
  });
  it('sem escolhas ou sem correspondência, não inventa resultados', () => {
    expect(recommend(all, {})).toEqual([]);
    expect(recommend(all.filter((p) => p.family !== 'citrico'), { family: 'citrico' })).toEqual([]);
  });
  it('rótulo diz quantas escolhas foram atendidas, sem percentual', () => {
    expect(matchLabel({ matched: 2, asked: 4 })).toBe('Atende a 2 de 4 escolhas');
  });
});

describe('dados vindos do banco', () => {
  const row = {
    id: 'u1', slug: 'perfume-real', name: 'Perfume Real', type: 'perfume', gender: 'feminino', family: 'floral', concentration: 'Eau de Parfum',
    description: 'Desc', notes_top: ['A'], notes_heart: [], notes_base: [], occasions: ['noite', 'praia'], intensity: 5, styles: ['doce'],
    kit_contents: [], featured: true, created_at: '2026-10-01T00:00:00Z', sort: 0, brand: { id: 'b', name: 'Marca', slug: 'marca' },
    variants: [{ id: 'v2', label: '100 ml', volume_ml: 100, price: '500.00', promo_price: null, stock: 0, sort: 1 }, { id: 'v1', label: '50 ml', volume_ml: 50, price: '300.00', promo_price: '250.00', stock: 2, sort: 0 }],
    images: [{ url: 'javascript:alert(1)', alt: 'x', sort: 0 }, { url: 'https://abc.supabase.co/storage/v1/object/public/product-images/a.webp', alt: '', sort: 1 }],
    product_categories: [{ category: { slug: 'importados' } }],
  };
  it('converte números, ordena volumes, descarta valores fora da lista e URLs perigosas', () => {
    const p = normalizeProduct(row);
    expect(p.variants.map((v) => v.id)).toEqual(['v1', 'v2']);
    expect(p.variants[0].price).toBe(300);
    expect(p.variants[0].promo_price).toBe(250);
    expect(p.occasions).toEqual(['noite']);
    expect(p.intensity).toBeNull();
    expect(p.images).toHaveLength(1);
    expect(p.images[0].alt).toBe('Foto de Perfume Real');
    expect(p.categories).toEqual(['importados']);
    expect(p.is_demo).toBe(false);
  });
  it('descarta produto sem volume válido ou com slug inválido', () => {
    expect(normalizeProduct({ ...row, variants: [] })).toBeNull();
    expect(normalizeProduct({ ...row, slug: '../admin' })).toBeNull();
  });
});
