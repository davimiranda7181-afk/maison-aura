// Ponto de entrada da vitrine: carrega o catálogo, controla as rotas e os eventos.
import './styles/store.css';
import './styles/intro.css';
import { initPerfumeIntro } from './ui/intro.js';
import { state, setCatalog, saveCart, saveFavs, cartView, KEYS } from './state.js';
import { load } from './lib/storage.js';
import { sanitizeItems } from './lib/cart.js';
import { loadCatalog, subscribeNewsletter } from './lib/catalog.js';
import { isSupabaseConfigured } from './lib/config.js';
import { esc, isSlug, cleanText, maskCep, brl } from './lib/format.js';
import { addItem, setQty, removeAt } from './lib/cart.js';
import { matchesQuery } from './lib/filters.js';
import { minPrice, primaryImage } from './lib/product.js';
import { setPage } from './lib/seo.js';
import { FAMILIES } from './data/labels.js';
import { FALLBACK_IMG, url, img } from './ui/components.js';
import {
  renderChrome, markNav, updateBadges, openDrawer, closeDrawers, renderCart, cartOpen, toast, setFabVisible,
} from './ui/chrome.js';
import { collection, dbCollection } from './views/categories.js';
import { viewHome, viewHomeLoading, renderFinder, setAnswer } from './views/home.js';
import * as catalog from './views/catalog.js';
import * as pdp from './views/product.js';
import { viewOrder, renderOrder, updateCta, currentMessage, afterOpen } from './views/order.js';
import { viewPage, hasPage, pageMeta, viewFavorites, viewNotFound, viewError } from './views/pages.js';

const app = document.getElementById('app');
let route = { name: 'home' };

/* ================= Rotas ================= */
function safeDecode(s) { try { return decodeURIComponent(s); } catch { return ''; } }

export function parseRoute(pathname) {
  const parts = pathname.split('/').filter(Boolean).map(safeDecode);
  if (!parts.length) return { name: 'home' };
  const [a, b, extra] = parts;
  if (extra !== undefined) return { name: 'notfound' };
  if (a === 'produto' && b) return isSlug(b) ? { name: 'product', slug: b } : { name: 'notfound' };
  if (a === 'colecao' && b) return isSlug(b) ? { name: 'dbcollection', slug: b } : { name: 'notfound' };
  if (b !== undefined) return { name: 'notfound' };
  if (collection(a)) return { name: 'collection', key: a };
  if (a === 'favoritos') return { name: 'favorites' };
  if (a === 'pedido') return { name: 'order' };
  if (hasPage(a)) return { name: 'page', key: a };
  return { name: 'notfound' };
}

export function navigate(href, { replace = false } = {}) {
  const u = new URL(href, location.href);
  if (u.origin !== location.origin) { location.href = u.href; return; }
  history[replace ? 'replaceState' : 'pushState']({}, '', u.pathname + u.search + u.hash);
  render({ scroll: !u.hash, focus: true });
}

