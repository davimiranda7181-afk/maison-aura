import { state, KEYS } from '../state.js';
import { esc, brl } from '../lib/format.js';
import { load, save } from '../lib/storage.js';
import { card, img, url, skeletonGrid } from '../ui/components.js';
import { IC } from '../ui/icons.js';
import { FAMILIES, OCCASIONS, INTENSITY, STYLES_PLURAL } from '../data/labels.js';
import { recommend, matchLabel } from '../lib/finder.js';
import { minPrice, isAvailable } from '../lib/product.js';
import { COLLECTIONS, countIn } from './categories.js';

const CAT_CARDS = [
  ['femininos', 'Perfumes femininos', 'cat'],
  ['masculinos', 'Perfumes masculinos', 'cat dark'],
  ['unissex', 'Fragrâncias unissex', 'cat'],
  ['importados', 'Perfumes importados', 'cat'],
  ['kits', 'Kits para presente', 'cat deep'],
  ['novidades', 'Novidades', 'cat'],
];

const pick = (test) => state.products.filter(test).find(isAvailable) || state.products.find(test);

export function viewHome() {
  const featured = state.products.filter((p) => p.featured && isAvailable(p)).slice(0, 8);
  const shelf = featured.length ? featured : state.products.filter(isAvailable).slice(0, 8);
  const hero = state.products.find((p) => p.featured && isAvailable(p) && p.type === 'perfume') || state.products[0];
  const cats = CAT_CARDS.map(([k, t, cls]) => ({ k, t, cls, n: countIn(COLLECTIONS[k].test), p: pick(COLLECTIONS[k].test) })).filter((c) => c.n > 0);
  const night = state.products.filter((p) => p.type === 'perfume' && p.occasions.includes('noite') && isAvailable(p)).slice(0, 3);
  const heroNotes = hero?.notes ? [...hero.notes.top.slice(0, 1), ...hero.notes.heart.slice(0, 1), ...hero.notes.base.slice(0, 2)] : [];

  return `
  <section class="hero" aria-labelledby="hero-title"><div class="wrap">
    <div class="reveal"><span class="eyebrow">${esc(state.settings.store_name)} · Perfumaria</span>
      <h1 id="hero-title">Uma fragrância.<br>Uma identidade <em>inesquecível.</em></h1>
      <p class="sub">Descubra fragrâncias que traduzem sua personalidade e transformam cada momento em uma memória.</p>
      <div class="ctas"><a href="/perfumes" class="btn light">Explorar fragrâncias</a><a href="/#encontre" class="btn line-light" data-scroll="encontre">Descobrir sua essência</a><button type="button" class="btn line-light" data-replay-intro style="cursor:pointer">✦ Ver Perfume 3D</button></div>
    </div>
    ${hero ? `<a href="${url.product(hero)}" class="stage" aria-label="Ver ${esc(hero.name)}">
      <span class="halo"></span><span class="ring"></span><span class="ring b"></span>${img(hero, { eager: true })}
      ${heroNotes[0] ? `<span class="tag t1">${esc(heroNotes[0])}</span>` : ''}${heroNotes[1] ? `<span class="tag t2">${esc(heroNotes[1])}</span>` : ''}${heroNotes[2] ? `<span class="tag t3">${esc(heroNotes.slice(2).join(' · '))}</span>` : ''}
    </a>` : ''}
  </div></section>

  ${cats.length ? `<section class="blk bg-paper" aria-labelledby="cats-title"><div class="wrap">
    <div class="sec-head"><div><span class="eyebrow">Categorias</span><h2 id="cats-title">Por onde começar</h2></div><p>Navegue pelas seleções da boutique.</p></div>
    <div class="cats">${cats.map((c) => `<a href="/${c.k}" class="${c.cls}"><div><h3>${esc(c.t)}</h3><p class="tnum">${c.n} ${c.n === 1 ? 'item' : 'itens'}</p><span class="go">Ver seleção <i></i></span></div>${c.p ? img(c.p, { alt: '' }) : ''}</a>`).join('')}</div>
  </div></section>` : ''}

  <section class="blk bg-sand" aria-labelledby="shelf-title"><div class="wrap">
    <div class="sec-head"><div><span class="eyebrow">Vitrine</span><h2 id="shelf-title">Seleção da boutique</h2></div><a href="/perfumes" class="link">Ver todas as fragrâncias</a></div>
    ${shelf.length ? `<div class="grid">${shelf.map(card).join('')}</div>` : '<p class="muted">Ainda não há produtos disponíveis. Volte em breve ou fale com a loja pelo WhatsApp.</p>'}
  </div></section>

  ${night.length >= 2 ? `<section class="edit" aria-labelledby="edit-title">
    <div class="visual"><div class="cap"><span>Coleção</span><span>Para depois das oito</span></div><span class="big" aria-hidden="true">Nuit</span>${img(night[0], { alt: '' })}</div>
    <div class="copy"><span class="eyebrow">Coleção noturna</span><h2 id="edit-title">Noturna, <em>em madeiras e resinas</em></h2>
      <p class="lede">Fragrâncias cadastradas para a noite: presença, profundidade e um rastro que acompanha a pele.</p>
      <ul>${night.map((p) => `<li><a href="${url.product(p)}"><span class="th">${img(p, { alt: '' })}</span><span><h3>${esc(p.name)}</h3><p>${esc(p.brand.name)}${p.family ? ` · ${esc(FAMILIES[p.family])}` : ''}</p></span><span class="tnum" style="font-size:14px">${brl(minPrice(p))}</span></a></li>`).join('')}</ul>
      <div><a href="/perfumes?q=noite" class="btn">Ver fragrâncias para a noite</a></div>
    </div>
  </section>` : ''}

  <section class="blk bg-paper" id="encontre" aria-labelledby="finder-title"><div class="wrap">
    <div class="sec-head"><div><span class="eyebrow">Encontre sua fragrância</span><h2 id="finder-title">Descubra sua essência</h2></div><p>As sugestões cruzam suas escolhas com a família, as ocasiões, a intensidade e o estilo cadastrados em cada perfume.</p></div>
    <div class="finder"><div id="finder-q"></div><div><div class="results" id="finder-r" aria-live="polite"></div></div></div>
  </div></section>

  ${state.settings.benefits.some((b) => b.on) ? `<section style="padding-block:clamp(56px,7vw,96px)" class="bg-paper" aria-label="Como funciona a loja"><div class="wrap"><div class="benefits">${state.settings.benefits.filter((b) => b.on).map((b) => `<div class="bf">${IC[b.icon] || IC.info}<h3>${esc(b.title)}</h3><p>${esc(b.text)}</p></div>`).join('')}</div></div></section>` : ''}

  <section class="blk bg-sand" aria-labelledby="news-title"><div class="wrap news">
    <div><span class="eyebrow">Newsletter</span><h2 id="news-title" style="margin-top:12px">Lançamentos e edições limitadas</h2><p class="muted" style="margin-top:14px;max-width:44ch">Receba novidades da boutique por e-mail. Cancele quando quiser.</p></div>
    <form id="news-form" novalidate>
      <div class="field-row"><label for="nl-email" class="sr">Seu e-mail</label><input id="nl-email" name="email" type="email" maxlength="254" placeholder="Seu melhor e-mail" autocomplete="email" required><button type="submit">Inscrever</button></div>
      <div class="hp" aria-hidden="true"><label for="nl-site">Não preencha</label><input id="nl-site" name="website" tabindex="-1" autocomplete="off"></div>
      <label class="consent"><input type="checkbox" id="nl-ok" name="consent" required><span id="nl-consent-text">Aceito receber comunicações de marketing da ${esc(state.settings.store_name)} por e-mail, conforme a <a href="/privacidade" class="u-link">Política de Privacidade</a>. Posso cancelar a qualquer momento.</span></label>
      <p class="form-msg" id="nl-msg" role="status"></p>
    </form>
  </div></section>`;
}

