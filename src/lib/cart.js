// Sacola: guarda apenas ids e quantidades. Preço, nome e estoque são relidos do catálogo
// a cada exibição, então mudanças de preço aparecem na hora e nada fica "congelado".
import { unitPrice, inStock } from './product.js';

export const MAX_QTY = 20;

/** Lê e higieniza o que veio do armazenamento local. */
export function sanitizeItems(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Map();
  for (const it of raw) {
    if (!it || typeof it.productId !== 'string' || typeof it.variantId !== 'string') continue;
    const qty = Math.trunc(Number(it.qty));
    if (!(qty >= 1)) continue;
    const key = `${it.productId}|${it.variantId}`;
    const prev = seen.get(key);
    seen.set(key, { productId: it.productId, variantId: it.variantId, qty: Math.min(MAX_QTY, (prev?.qty || 0) + qty) });
  }
  return [...seen.values()];
}

/**
 * Adiciona respeitando o estoque. Retorna { items, added, capped, reason }.
 * reason: 'out' quando não há estoque.
 */
export function addItem(items, product, variant, qty = 1) {
  const limit = Math.min(MAX_QTY, Number(variant.stock) || 0);
  if (limit <= 0) return { items, added: 0, capped: true, reason: 'out' };
  const next = items.map((i) => ({ ...i }));
  let it = next.find((i) => i.productId === product.id && i.variantId === variant.id);
  const current = it ? it.qty : 0;
  const wanted = current + Math.max(1, Math.trunc(qty));
  const finalQty = Math.min(wanted, limit);
  if (it) it.qty = finalQty;
  else { it = { productId: product.id, variantId: variant.id, qty: finalQty }; next.push(it); }
  return { items: next, added: finalQty - current, capped: finalQty < wanted, reason: null };
}

export function setQty(items, index, qty) {
  const next = items.map((i) => ({ ...i }));
  if (!next[index]) return next;
  if (qty < 1) next.splice(index, 1);
  else next[index].qty = Math.min(MAX_QTY, Math.trunc(qty));
  return next;
}

export function removeAt(items, index) {
  return items.filter((_, i) => i !== index);
}

/**
 * Cruza a sacola com o catálogo atual.
 * status: 'ok' | 'out' (sem estoque) | 'missing' (produto ou volume não existe mais).
 * Quantidades acima do estoque são reduzidas na exibição (flag reduced).
 */
export function resolveCart(items, productsById) {
  const lines = items.map((item, index) => {
    const product = productsById.get(item.productId);
    const variant = product?.variants.find((v) => v.id === item.variantId);
    if (!product || !variant) return { index, item, status: 'missing', qty: item.qty, unit: 0, total: 0 };
    if (!inStock(variant)) return { index, item, product, variant, status: 'out', qty: item.qty, unit: unitPrice(variant), total: 0 };
    const qty = Math.min(item.qty, variant.stock, MAX_QTY);
    const unit = unitPrice(variant);
    return { index, item, product, variant, status: 'ok', qty, unit, total: unit * qty, reduced: qty < item.qty };
  });
  const ok = lines.filter((l) => l.status === 'ok');
  return {
    lines,
    ok,
    subtotal: ok.reduce((a, l) => a + l.total, 0),
    count: ok.reduce((a, l) => a + l.qty, 0),
    hasIssues: lines.some((l) => l.status !== 'ok' || l.reduced),
  };
}