function render({ scroll = true, focus = false } = {}) {
  route = parseRoute(location.pathname);
  const s = state.settings;
  const noindex = state.mode === 'demo';
  let html;
  let seo = { title: '', path: location.pathname, noindex };

  if (state.status === 'loading') {
    html = route.name === 'home' ? viewHomeLoading() : '<div class="wrap"><div class="state" style="padding-block:120px" role="status"><p>Carregando…</p></div></div>';
  } else if (state.status === 'error') {
    html = viewError(state.error);
    seo = { title: 'Indisponível', noindex: true };
  } else {
    switch (route.name) {
      case 'home': html = viewHome(); seo.description = `${s.store_name}: perfumaria multimarcas com pedidos pelo WhatsApp.`; seo.path = '/'; break;
      case 'collection':
      case 'dbcollection': {
        const col = route.name === 'collection' ? collection(route.key) : dbCollection(route.slug);
        if (!col) { html = viewNotFound(); seo = { title: 'Página não encontrada', noindex: true }; break; }
        html = catalog.viewCatalog(col);
        seo.title = col.title; seo.description = col.sub || `${col.title} na ${s.store_name}.`; seo.path = col.path;
        if (location.search) seo.noindex = true; // buscas e ordenações não devem ser indexadas
        break;
      }
      case 'product': {
        const p = state.bySlug.get(route.slug);
        if (!p) { html = viewNotFound('Produto não encontrado', 'Este perfume não está mais disponível no catálogo ou o endereço está incorreto.'); seo = { title: 'Produto não encontrado', noindex: true }; break; }
        html = pdp.viewProduct(p);
        seo = { title: `${p.name} · ${p.brand.name}`, description: (p.description || `${p.name}, de ${p.brand.name}.`).slice(0, 155), path: url.product(p), noindex: noindex || p.is_demo, jsonLd: pdp.productJsonLd(p), image: primaryImage(p)?.url };
        break;
      }
      case 'favorites': html = viewFavorites(); seo = { title: 'Favoritos', noindex: true }; break;
      case 'order': html = viewOrder(); seo = { title: 'Revisão do pedido', noindex: true }; break;
      case 'page': html = viewPage(route.key); seo.title = pageMeta(route.key).title; break;
      default: html = viewNotFound(); seo = { title: 'Página não encontrada', noindex: true };
    }
  }

  app.innerHTML = html;
  setPage({ ...seo, storeName: s.store_name });
  markNav(route.name === 'home' ? '/' : route.name === 'collection' ? `/${route.key}` : location.pathname);
  setFabVisible(route.name !== 'order');
  closeDrawers(false);

  if (state.status === 'ready') {
    if (route.name === 'home') renderFinder();
    if (route.name === 'collection' || route.name === 'dbcollection') catalog.renderCatalog();
    if (route.name === 'order') renderOrder();
  }

  if (location.hash.length > 1) {
    const target = document.getElementById(location.hash.slice(1));
    if (target) { setTimeout(() => target.scrollIntoView({ behavior: 'smooth' }), 40); return; }
  }
  if (scroll) window.scrollTo(0, 0);
  // Leitores de tela e teclado: ao trocar de página, o foco vai para o novo conteúdo.
  if (focus) app.focus({ preventScroll: true });
}

/* ================= Ações ================= */
function addToCart(productId, variantId, qty = 1) {
  const p = state.byId.get(productId);
  const v = p?.variants.find((x) => x.id === variantId);
  if (!p || !v) { toast('Este produto não está mais disponível.'); return; }
  const r = addItem(state.cart, p, v, qty);
  if (r.reason === 'out') { toast(`${p.name} (${v.label}) está indisponível no momento.`); return; }
  state.cart = r.items; saveCart(); updateBadges();
  if (!r.added) { toast(`Você já tem todas as unidades disponíveis de ${p.name} ${v.label} na sacola.`, { label: 'Ver sacola', attr: 'data-open-cart' }); return; }
  toast(r.capped ? `Adicionamos ${r.added} (limite do estoque) de ${p.name} à sacola.` : `${p.name} ${v.label} na sacola.`, { label: 'Ver sacola', attr: 'data-open-cart' });
}

function toggleFav(id) {
  const p = state.byId.get(id);
  const i = state.favs.indexOf(id);
  if (i > -1) state.favs.splice(i, 1); else state.favs.push(id);
  saveFavs(); updateBadges();
  const on = state.favs.includes(id);
  document.querySelectorAll(`[data-fav="${CSS.escape(id)}"]`).forEach((b) => {
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', `${on ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}: ${p ? p.name : ''}`);
  });
  if (route.name === 'favorites') render({ scroll: false });
  else toast(on ? 'Salvo nos favoritos.' : 'Removido dos favoritos.');
}

function refreshCartViews() {
  saveCart(); updateBadges();
  if (cartOpen()) renderCart();
  if (route.name === 'order') renderOrder();
}

async function copyText(text, okMsg = 'Copiado.') {
  try {
    await navigator.clipboard.writeText(text);
    toast(okMsg);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    toast(ok ? okMsg : 'Não foi possível copiar. Selecione o texto e copie manualmente.');
  }
}

