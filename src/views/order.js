// Revisão do pedido e abertura da conversa no WhatsApp.
import { state, KEYS, cartView } from '../state.js';
import { esc, brl, maskCep } from '../lib/format.js';
import { load, save } from '../lib/storage.js';
import { img, url, pageHead } from '../ui/components.js';
import { IC } from '../ui/icons.js';
import { MAX_QTY } from '../lib/cart.js';
import { storeWhatsApp, waUrl, buildOrderMessage, ORDER_LIMITS } from '../lib/whatsapp.js';

const draft = () => {
  const d = load(KEYS.draft, {});
  return d && typeof d === 'object' ? d : {};
};

export function viewOrder() {
  const cv = cartView();
  if (!cv.lines.length) {
    return `${pageHead('Revisão do pedido')}<div class="wrap"><div class="empty" style="padding-block:96px 120px"><h2>Sua sacola está vazia</h2><p class="muted">Escolha uma fragrância e o volume desejado para montar o pedido.</p><a href="/perfumes" class="btn">Explorar fragrâncias</a></div></div>`;
  }
  const d = draft();
  return `${pageHead('Revisão do pedido', 'Confira os itens. Ao continuar, abrimos o WhatsApp da loja com a mensagem pronta para você enviar.')}
  <div class="wrap order">
    <section aria-labelledby="o-items-title"><h2 id="o-items-title">Itens</h2><div class="o-items" id="o-items"></div>
      <p class="note muted" style="margin-top:16px;font-size:14px">Os itens continuam na sacola depois que você abrir o WhatsApp. Remova-os quando quiser.</p></section>
    <aside class="o-side" aria-labelledby="o-side-title">
      <h2 id="o-side-title">Resumo</h2>
      <div id="o-sum"></div>
      <form id="o-form" class="form-grid" novalidate>
        <p class="muted" style="grid-column:span 6;font-size:14px">Dados opcionais, só para agilizar o atendimento.</p>
        <div class="f"><label for="o-name">Nome <small>(opcional)</small></label><input id="o-name" name="name" maxlength="${ORDER_LIMITS.name}" autocomplete="name" value="${esc(d.name || '')}"></div>
        <div class="f s2"><label for="o-cep">CEP <small>(opcional)</small></label><input id="o-cep" name="cep" inputmode="numeric" autocomplete="postal-code" placeholder="00000-000" maxlength="9" value="${esc(maskCep(d.cep || ''))}"></div>
        <div class="f s4"><label for="o-city">Cidade ou região <small>(opcional)</small></label><input id="o-city" name="city" maxlength="${ORDER_LIMITS.city}" autocomplete="address-level2" value="${esc(d.city || '')}"></div>
        <div class="f"><label for="o-notes">Observações <small>(opcional)</small></label><textarea id="o-notes" name="notes" maxlength="${ORDER_LIMITS.notes}" placeholder="Ex.: é para presente, prefiro retirar, dúvida sobre o volume">${esc(d.notes || '')}</textarea><span class="hint" id="o-notes-count"></span></div>
      </form>
      <div id="o-cta"></div>
      <details class="pv"><summary>Ver a mensagem que será enviada</summary><pre class="preview" id="o-preview"></pre></details>
    </aside>
  </div>`;
}

function customer() {
  const f = document.getElementById('o-form');
  if (!f) return draft();
  return { name: f.name.value, cep: f.cep.value, city: f.city.value, notes: f.notes.value };
}

export function currentMessage() {
  const cv = cartView();
  return buildOrderMessage({ lines: cv.ok, customer: customer(), storeName: state.settings.store_name });
}

