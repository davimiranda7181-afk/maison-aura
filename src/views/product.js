import { state } from '../state.js';
import { esc, brl } from '../lib/format.js';
import { card, img, priceBlock, favButton, crumbs, url, genderLabel } from '../ui/components.js';
import { FAMILIES, OCCASIONS, STYLES, INTENSITY, CONCENTRATIONS } from '../data/labels.js';
import { inStock, unitPrice, isAvailable, displayVariant } from '../lib/product.js';
import { MAX_QTY } from '../lib/cart.js';
import { waUrl, buildProductQuestion } from '../lib/whatsapp.js';
import { absoluteUrl } from '../lib/seo.js';

let sel = { id: null, v: 0, qty: 1, img: 0 };

const parentCrumb = (p) => (p.type === 'kit' ? ['Kits', '/kits'] : {
  feminino: ['Femininos', '/femininos'], masculino: ['Masculinos', '/masculinos'], unissex: ['Unissex', '/unissex'],
}[p.gender]);

export function viewProduct(p) {
  if (sel.id !== p.id) {
    const first = p.variants.indexOf(displayVariant(p));
    sel = { id: p.id, v: Math.max(0, first), qty: 1, img: 0 };
  }
  const related = relatedTo(p);
  return `<div class="wrap">
    <div style="padding-top:28px">${crumbs([['Início', '/'], parentCrumb(p), [p.name]])}</div>
    <div class="pdp">
      <div class="gal" id="pdp-gal">${galleryHTML(p)}</div>
      <div class="info">
        <p class="eyebrow">${esc(p.brand.name)}</p>
        <h1>${esc(p.name)}</h1>
        <p class="conc">${[p.concentration, p.type === 'kit' ? 'Kit' : genderLabel(p.gender), FAMILIES[p.family]].filter(Boolean).map(esc).join(' · ')}</p>
        ${p.is_demo ? '<p class="demo-note">Produto de demonstração: nome, marca, notas e preço são fictícios e a imagem é uma ilustração.</p>' : ''}
        <div id="pdp-buy">${buyHTML(p)}</div>
        ${p.description ? `<p class="desc">${esc(p.description).replace(/\n/g, '<br>')}</p>` : ''}
        <div class="assure">
          <span>Você confere disponibilidade, frete e forma de pagamento com a loja pelo WhatsApp antes de pagar.</span>
          <span>Até 7 dias para desistir após o recebimento. <a href="/trocas" class="u-link">Ver política de trocas</a></span>
        </div>
        <div class="acc">${accordions(p)}</div>
      </div>
    </div>
  </div>
  ${related.length ? `<section class="blk bg-sand" aria-labelledby="rel-title"><div class="wrap"><div class="sec-head"><div><span class="eyebrow">Você também pode gostar</span><h2 id="rel-title">Na mesma linha</h2></div></div><div class="grid">${related.map(card).join('')}</div></div></section>` : ''}`;
}

function galleryHTML(p) {
  const imgs = p.images.length ? p.images : [null];
  const cur = imgs[sel.img] || imgs[0];
  return `<div class="main-img">${img(p, { eager: true, image: cur })}</div>
    ${imgs.length > 1 ? `<div class="thumbs" role="group" aria-label="Fotos do produto">${imgs.map((im, i) => `<button type="button" data-thumb="${i}" aria-current="${i === sel.img}" aria-label="Ver foto ${i + 1} de ${imgs.length}">${img(p, { image: im, alt: '' })}</button>`).join('')}</div>` : ''}`;
}

function buyHTML(p) {
  const v = p.variants[sel.v] || p.variants[0];
  const ok = inStock(v);
  const max = Math.min(MAX_QTY, v.stock);
  if (sel.qty > max) sel.qty = Math.max(1, max);
  const ask = waUrl(buildProductQuestion(p, absoluteUrl(url.product(p))));
  return `${ok ? priceBlock(v) : `<div class="price"><b>${brl(unitPrice(v))}</b></div>`}
    ${p.variants.length > 1 ? `<p class="opt-label" id="vol-label"><span>Volume</span><span>${esc(v.label)}</span></p>
    <div class="sizes" role="radiogroup" aria-labelledby="vol-label">${p.variants.map((x, i) => `<button type="button" class="size${inStock(x) ? '' : ' off'}" role="radio" aria-checked="${i === sel.v}" data-size="${i}"><b>${esc(x.label)}</b><small>${inStock(x) ? brl(unitPrice(x)) : 'Indisponível'}</small></button>`).join('')}</div>`
    : `<p class="opt-label"><span>${p.type === 'kit' ? 'Conteúdo' : 'Volume'}</span><span>${esc(v.label)}</span></p>`}
    <div class="buy">
      <div class="stepper" role="group" aria-label="Quantidade"><button type="button" data-pq="-1" aria-label="Diminuir quantidade" ${!ok || sel.qty <= 1 ? 'disabled' : ''}>−</button><span id="pq" aria-live="polite">${ok ? sel.qty : 0}</span><button type="button" data-pq="1" aria-label="Aumentar quantidade" ${!ok || sel.qty >= max ? 'disabled' : ''}>+</button></div>
      <button type="button" class="btn" data-add-pdp="${esc(p.id)}" ${ok ? '' : 'disabled'}>${ok ? 'Adicionar à sacola' : 'Indisponível'}</button>
      ${favButton(p, 'fav-btn')}
    </div>
    ${ok ? '<p class="stock"><i></i>Disponível neste volume</p>' : `<p class="stock out"><i></i>${p.variants.length > 1 && isAvailable(p) ? 'Este volume está indisponível. Escolha outro acima.' : 'Indisponível no momento.'}</p>`}
    ${ask ? `<p class="ask"><a href="${esc(ask)}" target="_blank" rel="noopener noreferrer">${ok ? 'Tirar dúvidas sobre este perfume pelo WhatsApp' : 'Perguntar sobre reposição pelo WhatsApp'}</a></p>` : ''}`;
}