/* ================= Eventos ================= */
function isInternalLink(a, e) {
  if (!a || a.target === '_blank' || a.hasAttribute('download') || e.defaultPrevented) return false;
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  const href = a.getAttribute('href');
  if (!href || href.startsWith('mailto:') || href.startsWith('tel:')) return false;
  const u = new URL(a.href, location.href);
  return u.origin === location.origin && !u.pathname.startsWith('/admin') && !/\.[a-z0-9]+$/i.test(u.pathname);
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('button, a');
  if (!t) return;
  const d = t.dataset;

  if (d.openCart !== undefined) { e.preventDefault(); openDrawer('cart'); return; }
  if (t.id === 'menu-open') { openDrawer('mmenu'); return; }
  if (d.close !== undefined && t.tagName === 'BUTTON') { closeDrawers(); return; }
  if (t.id === 'wa-send') { afterOpen(); return; }
  if (d.scroll && route.name === 'home') {
    e.preventDefault();
    document.getElementById(d.scroll)?.scrollIntoView({ behavior: 'smooth' });
    document.querySelector(`#${CSS.escape(d.scroll)} .chip`)?.focus({ preventScroll: true });
    return;
  }

  if (t.tagName === 'A' && isInternalLink(t, e)) {
    e.preventDefault();
    closeDrawers(false);
    const u = new URL(t.href);
    if (u.pathname === location.pathname && u.search === location.search && u.hash) {
      history.replaceState({}, '', u.pathname + u.search + u.hash);
      document.getElementById(u.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    navigate(t.href);
    return;
  }

  if (d.retry !== undefined) { boot(); return; }
  if (d.add) { addToCart(d.add, d.variant); return; }
  if (d.fav) { e.preventDefault(); toggleFav(d.fav); return; }
  if (d.cq !== undefined || d.oq !== undefined) {
    const idx = Number(d.cq ?? d.oq);
    const line = cartView().lines.find((l) => l.index === idx);
    if (!line) return;
    state.cart = setQty(state.cart, idx, line.qty + Number(d.d));
    refreshCartViews();
    return;
  }
  if (d.crm !== undefined || d.orm !== undefined) {
    state.cart = removeAt(state.cart, Number(d.crm ?? d.orm));
    refreshCartViews();
    toast('Item removido da sacola.');
    return;
  }
  if (d.fq) { setAnswer(d.fq, d.fv); document.querySelector(`[data-fq="${d.fq}"][data-fv="${CSS.escape(d.fv)}"]`)?.focus(); return; }

  const p = route.name === 'product' ? state.bySlug.get(route.slug) : null;
  if (p && d.size !== undefined) { pdp.selectVariant(p, Number(d.size)); return; }
  if (p && d.pq) { pdp.changeQty(p, Number(d.pq)); return; }
  if (p && d.thumb !== undefined) { pdp.selectImage(p, Number(d.thumb)); return; }
  if (p && d.addPdp) { const sel = pdp.currentSelection(); addToCart(p.id, p.variants[sel.v].id, sel.qty); return; }

  if (d.rmf) { catalog.removeFilter(d.rmf, d.v); return; }
  if (d.clearf !== undefined) { catalog.clearFilters(); return; }
  if (t.id === 'ftog') {
    const f = document.getElementById('filters');
    f.classList.toggle('open');
    t.setAttribute('aria-expanded', String(f.classList.contains('open')));
    return;
  }
  if (d.copy) { copyText(d.copy); return; }
  if (d.copyOrder !== undefined) { copyText(currentMessage(), 'Mensagem do pedido copiada.'); }
});

document.getElementById('overlay').addEventListener('click', () => closeDrawers());
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeDrawers();
    document.querySelectorAll('.suggest').forEach((s) => { s.hidden = true; });
  }
});

document.addEventListener('change', (e) => {
  const t = e.target, d = t.dataset;
  if (d.f) { catalog.toggleFilter(d.f, t.value, t.checked); return; }
  if (d.fb) { catalog.setFlag(d.fb, t.checked); return; }
  if (t.id === 'sort') catalog.setSort(t.value);
});

let searchT;
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'cq') { clearTimeout(searchT); searchT = setTimeout(() => catalog.setQuery(t.value), 180); return; }
  if (t.closest('#o-form')) {
    if (t.name === 'cep') t.value = maskCep(t.value);
    updateCta();
    return;
  }
  if (t.closest('[data-search]')) suggest(t);
});