export function renderOrder() {
  const box = document.getElementById('o-items');
  if (!box) return;
  const cv = cartView();
  if (!cv.lines.length) { document.getElementById('app').innerHTML = viewOrder(); return; }

  box.innerHTML = cv.lines.map((l) => {
    if (l.status === 'missing') {
      return `<div class="o-item off"><span class="th"></span><div><h3>Produto indisponível</h3><p class="meta">Este item não está mais no catálogo e não entra no pedido.</p><div class="ctrl"><button type="button" class="rm" data-orm="${l.index}">Remover</button></div></div><span></span></div>`;
    }
    const p = l.product, v = l.variant;
    const max = Math.min(MAX_QTY, v.stock);
    return `<div class="o-item${l.status === 'ok' ? '' : ' off'}">
      <a href="${url.product(p)}" class="th" tabindex="-1" aria-hidden="true">${img(p, { alt: '' })}</a>
      <div>
        <p class="meta" style="letter-spacing:.14em;text-transform:uppercase;font-size:11px">${esc(p.brand.name)}${p.is_demo ? ' · demonstração' : ''}</p>
        <h3><a href="${url.product(p)}">${esc(p.name)}</a></h3>
        <p class="meta">${[p.concentration, v.label].filter(Boolean).map(esc).join(' · ')}</p>
        <p class="unit">Preço unitário: <span class="tnum">${brl(l.unit)}</span></p>
        ${l.status === 'out' ? '<p class="meta" style="color:var(--err)">Indisponível no momento: não entra no pedido.</p>' : ''}
        ${l.reduced ? `<p class="meta" style="color:var(--err)">Quantidade ajustada ao estoque disponível (${l.qty}).</p>` : ''}
        <div class="ctrl">
          ${l.status === 'ok' ? `<div class="stepper" role="group" aria-label="Quantidade de ${esc(p.name)}"><button type="button" data-oq="${l.index}" data-d="-1" aria-label="Diminuir quantidade">−</button><span>${l.qty}</span><button type="button" data-oq="${l.index}" data-d="1" aria-label="Aumentar quantidade" ${l.qty >= max ? 'disabled' : ''}>+</button></div>` : ''}
          <button type="button" class="rm" data-orm="${l.index}">Remover</button>
        </div>
      </div>
      <p class="line">${l.status === 'ok' ? `<span class="sr">Subtotal do item: </span>${brl(l.total)}` : '—'}</p>
    </div>`;
  }).join('');

  document.getElementById('o-sum').innerHTML = `
    <div class="sum-row"><span>${cv.count} ${cv.count === 1 ? 'item' : 'itens'}</span><span class="tnum">${brl(cv.subtotal)}</span></div>
    <div class="sum-row"><span>Frete</span><span>a combinar</span></div>
    <div class="sum-row total"><span>Subtotal</span><span class="tnum">${brl(cv.subtotal)}</span></div>
    <p class="muted" style="font-size:13.5px">Frete, forma de pagamento e disponibilidade são confirmados pela loja no WhatsApp.</p>`;
  updateCta();
}

export function updateCta() {
  const cta = document.getElementById('o-cta');
  if (!cta) return;
  const cv = cartView();
  const msg = currentMessage();
  document.getElementById('o-preview').textContent = msg;
  const notes = document.getElementById('o-notes');
  if (notes) document.getElementById('o-notes-count').textContent = `${notes.value.length} de ${ORDER_LIMITS.notes} caracteres`;
  save(KEYS.draft, customer());

  if (!cv.ok.length) {
    cta.innerHTML = '<p class="alert">Nenhum item disponível para o pedido. Remova os itens indisponíveis ou escolha outra fragrância.</p>';
    return;
  }
  if (!storeWhatsApp.ok) {
    cta.innerHTML = `<p class="alert err" role="alert"><b>Não é possível abrir o WhatsApp agora.</b> O número da loja ainda não foi configurado. Copie a mensagem abaixo para enviar quando o atendimento estiver disponível.</p>
      <button type="button" class="btn ghost block" data-copy-order>Copiar mensagem do pedido</button>`;
    return;
  }
  const href = waUrl(msg);
  cta.innerHTML = `<a class="btn wa block" id="wa-send" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${IC.whatsapp}Abrir conversa no WhatsApp</a>
    <p class="muted" style="font-size:13px">O pedido só é confirmado quando a loja responder na conversa.</p>
    <p id="wa-status" role="status"></p>
    <button type="button" class="link" style="justify-self:start" data-copy-order>Copiar mensagem</button>`;
}

/** Depois do clique: não afirmamos que a mensagem foi enviada. */
export function afterOpen() {
  const s = document.getElementById('wa-status');
  if (s) {
    s.className = 'alert';
    s.textContent = 'Abrimos o WhatsApp em outra aba com a mensagem pronta. Envie a mensagem por lá para falar com a loja. Se a conversa não abriu, use o botão “Copiar mensagem”.';
  }
}
