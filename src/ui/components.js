// Peças de interface reutilizadas pelas páginas.
import { esc, brl } from '../lib/format.js';
import { state, isFav } from '../state.js';
import { IC } from './icons.js';
import { GENDERS } from '../data/labels.js';
import {
  unitPrice, hasPromoVariant, displayVariant, hasPriceRange, isAvailable, hasPromo, isNew, primaryImage, discountPct,
} from '../lib/product.js';

export const FALLBACK_IMG = '/images/fallback.svg';

/** Caminho de cada página. Uma só definição para links e rotas. */
export const url = {
  home: () => '/',
  product: (p) => `/produto/${encodeURIComponent(p.slug)}`,
  catalog: (key, q) => `/${key}${q ? `?q=${encodeURIComponent(q)}` : ''}`,
};

export function img(p, { eager = false, image = null, alt = null } = {}) {
  const im = image || primaryImage(p);
  const src = im?.url || FALLBACK_IMG;
  const text = alt ?? (im?.alt || `${p.name}, de ${p.brand.name}: foto em breve`);
  const loading = eager ? 'fetchpriority="high"' : 'loading="lazy"';
  return `<img src="${esc(src)}" alt="${esc(text)}" ${loading} decoding="async" width="800" height="1000" data-fallback>`;
}

export function badges(p) {
  const b = [];
  if (p.is_demo) b.push('<span class="badge demo">Demonstração</span>');
  if (!isAvailable(p)) b.push('<span class="badge off">Indisponível</span>');
  else {
    if (isNew(p, state.settings.new_badge_days)) b.push('<span class="badge">Novidade</span>');
    if (hasPromo(p)) b.push('<span class="badge gold">Oferta</span>');
  }
  return `<span class="badges">${b.join('')}</span>`;
}

export function priceBlock(v, { from = false } = {}) {
  const promo = hasPromoVariant(v);
  return `<div class="price">${from ? '<span class="from">a partir de</span>' : ''}${promo
    ? `<b>${brl(unitPrice(v))}</b><s><span class="sr">Preço anterior: </span>${brl(v.price)}</s><span class="off-pct">−${discountPct(v)}%</span>`
    : `<b>${brl(v.price)}</b>`}</div>`;
}

export function favButton(p, cls = 'fav') {
  const on = isFav(p.id);
  return `<button type="button" class="${cls}" data-fav="${esc(p.id)}" aria-pressed="${on}" aria-label="${on ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}: ${esc(p.name)}">${IC.heart}</button>`;
}

export function specLine(p) {
  const parts = [];
  if (p.concentration) parts.push(p.concentration);
  if (p.type === 'kit') parts.push(p.variants[0].label);
  else parts.push(p.variants.map((v) => v.label).join(' / '));
  return parts.map(esc).join(' · ');
}

export function card(p) {
  const v = displayVariant(p);
  const available = isAvailable(p);
  const single = p.variants.length === 1;
  const action = !available
    ? `<a href="${url.product(p)}" class="btn ghost">Ver detalhes</a>`
    : single
      ? `<button type="button" class="btn ghost" data-add="${esc(p.id)}" data-variant="${esc(v.id)}">Adicionar à sacola</button>`
      : `<a href="${url.product(p)}" class="btn ghost" aria-label="Escolher volume de ${esc(p.name)}">Escolher volume</a>`;
  return `<article class="card${available ? '' : ' off'}">
    <div class="media"><a href="${url.product(p)}" class="img" tabindex="-1" aria-hidden="true">${img(p)}${badges(p)}</a>${favButton(p)}</div>
    <div class="body">
      <p class="brand">${esc(p.brand.name)}</p>
      <h3><a href="${url.product(p)}">${esc(p.name)}</a></h3>
      <p class="meta">${specLine(p)}</p>
      ${available ? priceBlock(v, { from: hasPriceRange(p) }) : '<p class="avail">Indisponível no momento</p>'}
      <div class="add">${action}</div>
    </div>
  </article>`;
}

export function skeletonGrid(n = 4, cls = 'grid') {
  return `<div class="${cls}" aria-hidden="true">${Array.from({ length: n }, () => '<div class="card skel-card"><div class="img skel"></div><div class="skel skel-line"></div><div class="skel skel-line s"></div></div>').join('')}</div>`;
}

export function crumbs(items) {
  return `<nav class="crumbs" aria-label="Trilha de navegação">${items.map(([label, href], i) => (i === items.length - 1
    ? `<span aria-current="page">${esc(label)}</span>`
    : `<a href="${href}">${esc(label)}</a><span aria-hidden="true">/</span>`)).join('')}</nav>`;
}

export function pageHead(title, sub, trail) {
  return `<div class="page-head"><div class="wrap">${crumbs([['Início', '/'], ...(trail || []), [title]])}<h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</div></div>`;
}

export const genderLabel = (g) => GENDERS[g] || '';
