import { state } from '../state.js';
import { esc, cleanText } from '../lib/format.js';
import { applyFilters, facets, emptyFilters, PRICE_RANGES, SORTS } from '../lib/filters.js';
import { card, pageHead } from '../ui/components.js';
import { IC } from '../ui/icons.js';
import { GENDERS, FAMILIES } from '../data/labels.js';

let fs = emptyFilters();
let current = null;

const GROUPS = [['price', 'Preço'], ['brand', 'Marca'], ['gender', 'Gênero'], ['family', 'Família olfativa'], ['conc', 'Concentração'], ['ml', 'Volume']];

/** Lê ?q= e ?ordem= da URL com validação. */
function readParams() {
  const sp = new URLSearchParams(location.search);
  const q = cleanText(sp.get('q') || '', 80);
  const ordem = sp.get('ordem');
  return { q, sort: SORTS[ordem] ? ordem : 'rel' };
}

function writeParams() {
  const sp = new URLSearchParams();
  if (fs.q) sp.set('q', fs.q);
  if (fs.sort !== 'rel') sp.set('ordem', fs.sort);
  const qs = sp.toString();
  history.replaceState(history.state, '', location.pathname + (qs ? `?${qs}` : ''));
}

export function viewCatalog(col) {
  const p = readParams();
  if (!current || current.key !== col.key) fs = emptyFilters();
  current = col;
  fs.q = p.q; fs.sort = p.sort;
  return `${pageHead(col.title, col.sub)}
  <div class="wrap cat-layout">
    <aside class="filters" id="filters" aria-label="Filtros"></aside>
    <div style="min-width:0">
      <div class="toolbar">
        <div class="inp">${IC.search}<label for="cq" class="sr">Buscar nesta seleção</label><input id="cq" type="search" maxlength="80" placeholder="Nome, marca, nota ou família" value="${esc(fs.q)}"></div>
        <div class="tb-right">
          <button class="btn ghost sm f-toggle" id="ftog" type="button" aria-expanded="false" aria-controls="filters">Filtros</button>
          <span class="muted tnum" id="cnt" style="font-size:14px" aria-live="polite"></span>
          <label for="sort" class="sr">Ordenar por</label>
          <select class="sel" id="sort">${Object.entries(SORTS).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
        </div>
      </div>
      <div class="chips-active" id="act"></div>
      <div id="cat-grid"></div>
    </div>
  </div>`;
}

export function renderCatalog() {
  if (!current || !document.getElementById('cat-grid')) return;
  const base = state.products.filter(current.test);
  const list = applyFilters(base, fs);
  const fc = facets(base);

  document.getElementById('filters').innerHTML = GROUPS.map(([key, title]) => {
    const opts = fc[key].filter(([v, , n]) => n > 0 || fs[key].includes(v));
    if (opts.length < 2 && !fs[key].length) return '';
    return `<fieldset class="fg"><legend>${title}</legend>${opts.map(([v, l, n]) => `<label><input type="checkbox" data-f="${key}" value="${esc(v)}" ${fs[key].includes(v) ? 'checked' : ''}>${esc(l)}<span>${n}</span></label>`).join('')}</fieldset>`;
  }).join('') + `<fieldset class="fg"><legend>Disponibilidade</legend><label><input type="checkbox" data-fb="stock" ${fs.stock ? 'checked' : ''}>Somente disponíveis</label><label><input type="checkbox" data-fb="promo" ${fs.promo ? 'checked' : ''}>Somente ofertas</label></fieldset>`;

  document.getElementById('sort').value = fs.sort;
  document.getElementById('cnt').textContent = `${list.length} ${list.length === 1 ? 'produto' : 'produtos'}`;

  const label = (k, v) => ({
    price: () => PRICE_RANGES.find((r) => r.id === v)?.label,
    brand: () => fc.brand.find((b) => b[0] === v)?.[1] || v,
    gender: () => GENDERS[v], family: () => FAMILIES[v], ml: () => `${v} ml`, conc: () => v,
  }[k]());
  const act = [];
  if (fs.q) act.push(['q', '', `Busca: ${fs.q}`]);
  GROUPS.forEach(([k]) => fs[k].forEach((v) => act.push([k, v, label(k, v)])));
  if (fs.stock) act.push(['stock', '', 'Disponíveis']);
  if (fs.promo) act.push(['promo', '', 'Ofertas']);
  document.getElementById('act').innerHTML = act.length
    ? act.map(([k, v, l]) => `<button type="button" data-rmf="${k}" data-v="${esc(v)}">${esc(l)} <span aria-hidden="true">×</span><span class="sr">(remover filtro)</span></button>`).join('') + '<button type="button" class="clear" data-clearf>Limpar tudo</button>'
    : '';

  document.getElementById('cat-grid').innerHTML = list.length
    ? `<div class="grid three">${list.map(card).join('')}</div>`
    : base.length
      ? `<div class="state"><h2>Nenhuma fragrância encontrada</h2><p>Nenhum produto atende a todos os filtros${fs.q ? ` e à busca “${esc(fs.q)}”` : ''}. Remova algum filtro ou tente outra palavra, como uma nota (“baunilha”), uma família (“cítrico”) ou uma marca.</p><button class="btn ghost" type="button" data-clearf>Limpar filtros</button></div>`
      : '<div class="state"><h2>Esta seleção está vazia no momento</h2><p>Ainda não há produtos aqui. Veja todas as fragrâncias ou peça uma indicação pelo WhatsApp.</p><a class="btn ghost" href="/perfumes">Ver todas as fragrâncias</a></div>';
}

/* Ações vindas dos eventos globais */
export function toggleFilter(key, value, on) {
  if (!Array.isArray(fs[key])) return;
  fs[key] = on ? [...new Set([...fs[key], value])] : fs[key].filter((v) => v !== value);
  renderCatalog();
}
export function setFlag(key, on) { if (key === 'promo' || key === 'stock') { fs[key] = on; renderCatalog(); } }
export function setSort(v) { fs.sort = SORTS[v] ? v : 'rel'; writeParams(); renderCatalog(); }
export function setQuery(q) { fs.q = cleanText(q, 80); writeParams(); renderCatalog(); }
export function removeFilter(key, value) {
  if (key === 'q') { fs.q = ''; const i = document.getElementById('cq'); if (i) i.value = ''; writeParams(); }
  else if (key === 'promo' || key === 'stock') fs[key] = false;
  else if (Array.isArray(fs[key])) fs[key] = fs[key].filter((v) => v !== value);
  renderCatalog();
}
export function clearFilters() {
  fs = emptyFilters();
  const i = document.getElementById('cq'); if (i) i.value = '';
  writeParams();
  renderCatalog();
}