function accordions(p) {
  const out = [];
  if (p.notes) {
    const row = (t, n) => (n.length ? `<div><dt>${t}</dt><dd>${n.map(esc).join(', ')}</dd></div>` : '');
    out.push(`<details open><summary>Pirâmide olfativa</summary><div class="in"><dl class="pyr">${row('Saída', p.notes.top)}${row('Coração', p.notes.heart)}${row('Fundo', p.notes.base)}</dl></div></details>`);
  }
  if (p.kit_contents.length) out.push(`<details open><summary>O que vem no kit</summary><div class="in"><ul style="margin:0;padding-left:18px">${p.kit_contents.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></div></details>`);
  const prof = [];
  if (p.family) prof.push(`<div><h3>Família</h3>${esc(FAMILIES[p.family])}</div>`);
  if (p.intensity) prof.push(`<div><h3>Intensidade</h3>${INTENSITY[p.intensity]}<div class="meter" aria-hidden="true">${[1, 2, 3].map((i) => `<i class="${i <= p.intensity ? 'on' : ''}"></i>`).join('')}</div></div>`);
  if (p.occasions.length) prof.push(`<div><h3>Ocasiões</h3>${p.occasions.map((o) => OCCASIONS[o]).join(', ')}</div>`);
  if (p.styles.length) prof.push(`<div><h3>Estilo</h3>${p.styles.map((s) => STYLES[s]).join(', ')}</div>`);
  if (prof.length) out.push(`<details><summary>Perfil da fragrância</summary><div class="in prof">${prof.join('')}</div></details>`);
  if (p.concentration && CONCENTRATIONS[p.concentration]) out.push(`<details><summary>Sobre a concentração</summary><div class="in"><b style="font-weight:500">${esc(p.concentration)}.</b> ${esc(CONCENTRATIONS[p.concentration])}</div></details>`);
  out.push('<details><summary>Entrega e trocas</summary><div class="in">O valor e o prazo do frete são informados pela loja no WhatsApp, a partir do seu CEP. Veja <a href="/entrega" class="u-link">informações de entrega</a> e a <a href="/trocas" class="u-link">política de trocas</a>.</div></details>');
  return out.join('');
}

export function relatedTo(p, n = 4) {
  const score = (x) => (x.family && x.family === p.family ? 2 : 0) + (x.gender === p.gender ? 1 : 0) + (x.type === p.type ? 1 : 0) + (x.brand.slug === p.brand.slug ? 0.5 : 0);
  return state.products.filter((x) => x.id !== p.id && isAvailable(x))
    .map((x) => [x, score(x)]).filter(([, s]) => s >= 1)
    .sort((a, b) => b[1] - a[1] || a[0].name.localeCompare(b[0].name, 'pt-BR'))
    .slice(0, n).map(([x]) => x);
}

/* Interações (chamadas pelo main.js) */
export function selectVariant(p, i) {
  if (!p.variants[i]) return;
  sel.v = i; sel.qty = 1;
  document.getElementById('pdp-buy').innerHTML = buyHTML(p);
  document.querySelector(`#pdp-buy [data-size="${i}"]`)?.focus();
}
export function changeQty(p, d) {
  const v = p.variants[sel.v];
  sel.qty = Math.max(1, Math.min(Math.min(MAX_QTY, v.stock), sel.qty + d));
  const focusSel = d > 0 ? '[data-pq="1"]' : '[data-pq="-1"]';
  document.getElementById('pdp-buy').innerHTML = buyHTML(p);
  const btn = document.querySelector(`#pdp-buy ${focusSel}`);
  (btn && !btn.disabled ? btn : document.querySelector('#pdp-buy [data-add-pdp]'))?.focus();
}
export function selectImage(p, i) {
  sel.img = i;
  document.getElementById('pdp-gal').innerHTML = galleryHTML(p);
  document.querySelector(`#pdp-gal [data-thumb="${i}"]`)?.focus();
}
export const currentSelection = () => sel;

export function productJsonLd(p) {
  if (p.is_demo) return null;
  const page = absoluteUrl(url.product(p));
  const image = p.images.map((im) => (im.url.startsWith('/') ? absoluteUrl(im.url) : im.url)).filter(Boolean);
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    brand: { '@type': 'Brand', name: p.brand.name },
    ...(p.description ? { description: p.description.slice(0, 500) } : {}),
    ...(image.length ? { image } : {}),
    offers: p.variants.map((v) => ({
      '@type': 'Offer',
      name: v.label,
      price: unitPrice(v).toFixed(2),
      priceCurrency: 'BRL',
      availability: inStock(v) ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      ...(page ? { url: page } : {}),
    })),
  };
}