export function viewHomeLoading() {
  return `<section class="hero"><div class="wrap"><div><span class="eyebrow">Perfumaria</span><h1>Uma fragrância.<br>Uma identidade <em>inesquecível.</em></h1><p class="sub">Carregando a vitrine…</p></div></div></section>
  <section class="blk bg-sand"><div class="wrap">${skeletonGrid(4)}</div></section>`;
}

/* ---------- Encontre sua fragrância ---------- */
const QUESTIONS = [
  ['family', 'Família olfativa', FAMILIES],
  ['occasion', 'Ocasião', OCCASIONS],
  ['intensity', 'Intensidade', INTENSITY],
  ['style', 'Estilo preferido', STYLES_PLURAL],
];
let answers = null;

export function renderFinder() {
  const q = document.getElementById('finder-q');
  const r = document.getElementById('finder-r');
  if (!q || !r) return;
  if (!answers) {
    const saved = load(KEYS.finder, null);
    answers = { family: 'floral', occasion: 'diaadia', intensity: '2', style: 'discreta', ...(saved && typeof saved === 'object' ? saved : {}) };
  }
  q.innerHTML = QUESTIONS.map(([k, t, opts]) => `<div class="q" role="group" aria-labelledby="fq-${k}"><h3 id="fq-${k}">${t}<span>${answers[k] ? esc(opts[answers[k]]) : 'Sem preferência'}</span></h3>
    <div class="chips">${Object.entries(opts).map(([v, l]) => `<button type="button" class="chip" data-fq="${k}" data-fv="${esc(v)}" aria-pressed="${answers[k] === v}">${esc(l)}</button>`).join('')}</div></div>`).join('');
  const list = recommend(state.products, answers);
  if (!Object.values(answers).some(Boolean)) { r.innerHTML = '<p class="muted">Escolha ao menos uma opção para ver sugestões.</p>'; return; }
  if (!list.length) { r.innerHTML = '<div class="res" style="grid-template-columns:1fr"><div><h3>Nenhum perfume cadastrado com essas características</h3><p class="muted" style="margin-top:8px">Tente outra combinação ou peça uma indicação pelo WhatsApp.</p></div></div>'; return; }
  r.innerHTML = list.map((x) => `<div class="res"><a href="${url.product(x.product)}" class="th" tabindex="-1" aria-hidden="true">${img(x.product, { alt: '' })}</a><div style="min-width:0">
    <p class="match">${esc(matchLabel(x))}</p><h3><a href="${url.product(x.product)}">${esc(x.product.name)}</a></h3>
    <p class="muted" style="font-size:13.5px">${esc(x.product.brand.name)}${x.product.concentration ? ` · ${esc(x.product.concentration)}` : ''}${x.product.family ? ` · ${esc(FAMILIES[x.product.family])}` : ''}</p>
    ${x.hits.length ? `<div class="why" aria-label="Características em comum">${x.hits.map((h) => `<span>${esc(h)}</span>`).join('')}</div>` : '<div class="why"><span>Intensidade próxima</span></div>'}
    <div class="res-actions">${isAvailable(x.product) ? `<span class="tnum" style="font-weight:500">${brl(minPrice(x.product))}</span>` : '<span class="muted">Indisponível</span>'}<a href="${url.product(x.product)}" class="link">Conhecer</a></div></div></div>`).join('')
    + '<p class="finder-note">Sugestões baseadas nas características cadastradas. Seu nariz decide: peça ajuda pelo WhatsApp se ficar em dúvida.</p>';
}

export function setAnswer(k, v) {
  answers[k] = answers[k] === v ? '' : v;
  save(KEYS.finder, answers);
  renderFinder();
}
