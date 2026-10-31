// Cabeçalho, rodapé, gavetas, sacola, aviso flutuante e botão do WhatsApp.
import { state, cartView } from '../state.js';
import { esc, brl, safeUrl } from '../lib/format.js';
import { img, url } from './components.js';
import { IC } from './icons.js';
import { NAV, COLLECTIONS, countIn } from '../views/categories.js';
import { storeWhatsApp, waUrl, formatPhone, GENERAL_MESSAGE } from '../lib/whatsapp.js';
import { MAX_QTY } from '../lib/cart.js';

const $ = (s) => document.querySelector(s);

export function renderChrome() {
  const s = state.settings;
  $('#topbar-text').textContent = s.topbar_message || '';
  $('.topbar').hidden = !s.topbar_message;
  $('#demo-strip').hidden = state.mode !== 'demo';
  $('#nav-list').innerHTML = NAV.map(([h, l]) => `<li><a href="${h}" data-nav="${h}">${l}</a></li>`).join('');
  $('#m-nav').innerHTML = NAV.map(([h, l]) => {
    const key = h.slice(1);
    const n = key && COLLECTIONS[key] ? countIn(COLLECTIONS[key].test) : null;
    return `<a href="${h}" data-nav="${h}">${l}<span>${n == null ? '' : n}</span></a>`;
  }).join('');
  renderFooter();
  renderFab();
  updateBadges();
}