document.addEventListener('submit', async (e) => {
  const f = e.target;
  if (f.matches('[data-search]')) {
    e.preventDefault();
    const q = cleanText(f.q.value, 80);
    document.querySelectorAll('.suggest').forEach((s) => { s.hidden = true; });
    document.querySelectorAll('[data-search] input').forEach((i) => { i.value = ''; i.blur(); });
    navigate(`/perfumes${q ? `?q=${encodeURIComponent(q)}` : ''}`);
    return;
  }
  if (f.id === 'o-form') { e.preventDefault(); return; }
  if (f.id === 'news-form') { e.preventDefault(); await submitNewsletter(f); }
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
async function submitNewsletter(f) {
  const m = f.querySelector('#nl-msg');
  const btn = f.querySelector('button[type=submit]');
  const email = f.email.value.trim();
  const say = (cls, txt) => { m.className = `form-msg ${cls}`; m.textContent = txt; };
  if (f.website.value) { say('ok', 'Inscrição registrada.'); f.reset(); return; } // armadilha para robôs
  if (!EMAIL_RE.test(email) || email.length > 254) { say('err', 'Informe um e-mail válido, como nome@exemplo.com.'); f.email.focus(); return; }
  if (!f.consent.checked) { say('err', 'Marque a caixa de consentimento para receber nossos e-mails.'); f.consent.focus(); return; }
  if (!isSupabaseConfigured) { say('err', 'A newsletter ainda não está ativa. Fale com a loja pelo WhatsApp para receber novidades.'); return; }
  btn.disabled = true; say('', 'Enviando…');
  try {
    const r = await subscribeNewsletter(email, document.getElementById('nl-consent-text').textContent.trim());
    if (r.ok) { say('ok', 'Inscrição registrada. Obrigado!'); f.reset(); }
    else say('err', 'Não foi possível registrar agora. Tente novamente em instantes.');
  } catch {
    say('err', 'Sem conexão no momento. Tente novamente em instantes.');
  } finally { btn.disabled = false; }
}

function suggest(input) {
  const box = input.parentElement.querySelector('.suggest');
  const q = input.value.trim();
  if (q.length < 2 || state.status !== 'ready') { box.hidden = true; return; }
  const found = state.products.filter((p) => matchesQuery(p, q)).slice(0, 5);
  box.innerHTML = found.length
    ? found.map((p) => `<a href="${url.product(p)}"><span class="th">${img(p, { alt: '' })}</span><p><b style="font-weight:500">${esc(p.name)}</b><br><span class="muted">${esc(p.brand.name)}${p.family ? ` · ${esc(FAMILIES[p.family])}` : ''}</span></p><span class="tnum" style="font-size:13px">${brl(minPrice(p))}</span></a>`).join('') + '<button class="all" type="submit">Ver todos os resultados</button>'
    : `<p style="padding:14px" class="muted">Nada encontrado para “${esc(q)}”.</p>`;
  box.hidden = false;
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('[data-search]')) document.querySelectorAll('.suggest').forEach((s) => { s.hidden = true; });
  else if (e.target.closest('.suggest a')) {
    document.querySelectorAll('.suggest').forEach((s) => { s.hidden = true; });
    document.querySelectorAll('[data-search] input').forEach((i) => { i.value = ''; });
  }
});

/* Imagem quebrada: troca uma única vez pela imagem padrão. */
document.addEventListener('error', (e) => {
  const t = e.target;
  if (t instanceof HTMLImageElement && t.hasAttribute('data-fallback') && !t.dataset.failed) {
    t.dataset.failed = '1';
    t.src = FALLBACK_IMG;
  }
}, true);

window.addEventListener('popstate', () => render({ scroll: false, focus: true }));
window.addEventListener('storage', (e) => {
  // Outra aba alterou a sacola ou os favoritos: mantém esta aba em sincronia.
  if (e.key === KEYS.cart) { state.cart = sanitizeItems(load(KEYS.cart, [])); refreshCartViews(); }
  if (e.key === KEYS.favs) { state.favs = (load(KEYS.favs, []) || []).filter((x) => typeof x === 'string'); updateBadges(); if (route.name === 'favorites') render({ scroll: false }); }
});

/* ================= Inicialização ================= */
function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('Tempo de resposta esgotado')), ms))]);
}

export async function boot() {
  initPerfumeIntro();
  state.status = 'loading';
  renderChrome();
  render();
  try {
    setCatalog(await withTimeout(loadCatalog(), 15000));
  } catch (err) {
    state.status = 'error';
    state.error = err && err.message ? err.message : '';
    console.error('[Maison Aura] Falha ao carregar o catálogo:', err);
  }
  renderChrome();
  render({ scroll: false });
}

export const ready = boot();