export function markNav(path) {
  document.querySelectorAll('[data-nav]').forEach((a) => {
    if (a.dataset.nav === path) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

export function updateBadges() {
  const n = state.status === 'ready' ? cartView().count : state.cart.reduce((a, i) => a + i.qty, 0);
  const c = $('#cart-count'); c.textContent = n; c.dataset.n = n;
  const favN = state.status === 'ready' ? state.favs.filter((id) => state.byId.has(id)).length : state.favs.length;
  const f = $('#fav-count'); f.textContent = favN; f.dataset.n = favN;
  $('[data-open-cart]').setAttribute('aria-label', n ? `Abrir sacola, ${n} ${n === 1 ? 'item' : 'itens'}` : 'Abrir sacola, vazia');
}

function renderFooter() {
  const s = state.settings;
  const socials = [['Instagram', s.instagram_url], ['TikTok', s.tiktok_url], ['Facebook', s.facebook_url]]
    .map(([n, u]) => [n, safeUrl(u, { allowRelative: false })]).filter(([, u]) => u);
  const wa = waUrl(GENERAL_MESSAGE);
  const company = [s.company_name, s.cnpj ? `CNPJ ${s.cnpj}` : '', s.address].filter(Boolean).map(esc).join(' · ');
  $('#footer').innerHTML = `<div class="wrap ft">
    <div><a href="/" class="logo"><b>MAISON AURA</b><small>Sua essência. Sua assinatura.</small></a>
      <p class="about">Perfumaria multimarcas com atendimento e pedidos pelo WhatsApp. <a href="/sobre" class="u-link">Sobre a loja</a></p>
      ${socials.length ? `<ul style="margin-top:20px;display:flex;gap:18px;flex-wrap:wrap">${socials.map(([n, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${n}</a></li>`).join('')}</ul>` : ''}</div>
    <div><h2>Atendimento</h2><ul>
      ${wa ? `<li><a href="${esc(wa)}" target="_blank" rel="noopener noreferrer">WhatsApp ${esc(formatPhone(storeWhatsApp.number))}</a></li>` : ''}
      ${s.contact_email ? `<li class="copyable"><span>${esc(s.contact_email)}</span><button type="button" data-copy="${esc(s.contact_email)}">Copiar</button></li>` : ''}
      ${s.opening_hours ? `<li>${esc(s.opening_hours)}</li>` : ''}
      <li><a href="/contato">Contato</a></li><li><a href="/faq">Perguntas frequentes</a></li></ul></div>
    <div><h2>Políticas</h2><ul><li><a href="/privacidade">Política de privacidade</a></li><li><a href="/termos">Termos de uso</a></li><li><a href="/trocas">Trocas e devoluções</a></li><li><a href="/entrega">Informações de entrega</a></li></ul></div>
    <div><h2>Pagamento</h2>${s.payment_methods.length
      ? `<div class="pay">${s.payment_methods.map((p) => `<span>${esc(p)}</span>`).join('')}</div><p style="margin-top:12px;font-size:13.5px">Confirmado no atendimento pelo WhatsApp.</p>`
      : '<p style="font-size:14px">As formas de pagamento são informadas no atendimento pelo WhatsApp.</p>'}</div>
  </div>
  <div class="wrap ft-bot"><span>© ${new Date().getFullYear()} ${esc(s.store_name)}${company ? ` · ${company}` : ''}</span>${state.mode === 'demo' ? '<span>Vitrine de demonstração: produtos e preços fictícios.</span>' : ''}</div>`;
}

function renderFab() {
  const slot = $('#wa-fab-slot');
  const href = waUrl(GENERAL_MESSAGE);
  slot.innerHTML = href ? `<a class="wa-fab" href="${esc(href)}" target="_blank" rel="noopener noreferrer" aria-label="Falar com a loja pelo WhatsApp">${IC.whatsapp}<span>Atendimento</span></a>` : '';
}

export function setFabVisible(on) {
  const a = $('.wa-fab');
  if (a) a.hidden = !on;
}

/* ---------- Gavetas ---------- */
let lastFocus = null;
const BACKGROUND = ['.topbar', '#demo-strip', 'header.site', '#app', '#footer', '#wa-fab-slot'];
const setBackgroundInert = (on) => BACKGROUND.forEach((s) => { const el = $(s); if (el) el.inert = on; });

export function openDrawer(id) {
  closeDrawers(false);
  lastFocus = document.activeElement;
  const d = document.getElementById(id);
  d.inert = false;
  d.classList.add('on');
  $('#overlay').classList.add('on');
  document.body.classList.add('drawer-open');
  setBackgroundInert(true);
  if (id === 'mmenu') $('#menu-open').setAttribute('aria-expanded', 'true');
  if (id === 'cart') renderCart();
  setTimeout(() => d.querySelector('[data-close]')?.focus(), 30);
}
export function closeDrawers(restore = true) {
  const wasOpen = document.querySelector('.drawer.on');
  document.querySelectorAll('.drawer').forEach((d) => { d.classList.remove('on'); d.inert = true; });
  $('#overlay').classList.remove('on');
  document.body.classList.remove('drawer-open');
  setBackgroundInert(false);
  $('#menu-open')?.setAttribute('aria-expanded', 'false');
  if (restore && wasOpen && lastFocus && document.contains(lastFocus)) lastFocus.focus();
}
export const cartOpen = () => $('#cart').classList.contains('on');

export function renderCart() {
  const body = $('#cart-body'), foot = $('#cart-foot');
  if (state.status !== 'ready') { body.innerHTML = '<p class="muted" style="padding:24px 0">Carregando a sacola…</p>'; foot.innerHTML = ''; return; }
  const cv = cartView();
  if (!cv.lines.length) {
    body.innerHTML = '<div class="empty"><h3>Sua sacola está vazia</h3><p class="muted">Explore as fragrâncias e escolha o volume ideal para você.</p><a href="/perfumes" class="btn">Explorar fragrâncias</a></div>';
    foot.innerHTML = '';
    return;
  }
  body.innerHTML = cv.lines.map((l) => {
    if (l.status === 'missing') return `<div class="ci off"><span class="th"></span><div><h3>Produto indisponível</h3><p class="warn">Este item saiu do catálogo.</p><div style="margin-top:10px"><button type="button" class="rm" data-crm="${l.index}">Remover</button></div></div></div>`;
    const p = l.product, v = l.variant, max = Math.min(MAX_QTY, v.stock);
    return `<div class="ci${l.status === 'ok' ? '' : ' off'}"><a href="${url.product(p)}" class="th" tabindex="-1" aria-hidden="true">${img(p, { alt: '' })}</a><div>
      <p class="kick">${esc(p.brand.name)}</p><h3><a href="${url.product(p)}">${esc(p.name)}</a></h3>
      <p class="meta">${[p.concentration, v.label].filter(Boolean).map(esc).join(' · ')} · <span class="tnum">${brl(l.unit)}</span> cada</p>
      ${l.status === 'out' ? '<p class="warn">Indisponível no momento.</p>' : ''}${l.reduced ? `<p class="warn">Restam ${v.stock} unidades; quantidade ajustada.</p>` : ''}
      <div class="ci-row">${l.status === 'ok' ? `<div class="stepper" role="group" aria-label="Quantidade de ${esc(p.name)}"><button type="button" data-cq="${l.index}" data-d="-1" aria-label="Diminuir quantidade">−</button><span>${l.qty}</span><button type="button" data-cq="${l.index}" data-d="1" aria-label="Aumentar quantidade" ${l.qty >= max ? 'disabled' : ''}>+</button></div><b class="tnum" style="font-weight:500">${brl(l.total)}</b>` : ''}</div>
      <div style="margin-top:10px"><button type="button" class="rm" data-crm="${l.index}">Remover</button></div></div></div>`;
  }).join('');
  foot.innerHTML = `<div class="sum-row"><span>Subtotal</span><b class="tnum" style="font-weight:500">${brl(cv.subtotal)}</b></div>
    <p class="muted" style="font-size:13.5px">Frete e pagamento combinados com a loja pelo WhatsApp.</p>
    ${cv.ok.length ? '<a href="/pedido" class="btn wa block" data-close-nav>' + IC.whatsapp + 'Finalizar pedido pelo WhatsApp</a>' : '<p class="alert">Nenhum item disponível para pedir.</p>'}
    <button type="button" class="link" style="justify-self:center" data-close>Continuar comprando</button>`;
}

/* ---------- Aviso flutuante ---------- */
let toastT;
export function toast(msg, action) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button" ${action.attr}>${esc(action.label)}</button>` : ''}`;
  t.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('on'), 3600);
}
