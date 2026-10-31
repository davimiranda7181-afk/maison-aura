// Painel administrativo. Autenticação pelo Supabase Auth; autorização pela tabela admin_users
// e pelas políticas RLS do banco. Nada aqui concede permissão: o banco recusa quem não é administrador.
import '../styles/store.css';
import './admin.css';
import { isSupabaseConfigured, SUPABASE_KEY_REJECTED } from '../lib/config.js';
import { getSupabase } from '../lib/supabase.js';
import { esc, brl, slugify, isSlug, isCnpj, safeUrl } from '../lib/format.js';
import { FAMILIES, OCCASIONS, STYLES, INTENSITY, GENDERS, CONCENTRATIONS } from '../data/labels.js';
import { DEFAULT_SETTINGS, BENEFIT_ICONS, mergeSettings } from '../data/default-settings.js';
import { storeWhatsApp, formatPhone } from '../lib/whatsapp.js';

const root = document.getElementById('admin');
const userBox = document.getElementById('adm-user');
let sb = null;
let session = null;
let entered = null; // id do usuário cujo painel já está aberto
let tab = 'produtos';
let data = { brands: [], categories: [], products: [] };

/* ---------- utilidades ---------- */
let toastT;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3800);
}

/** Mensagens claras para os erros do banco. */
function dbError(e) {
  const m = e?.message || String(e || '');
  if (e?.code === '23505') return /sku/.test(m) ? 'Já existe um volume com este SKU.' : 'Já existe um cadastro com este endereço (slug) ou nome.';
  if (e?.code === '23503') return 'Este item está em uso por outros cadastros e não pode ser excluído.';
  if (e?.code === '23514') return 'Algum valor está fora do permitido. Confira preços (a promoção deve ser menor que o preço), estoque e campos obrigatórios.';
  if (e?.code === '42501' || /row-level security|Permissão negada|permission denied/i.test(m)) return 'Sua conta não tem permissão para esta ação.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Sem conexão com o banco de dados. Verifique a internet e tente de novo.';
  return m || 'Não foi possível concluir a operação.';
}

const field = (id, label, value = '', { type = 'text', cls = '', attrs = '', hint = '' } = {}) => `<div class="f ${cls}"><label for="${id}">${label}</label><input id="${id}" name="${id}" type="${type}" value="${esc(value)}" ${attrs}>${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
const area = (id, label, value = '', { rows = 5, hint = '', max = 8000 } = {}) => `<div class="f"><label for="${id}">${label}</label><textarea id="${id}" name="${id}" rows="${rows}" maxlength="${max}">${esc(value)}</textarea>${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
const select = (id, label, options, value, { cls = '', empty = '' } = {}) => `<div class="f ${cls}"><label for="${id}">${label}</label><select id="${id}" name="${id}">${empty ? `<option value="">${empty}</option>` : ''}${options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(value ?? '') ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`;
const checks = (name, options, values) => `<div class="checks">${options.map(([v, l]) => `<label><input type="checkbox" name="${name}" value="${esc(v)}" ${values.includes(v) ? 'checked' : ''}>${esc(l)}</label>`).join('')}</div>`;
const list = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
const lines = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);
const num = (v) => (v === '' || v == null ? null : Number(String(v).replace(',', '.')));

/* ---------- estados sem banco ---------- */
function viewNotConfigured() {
  root.innerHTML = `<div class="login" style="max-width:720px"><h1>Painel indisponível</h1>
    ${SUPABASE_KEY_REJECTED ? '<p class="alert err"><b>Chave privilegiada detectada e bloqueada.</b> A variável VITE_SUPABASE_ANON_KEY contém uma chave service_role/secret. Troque essa chave no painel do Supabase (ela foi exposta) e use a chave pública anon/publishable.</p>' : ''}
    <p>O painel grava produtos, preços, estoque e configurações no Supabase, que ainda não está configurado. Enquanto isso, a loja mostra o catálogo de demonstração e nada pode ser editado.</p>
    <div class="box"><h2>Como ativar</h2><ol class="steps">
      <li>Crie um projeto em supabase.com.</li>
      <li>No SQL Editor, execute <code>supabase/schema.sql</code>.</li>
      <li>Em Authentication → Users, crie o usuário administrador e execute <code>supabase/add-admin.sql</code> com o e-mail dele.</li>
      <li>Preencha <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> no arquivo <code>.env</code> (ou nas variáveis do serviço de hospedagem) e publique de novo.</li>
    </ol><p class="muted">O passo a passo completo está no README do projeto.</p></div></div>`;
}

/* ---------- autenticação ---------- */
function viewLogin(msg = '') {
  userBox.innerHTML = '';
  root.innerHTML = `<form class="login" id="login" novalidate><h1>Entrar no painel</h1>
    <p class="muted">Acesso restrito a administradores da loja.</p>
    ${field('lg-email', 'E-mail', '', { type: 'email', attrs: 'autocomplete="username" required' })}
    ${field('lg-pass', 'Senha', '', { type: 'password', attrs: 'autocomplete="current-password" required' })}
    <p class="err-text" id="lg-msg" role="alert">${esc(msg)}</p>
    <button class="btn" type="submit">Entrar</button>
    <button class="link" type="button" id="forgot" style="justify-self:start">Esqueci a senha</button></form>`;
}

function viewNewPassword() {
  root.innerHTML = `<form class="login" id="newpass" novalidate><h1>Definir nova senha</h1>
    ${field('np-pass', 'Nova senha', '', { type: 'password', attrs: 'autocomplete="new-password" minlength="10" required', hint: 'Mínimo de 10 caracteres.' })}
    <p class="err-text" id="np-msg" role="alert"></p><button class="btn" type="submit">Salvar senha</button></form>`;
}

async function checkAdmin() {
  const { data: row, error } = await sb.from('admin_users').select('user_id').eq('user_id', session.user.id).maybeSingle();
  if (error) throw error;
  return Boolean(row);
}

async function enter() {
  entered = session.user.id;
  userBox.innerHTML = `<span>${esc(session.user.email || '')}</span><a class="link" href="/" target="_blank" rel="noopener">Ver loja</a><button type="button" class="link" id="logout">Sair</button>`;
  let ok = false;
  try { ok = await checkAdmin(); } catch (e) { root.innerHTML = `<div class="login"><h1>Erro</h1><p class="err-text">${esc(dbError(e))}</p></div>`; return; }
  if (!ok) {
    root.innerHTML = '<div class="login"><h1>Sem permissão</h1><p>Esta conta não está cadastrada como administradora da loja. Peça ao responsável para executar <code>supabase/add-admin.sql</code> com o seu e-mail.</p></div>';
    return;
  }
  await loadAll();
  renderShell();
}

/* ---------- dados ---------- */
async function loadAll() {
  const [b, c, p] = await Promise.all([
    sb.from('brands').select('*').order('name'),
    sb.from('categories').select('*').order('sort').order('name'),
    sb.from('products').select('*, brand:brands(name), variants:product_variants(*), images:product_images(*), product_categories(category_id)').order('sort').order('name'),
  ]);
  const err = b.error || c.error || p.error;
  if (err) { toast(dbError(err)); return; }
  data = { brands: b.data, categories: c.data, products: p.data };
  data.products.forEach((x) => { x.variants.sort((a, z) => a.sort - z.sort); x.images.sort((a, z) => a.sort - z.sort); });
}

/* ---------- estrutura ---------- */
const TABS = [['produtos', 'Produtos'], ['marcas', 'Marcas'], ['categorias', 'Categorias'], ['loja', 'Dados da loja'], ['newsletter', 'Newsletter']];
function renderShell() {
  root.innerHTML = `<div class="adm-wrap"><nav class="atabs" role="tablist" aria-label="Seções do painel">${TABS.map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${tab === k}">${l}</button>`).join('')}</nav><section class="apanel" id="panel" role="tabpanel"></section></div>`;
  renderTab();
}
function renderTab() {
  document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  ({ produtos: viewProducts, marcas: viewBrands, categorias: viewCategories, loja: viewSettings, newsletter: viewNewsletter })[tab]();
}
const panel = () => document.getElementById('panel');

/* ---------- produtos ---------- */
function viewProducts(filter = '') {
  const q = filter.toLowerCase();
  const rows = data.products.filter((p) => !q || p.name.toLowerCase().includes(q) || p.brand?.name.toLowerCase().includes(q));
  panel().innerHTML = `<div class="row"><h1>Produtos</h1><button class="btn" type="button" data-new-product ${data.brands.length ? '' : 'disabled'}>Novo produto</button></div>
    ${data.brands.length ? '' : '<p class="alert">Cadastre uma marca antes do primeiro produto (aba Marcas).</p>'}
    <div class="f" style="max-width:360px"><label for="p-filter">Buscar</label><input id="p-filter" type="search" value="${esc(filter)}" placeholder="Nome ou marca"></div>
    ${rows.length ? `<div class="tbl-wrap"><table><thead><tr><th>Produto</th><th>Volumes</th><th>Preço</th><th>Estoque</th><th>Fotos</th><th>Situação</th><th></th></tr></thead><tbody>${rows.map((p) => {
      const stock = p.variants.reduce((a, v) => a + v.stock, 0);
      const prices = p.variants.map((v) => Number(v.promo_price || v.price));
      return `<tr><td><b style="font-weight:500">${esc(p.name)}</b><br><span class="muted" style="font-size:13px">${esc(p.brand?.name || '')}</span></td>
        <td>${p.variants.map((v) => esc(v.label)).join(', ')}</td>
        <td class="num">${prices.length ? brl(Math.min(...prices)) : '—'}</td>
        <td class="num">${stock}${stock === 0 ? ' <span class="pill warn">Esgotado</span>' : ''}</td>
        <td class="num">${p.images.length || '<span class="pill warn">Sem foto</span>'}</td>
        <td>${p.is_active ? '<span class="pill">Visível</span>' : '<span class="pill off">Oculto</span>'}</td>
        <td><button type="button" class="link" data-edit="${p.id}">Editar</button></td></tr>`;
    }).join('')}</tbody></table></div>` : '<div class="box"><p class="muted">Nenhum produto cadastrado ainda.</p></div>'}`;
}

function variantRow(v = {}, i = 0) {
  return `<div class="var-row" data-var data-id="${esc(v.id || '')}">
    ${field(`v-label-${i}`, 'Volume (rótulo)', v.label || '', { attrs: 'data-k="label" maxlength="60" placeholder="50 ml" required' })}
    ${field(`v-ml-${i}`, 'ml', v.volume_ml ?? '', { type: 'number', attrs: 'data-k="volume_ml" min="1" max="2000" inputmode="numeric"' })}
    ${field(`v-price-${i}`, 'Preço (R$)', v.price ?? '', { type: 'number', attrs: 'data-k="price" min="0.01" step="0.01" required inputmode="decimal"' })}
    ${field(`v-promo-${i}`, 'Promoção (R$)', v.promo_price ?? '', { type: 'number', attrs: 'data-k="promo_price" min="0.01" step="0.01" inputmode="decimal"' })}
    ${field(`v-stock-${i}`, 'Estoque', v.stock ?? 0, { type: 'number', attrs: 'data-k="stock" min="0" step="1" inputmode="numeric"' })}
    ${field(`v-sku-${i}`, 'SKU', v.sku || '', { attrs: 'data-k="sku" maxlength="60"' })}
    <button type="button" class="link del danger" data-del-var>Remover</button></div>`;
}

function viewProductForm(p = null) {
  const cats = p ? p.product_categories.map((x) => x.category_id) : [];
  const vs = p?.variants?.length ? p.variants : [{ label: '50 ml', volume_ml: 50, stock: 0 }];
  panel().innerHTML = `<div class="row"><h1>${p ? esc(p.name) : 'Novo produto'}</h1><button type="button" class="link" data-back>← Voltar à lista</button></div>
  <form id="pform" class="apanel" novalidate data-id="${esc(p?.id || '')}">
    <div class="box"><h2>Identificação</h2><div class="form-grid">
      ${field('p-name', 'Nome do produto', p?.name, { cls: 's4', attrs: 'maxlength="120" required' })}
      ${select('p-brand', 'Marca', data.brands.map((b) => [b.id, b.name]), p?.brand_id, { cls: 's2' })}
      ${field('p-slug', 'Endereço (slug)', p?.slug, { cls: 's3', attrs: `maxlength="120" pattern="[a-z0-9]+(-[a-z0-9]+)*" ${p ? 'data-touched="1"' : ''}`, hint: 'Aparece em /produto/<slug>. Letras minúsculas, números e hífens.' })}
      ${select('p-type', 'Tipo', [['perfume', 'Perfume'], ['kit', 'Kit']], p?.type || 'perfume', { cls: 's3' })}
      ${select('p-gender', 'Gênero', Object.entries(GENDERS), p?.gender || 'unissex', { cls: 's2' })}
      ${select('p-family', 'Família olfativa', Object.entries(FAMILIES), p?.family, { cls: 's2', empty: 'Não informar' })}
      ${select('p-conc', 'Concentração', Object.keys(CONCENTRATIONS).map((c) => [c, c]), p?.concentration, { cls: 's2', empty: 'Não informar' })}
    </div>
    ${area('p-desc', 'Descrição', p?.description, { rows: 4, max: 4000 })}</div>

    <div class="box"><h2>Volumes, preços e estoque</h2><p class="muted" style="font-size:14px">Preço promocional é opcional e deve ser menor que o preço. Estoque zero mostra o volume como indisponível.</p>
      <div id="vars">${vs.map(variantRow).join('')}</div><button type="button" class="btn ghost sm" data-add-var style="justify-self:start">Adicionar volume</button></div>

    <div class="box"><h2>Perfil olfativo</h2><p class="muted" style="font-size:14px">Use apenas informações do fabricante. Campos vazios não aparecem na loja. Separe as notas por vírgula.</p>
      <div class="form-grid">${field('p-top', 'Notas de saída', (p?.notes_top || []).join(', '), { cls: 's2' })}${field('p-heart', 'Notas de coração', (p?.notes_heart || []).join(', '), { cls: 's2' })}${field('p-base', 'Notas de fundo', (p?.notes_base || []).join(', '), { cls: 's2' })}
      ${select('p-int', 'Intensidade', Object.entries(INTENSITY), p?.intensity, { cls: 's2', empty: 'Não informar' })}</div>
      <div class="f"><label>Ocasiões</label>${checks('occ', Object.entries(OCCASIONS), p?.occasions || [])}</div>
      <div class="f"><label>Estilo</label>${checks('sty', Object.entries(STYLES), p?.styles || [])}</div>
      ${area('p-kit', 'Conteúdo do kit (um item por linha)', (p?.kit_contents || []).join('\n'), { rows: 3, max: 2000 })}</div>

    <div class="box"><h2>Vitrine</h2>
      ${data.categories.length ? `<div class="f"><label>Categorias</label>${checks('cat', data.categories.map((c) => [c.id, c.name]), cats)}</div>` : '<p class="muted">Sem categorias extras cadastradas.</p>'}
      <div class="checks"><label><input type="checkbox" name="featured" ${p?.featured ? 'checked' : ''}>Mostrar na “Seleção da boutique” da página inicial</label><label><input type="checkbox" name="active" ${p ? (p.is_active ? 'checked' : '') : 'checked'}>Visível na loja</label></div>
      ${field('p-sort', 'Ordem na vitrine', p?.sort ?? 0, { type: 'number', cls: 's2', attrs: 'step="1"', hint: 'Números menores aparecem primeiro.' })}</div>

    <p class="err-text" id="p-msg" role="alert"></p>
    <div class="row"><button class="btn" type="submit">Salvar produto</button>${p ? '<button type="button" class="btn danger" data-del-product>Excluir produto</button>' : ''}</div>
  </form>
  ${p ? imagesBox(p) : '<div class="box"><h2>Fotos</h2><p class="muted">Salve o produto para enviar as fotos.</p></div>'}`;
}

function imagesBox(p) {
  return `<div class="box" id="imgbox"><h2>Fotos</h2>
    <p class="muted" style="font-size:14px">Envie fotos reais e autorizadas deste produto (JPG, PNG, WebP ou AVIF). As imagens são reduzidas para no máximo 1600 px e convertidas para WebP antes do envio. Descreva cada foto no texto alternativo.</p>
    ${p.images.length ? `<div class="imgs">${p.images.map((im, i) => `<figure data-img="${im.id}"><img src="${esc(safeUrl(im.url))}" alt="${esc(im.alt)}" loading="lazy">
      <div class="f"><label for="alt-${im.id}">Texto alternativo</label><input id="alt-${im.id}" data-alt value="${esc(im.alt)}" maxlength="200"></div>
      <div class="acts">${i > 0 ? `<button type="button" class="link" data-img-up="${i}">Mover para a esquerda</button>` : '<span class="pill">Principal</span>'}<button type="button" class="link danger" data-img-del="${im.id}">Excluir</button></div></figure>`).join('')}</div>
      <button type="button" class="btn ghost sm" data-img-save style="justify-self:start">Salvar textos e ordem</button>` : '<p class="alert">Este produto ainda não tem foto. A loja mostra a imagem padrão “Foto em breve”.</p>'}
    <div class="f"><label for="img-file">Enviar fotos</label><input id="img-file" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple></div>
    <p id="img-msg" role="status" class="muted"></p></div>`;
}

function collectProduct(form) {
  const g = (id) => form.querySelector(`#${id}`).value;
  const allChecked = (name) => [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((x) => x.value);
  const variants = [...form.querySelectorAll('[data-var]')].map((row, i) => {
    const v = Object.fromEntries([...row.querySelectorAll('[data-k]')].map((inp) => [inp.dataset.k, inp.value.trim()]));
    return { id: row.dataset.id || null, label: v.label, volume_ml: num(v.volume_ml), price: num(v.price), promo_price: num(v.promo_price), stock: num(v.stock) ?? 0, sku: v.sku || null, sort: i };
  });
  return {
    id: form.dataset.id || null,
    name: g('p-name').trim(), slug: g('p-slug').trim(), brand_id: g('p-brand'), type: g('p-type'), gender: g('p-gender'),
    family: g('p-family'), concentration: g('p-conc'), description: g('p-desc').trim(),
    notes_top: list(g('p-top')), notes_heart: list(g('p-heart')), notes_base: list(g('p-base')),
    intensity: g('p-int'), occasions: allChecked('occ'), styles: allChecked('sty'), kit_contents: lines(g('p-kit')),
    category_ids: allChecked('cat'), featured: form.querySelector('[name=featured]').checked, is_active: form.querySelector('[name=active]').checked,
    sort: Math.trunc(num(g('p-sort')) || 0), variants,
  };
}

function validateProduct(x) {
  if (!x.name) return 'Informe o nome do produto.';
  if (!isSlug(x.slug)) return 'O endereço (slug) deve ter só letras minúsculas, números e hífens.';
  if (!x.brand_id) return 'Escolha a marca.';
  if (!x.variants.length) return 'Cadastre ao menos um volume.';
  for (const v of x.variants) {
    if (!v.label) return 'Todo volume precisa de um rótulo, como “50 ml”.';
    if (!(v.price > 0)) return `Informe o preço do volume ${v.label}.`;
    if (v.promo_price != null && !(v.promo_price > 0 && v.promo_price < v.price)) return `A promoção do volume ${v.label} deve ser maior que zero e menor que o preço.`;
    if (!Number.isInteger(v.stock) || v.stock < 0) return `O estoque do volume ${v.label} deve ser um número inteiro, zero ou maior.`;
    if (v.volume_ml != null && !(Number.isInteger(v.volume_ml) && v.volume_ml > 0)) return `O volume em ml de ${v.label} deve ser um número inteiro.`;
  }
  return '';
}

async function saveProduct(form) {
  const msg = form.querySelector('#p-msg');
  const btn = form.querySelector('[type=submit]');
  const payload = collectProduct(form);
  const problem = validateProduct(payload);
  if (problem) { msg.textContent = problem; return; }
  msg.textContent = ''; btn.disabled = true; btn.textContent = 'Salvando…';
  const { data: id, error } = await sb.rpc('save_product', { payload });
  btn.disabled = false; btn.textContent = 'Salvar produto';
  if (error) { msg.textContent = dbError(error); return; }
  toast('Produto salvo.');
  await loadAll();
  viewProductForm(data.products.find((p) => p.id === id));
}

async function deleteProduct(p, btn) {
  if (!btn.dataset.armed) { btn.dataset.armed = '1'; btn.textContent = 'Clique de novo para excluir definitivamente'; setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.textContent = 'Excluir produto'; } }, 4000); return; }
  const paths = p.images.map((im) => im.storage_path).filter(Boolean);
  if (paths.length) await sb.storage.from('product-images').remove(paths);
  const { error } = await sb.from('products').delete().eq('id', p.id);
  if (error) { toast(dbError(error)); return; }
  toast('Produto excluído.');
  await loadAll(); viewProducts();
}

/* ---------- fotos ---------- */
const MIME_OK = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
async function optimize(file) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  let blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.86));
  if (!blob || blob.type !== 'image/webp') blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.88));
  return blob;
}

async function uploadImages(p, files) {
  const msg = document.getElementById('img-msg');
  let done = 0;
  for (const file of files) {
    if (!MIME_OK.includes(file.type)) { msg.textContent = `${file.name}: formato não aceito. Use JPG, PNG, WebP ou AVIF.`; continue; }
    if (file.size > 20 * 1024 * 1024) { msg.textContent = `${file.name}: arquivo acima de 20 MB.`; continue; }
    msg.textContent = `Enviando ${file.name}…`;
    let blob;
    try { blob = await optimize(file); } catch { msg.textContent = `${file.name}: não foi possível ler a imagem.`; continue; }
    if (blob.size > 5 * 1024 * 1024) { msg.textContent = `${file.name}: continua acima de 5 MB após a otimização.`; continue; }
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${p.id}/${crypto.randomUUID()}.${ext}`;
    const up = await sb.storage.from('product-images').upload(path, blob, { contentType: blob.type, upsert: false, cacheControl: '31536000' });
    if (up.error) { msg.textContent = `${file.name}: ${dbError(up.error)}`; continue; }
    const { data: pub } = sb.storage.from('product-images').getPublicUrl(path);
    const ins = await sb.from('product_images').insert({ product_id: p.id, storage_path: path, url: pub.publicUrl, alt: `${p.name} — foto ${p.images.length + done + 1}`, sort: p.images.length + done });
    if (ins.error) { await sb.storage.from('product-images').remove([path]); msg.textContent = `${file.name}: ${dbError(ins.error)}`; continue; }
    done++;
  }
  await loadAll();
  viewProductForm(data.products.find((x) => x.id === p.id));
  if (done) toast(`${done} ${done === 1 ? 'foto enviada' : 'fotos enviadas'}. Revise o texto alternativo de cada uma.`);
}

async function saveImages(p, order) {
  const box = document.getElementById('imgbox');
  const rows = order || [...box.querySelectorAll('[data-img]')].map((f) => ({ id: f.dataset.img, alt: f.querySelector('[data-alt]').value.trim() }));
  if (rows.some((r) => !r.alt)) { toast('Todo texto alternativo precisa ser preenchido.'); return; }
  for (let i = 0; i < rows.length; i++) {
    const { error } = await sb.from('product_images').update({ alt: rows[i].alt.slice(0, 200), sort: i }).eq('id', rows[i].id);
    if (error) { toast(dbError(error)); return; }
  }
  toast('Fotos atualizadas.');
  await loadAll();
  viewProductForm(data.products.find((x) => x.id === p.id));
}

async function deleteImage(p, id) {
  const im = p.images.find((x) => x.id === id);
  if (!im) return;
  const { error } = await sb.from('product_images').delete().eq('id', id);
  if (error) { toast(dbError(error)); return; }
  if (im.storage_path) await sb.storage.from('product-images').remove([im.storage_path]);
  toast('Foto excluída.');
  await loadAll();
  viewProductForm(data.products.find((x) => x.id === p.id));
}

/* ---------- marcas e categorias ---------- */
function simpleList(kind) {
  const isBrand = kind === 'brands';
  const items = data[kind];
  panel().innerHTML = `<h1>${isBrand ? 'Marcas' : 'Categorias'}</h1>
    ${isBrand ? '' : '<p class="muted">As categorias de gênero e os kits são automáticos. Use categorias para seleções extras. A categoria com endereço <code>importados</code> alimenta a página “Perfumes importados”; as demais ficam em /colecao/&lt;endereço&gt;.</p>'}
    <form class="box" id="simple-new" data-kind="${kind}" novalidate><h2>Adicionar</h2><div class="form-grid">
      ${field('s-name', 'Nome', '', { cls: 's3', attrs: 'maxlength="80" required' })}${field('s-slug', 'Endereço (slug)', '', { cls: 's2', attrs: 'maxlength="120"', hint: 'Gerado a partir do nome se ficar vazio.' })}
      ${isBrand ? '' : field('s-sort', 'Ordem', 0, { type: 'number', cls: 's1' })}</div>
      <p class="err-text" id="s-msg" role="alert"></p><button class="btn sm" type="submit" style="justify-self:start">Adicionar</button></form>
    ${items.length ? `<div class="tbl-wrap"><table><thead><tr><th>Nome</th><th>Endereço</th>${isBrand ? '<th>Produtos</th>' : ''}<th></th></tr></thead><tbody>${items.map((it) => `<tr data-row="${it.id}">
      <td><label class="sr" for="n-${it.id}">Nome</label><input id="n-${it.id}" value="${esc(it.name)}" maxlength="80" style="height:40px;border:1px solid var(--line);padding:0 10px;width:100%;min-width:160px"></td>
      <td><code>${esc(it.slug)}</code></td>
      ${isBrand ? `<td class="num">${data.products.filter((p) => p.brand_id === it.id).length}</td>` : ''}
      <td style="white-space:nowrap"><button type="button" class="link" data-s-save="${it.id}" data-kind="${kind}">Salvar</button> &nbsp; <button type="button" class="link danger" data-s-del="${it.id}" data-kind="${kind}">Excluir</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="box"><p class="muted">Nada cadastrado ainda.</p></div>'}`;
}
const viewBrands = () => simpleList('brands');
const viewCategories = () => simpleList('categories');

async function simpleCreate(form) {
  const kind = form.dataset.kind;
  const name = form.querySelector('#s-name').value.trim();
  const slug = form.querySelector('#s-slug').value.trim() || slugify(name);
  const msg = form.querySelector('#s-msg');
  if (!name) { msg.textContent = 'Informe o nome.'; return; }
  if (!isSlug(slug)) { msg.textContent = 'Endereço inválido: use letras minúsculas, números e hífens.'; return; }
  const row = { name, slug };
  if (kind === 'categories') row.sort = Math.trunc(num(form.querySelector('#s-sort').value) || 0);
  const { error } = await sb.from(kind).insert(row);
  if (error) { msg.textContent = dbError(error); return; }
  toast('Cadastro adicionado.');
  await loadAll(); simpleList(kind);
}
async function simpleSave(kind, id) {
  const name = document.getElementById(`n-${id}`).value.trim();
  if (!name) { toast('O nome não pode ficar vazio.'); return; }
  const { error } = await sb.from(kind).update({ name }).eq('id', id);
  if (error) { toast(dbError(error)); return; }
  toast('Alteração salva.'); await loadAll(); simpleList(kind);
}
async function simpleDelete(kind, id, btn) {
  if (!btn.dataset.armed) { btn.dataset.armed = '1'; btn.textContent = 'Confirmar exclusão'; setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.textContent = 'Excluir'; } }, 4000); return; }
  const { error } = await sb.from(kind).delete().eq('id', id);
  if (error) { toast(dbError(error)); return; }
  toast('Excluído.'); await loadAll(); simpleList(kind);
}

/* ---------- dados da loja ---------- */
async function viewSettings() {
  panel().innerHTML = '<p class="muted">Carregando…</p>';
  const { data: row, error } = await sb.from('store_settings').select('*').eq('id', 1).maybeSingle();
  if (error) { panel().innerHTML = `<p class="err-text">${esc(dbError(error))}</p>`; return; }
  const s = mergeSettings(row);
  const benefits = row?.benefits ? s.benefits : DEFAULT_SETTINGS.benefits;
  panel().innerHTML = `<h1>Dados da loja</h1>
  <form id="sform" class="apanel" novalidate>
    <div class="box"><h2>WhatsApp</h2>${storeWhatsApp.ok
      ? `<p>Pedidos chegam em <b class="tnum">${esc(formatPhone(storeWhatsApp.number))}</b>.</p>`
      : '<p class="alert err"><b>WhatsApp não configurado.</b> Os clientes não conseguem enviar pedidos.</p>'}
      <p class="muted" style="font-size:14px">O número é definido na variável <code>VITE_WHATSAPP_NUMBER</code> da hospedagem (formato internacional, só números). Para trocá-lo, altere a variável e publique o site de novo.</p></div>
    <div class="box"><h2>Identidade e contato</h2><div class="form-grid">
      ${field('st-name', 'Nome da loja', s.store_name, { cls: 's3', attrs: 'maxlength="60" required' })}
      ${field('st-top', 'Mensagem da barra superior', s.topbar_message, { cls: 's3', attrs: 'maxlength="120"', hint: 'Deixe vazio para ocultar a barra.' })}
      ${field('st-email', 'E-mail de atendimento', s.contact_email, { type: 'email', cls: 's3', attrs: 'maxlength="254"' })}
      ${field('st-hours', 'Horário de atendimento', s.opening_hours, { cls: 's3', attrs: 'maxlength="120" placeholder="Segunda a sexta, das 9h às 18h"' })}
      ${field('st-ig', 'Instagram (link https://)', s.instagram_url, { cls: 's2', attrs: 'maxlength="300"' })}
      ${field('st-tt', 'TikTok (link https://)', s.tiktok_url, { cls: 's2', attrs: 'maxlength="300"' })}
      ${field('st-fb', 'Facebook (link https://)', s.facebook_url, { cls: 's2', attrs: 'maxlength="300"' })}</div></div>
    <div class="box"><h2>Dados empresariais</h2><p class="muted" style="font-size:14px">Aparecem no rodapé e na página de contato somente quando preenchidos.</p><div class="form-grid">
      ${field('st-company', 'Razão social', s.company_name, { cls: 's3', attrs: 'maxlength="120"' })}
      ${field('st-cnpj', 'CNPJ', s.cnpj, { cls: 's3', attrs: 'maxlength="18" placeholder="00.000.000/0000-00"', hint: 'Aceita o formato numérico e o alfanumérico.' })}
      ${field('st-address', 'Endereço', s.address, { attrs: 'maxlength="200"' })}</div></div>
    <div class="box"><h2>Pagamento e vitrine</h2><div class="form-grid">
      ${field('st-pay', 'Formas de pagamento aceitas (separadas por vírgula)', s.payment_methods.join(', '), { cls: 's4', hint: 'Informe só o que a loja realmente aceita. Vazio: o site diz que é informado no atendimento.' })}
      ${field('st-new', 'Dias com a etiqueta “Novidade”', s.new_badge_days, { type: 'number', cls: 's2', attrs: 'min="0" max="365"', hint: 'Contados a partir do cadastro do produto. 0 desativa.' })}</div></div>
    <div class="box"><h2>Benefícios da página inicial</h2><p class="muted" style="font-size:14px">Mostre apenas o que a operação realmente oferece.</p>
      <div id="bens">${benefits.map((b, i) => benefitRow(b, i)).join('')}</div><button type="button" class="btn ghost sm" data-add-ben style="justify-self:start">Adicionar benefício</button></div>
    <div class="box"><h2>Textos das páginas</h2><p class="muted" style="font-size:14px">Vazio usa o modelo padrão do site. Formatação: linha em branco separa parágrafos, “## ” cria um título e “- ” cria um item de lista. Revise os textos legais com sua assessoria jurídica.</p>
      ${area('st-about', 'Sobre a loja', s.about_text)}${area('st-ship', 'Informações de entrega', s.shipping_text)}${area('st-exch', 'Trocas e devoluções', s.exchange_text)}${area('st-priv', 'Política de privacidade', s.privacy_text, { max: 12000 })}${area('st-terms', 'Termos de uso', s.terms_text, { max: 12000 })}</div>
    <div class="box"><h2>Perguntas frequentes</h2><p class="muted" style="font-size:14px">Sem perguntas cadastradas, o site usa uma lista padrão.</p>
      <div id="faqs">${s.faq.map((f, i) => faqRow(f, i)).join('')}</div><button type="button" class="btn ghost sm" data-add-faq style="justify-self:start">Adicionar pergunta</button></div>
    <p class="err-text" id="st-msg" role="alert"></p>
    <div><button class="btn" type="submit">Salvar dados da loja</button></div>
  </form>`;
}
const benefitRow = (b = {}, i = 0) => `<div class="ben-row" data-ben><div class="form-grid">
  ${select(`b-icon-${i}`, 'Ícone', BENEFIT_ICONS.map((x) => [x, { care: 'Atendimento', pay: 'Pagamento', swap: 'Troca', info: 'Informação', track: 'Entrega', shield: 'Proteção' }[x]]), b.icon || 'info', { cls: 's2' })}
  ${field(`b-title-${i}`, 'Título', b.title || '', { cls: 's4', attrs: 'data-b="title" maxlength="60"' })}</div>
  ${field(`b-text-${i}`, 'Texto', b.text || '', { attrs: 'data-b="text" maxlength="200"' })}
  <div class="checks"><label><input type="checkbox" data-b="on" ${b.on !== false ? 'checked' : ''}>Exibir</label><button type="button" class="link danger" data-del-row>Remover</button></div></div>`;
const faqRow = (f = {}, i = 0) => `<div class="faq-row" data-faq>${field(`fq-${i}`, 'Pergunta', f.q || '', { attrs: 'data-q maxlength="200"' })}${area(`fa-${i}`, 'Resposta', f.a || '', { rows: 3, max: 2000 })}<button type="button" class="link danger" data-del-row style="justify-self:start">Remover</button></div>`;

async function saveSettings(form) {
  const g = (id) => form.querySelector(`#${id}`).value.trim();
  const msg = form.querySelector('#st-msg');
  const cnpj = g('st-cnpj').toUpperCase();
  const urls = { instagram_url: g('st-ig'), tiktok_url: g('st-tt'), facebook_url: g('st-fb') };
  if (!g('st-name')) { msg.textContent = 'Informe o nome da loja.'; return; }
  if (cnpj && !isCnpj(cnpj)) { msg.textContent = 'CNPJ inválido: confira os dígitos.'; return; }
  for (const [k, u] of Object.entries(urls)) if (u && !/^https:\/\/\S+$/.test(u)) { msg.textContent = `O link de ${k.replace('_url', '')} deve começar com https://`; return; }
  const email = g('st-email');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { msg.textContent = 'E-mail de atendimento inválido.'; return; }
  const digits = cnpj.replace(/[./-]/g, '');
  const row = {
    store_name: g('st-name'), topbar_message: g('st-top'), contact_email: email, opening_hours: g('st-hours'), ...urls,
    company_name: g('st-company'), cnpj: digits ? `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}` : '',
    address: g('st-address'), payment_methods: list(g('st-pay')).slice(0, 10),
    new_badge_days: Math.max(0, Math.min(365, Math.trunc(num(g('st-new')) || 0))),
    about_text: g('st-about'), shipping_text: g('st-ship'), exchange_text: g('st-exch'), privacy_text: g('st-priv'), terms_text: g('st-terms'),
    benefits: [...form.querySelectorAll('[data-ben]')].map((r) => ({ icon: r.querySelector('select').value, title: r.querySelector('[data-b=title]').value.trim(), text: r.querySelector('[data-b=text]').value.trim(), on: r.querySelector('[data-b=on]').checked })).filter((b) => b.title),
    faq: [...form.querySelectorAll('[data-faq]')].map((r) => ({ q: r.querySelector('[data-q]').value.trim(), a: r.querySelector('textarea').value.trim() })).filter((f) => f.q && f.a),
  };
  const btn = form.querySelector('[type=submit]');
  btn.disabled = true; msg.textContent = '';
  const { error } = await sb.from('store_settings').update(row).eq('id', 1);
  btn.disabled = false;
  if (error) { msg.textContent = dbError(error); return; }
  toast('Dados da loja salvos. A vitrine mostra as mudanças ao ser recarregada.');
}

/* ---------- newsletter ---------- */
async function viewNewsletter() {
  panel().innerHTML = '<p class="muted">Carregando…</p>';
  const { data: rows, error } = await sb.from('newsletter_subscribers').select('id, email, created_at, consent_text').order('created_at', { ascending: false });
  if (error) { panel().innerHTML = `<p class="err-text">${esc(dbError(error))}</p>`; return; }
  panel().innerHTML = `<div class="row"><h1>Newsletter</h1>${rows.length ? '<button type="button" class="btn ghost sm" data-csv>Baixar lista (CSV)</button>' : ''}</div>
    <p class="muted">Inscrições feitas no site com consentimento registrado. O envio dos e-mails é feito por um serviço de e-mail marketing (Brevo, Mailchimp, RD Station etc.): importe esta lista nele. Exclua aqui quem pedir remoção.</p>
    ${rows.length ? `<div class="tbl-wrap"><table><thead><tr><th>E-mail</th><th>Data</th><th></th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.email)}</td><td class="num">${new Date(r.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td><td><button type="button" class="link danger" data-unsub="${r.id}">Excluir</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="box"><p class="muted">Nenhuma inscrição ainda.</p></div>'}`;
  panel()._rows = rows;
}

function downloadCsv(rows) {
  const cell = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // evita fórmulas ao abrir no Excel
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = ['email,data_inscricao,consentimento', ...rows.map((r) => [r.email, r.created_at, r.consent_text].map(cell).join(','))].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `newsletter-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------- eventos ---------- */
const currentProduct = () => {
  const id = document.getElementById('pform')?.dataset.id;
  return id ? data.products.find((p) => p.id === id) : null;
};

document.addEventListener('click', async (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  const d = t.dataset;
  if (t.id === 'logout') { await sb.auth.signOut(); return; }
  if (t.id === 'forgot') {
    const email = document.getElementById('lg-email').value.trim();
    const msg = document.getElementById('lg-msg');
    if (!email) { msg.textContent = 'Digite seu e-mail acima e clique de novo em “Esqueci a senha”.'; return; }
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/admin.html` });
    msg.className = error ? 'err-text' : 'ok-text';
    msg.textContent = error ? dbError(error) : 'Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.';
    return;
  }
  if (d.tab) { tab = d.tab; renderTab(); return; }
  if (d.newProduct !== undefined) { viewProductForm(null); return; }
  if (d.edit) { viewProductForm(data.products.find((p) => p.id === d.edit)); window.scrollTo(0, 0); return; }
  if (d.back !== undefined) { viewProducts(); return; }
  if (d.addVar !== undefined) { const box = document.getElementById('vars'); box.insertAdjacentHTML('beforeend', variantRow({ stock: 0 }, Date.now())); box.lastElementChild.querySelector('input').focus(); return; }
  if (d.delVar !== undefined) {
    if (document.querySelectorAll('[data-var]').length === 1) { toast('O produto precisa de ao menos um volume.'); return; }
    t.closest('[data-var]').remove(); return;
  }
  if (d.delProduct !== undefined) { await deleteProduct(currentProduct(), t); return; }
  if (d.imgSave !== undefined) { await saveImages(currentProduct()); return; }
  if (d.imgDel) { await deleteImage(currentProduct(), d.imgDel); return; }
  if (d.imgUp) {
    const figs = [...document.querySelectorAll('[data-img]')].map((f) => ({ id: f.dataset.img, alt: f.querySelector('[data-alt]').value.trim() }));
    const i = Number(d.imgUp); [figs[i - 1], figs[i]] = [figs[i], figs[i - 1]];
    await saveImages(currentProduct(), figs); return;
  }
  if (d.sSave) { await simpleSave(d.kind, d.sSave); return; }
  if (d.sDel) { await simpleDelete(d.kind, d.sDel, t); return; }
  if (d.addBen !== undefined) { document.getElementById('bens').insertAdjacentHTML('beforeend', benefitRow({}, Date.now())); return; }
  if (d.addFaq !== undefined) { document.getElementById('faqs').insertAdjacentHTML('beforeend', faqRow({}, Date.now())); return; }
  if (d.delRow !== undefined) { t.closest('[data-ben],[data-faq]').remove(); return; }
  if (d.csv !== undefined) { downloadCsv(panel()._rows || []); return; }
  if (d.unsub) {
    if (!t.dataset.armed) { t.dataset.armed = '1'; t.textContent = 'Confirmar'; return; }
    const { error } = await sb.from('newsletter_subscribers').delete().eq('id', d.unsub);
    if (error) toast(dbError(error)); else { toast('Inscrição excluída.'); viewNewsletter(); }
  }
});

document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'p-filter') { const v = t.value; viewProducts(v); const i = document.getElementById('p-filter'); i.focus(); i.setSelectionRange(v.length, v.length); return; }
  if (t.id === 'p-name') { const s = document.getElementById('p-slug'); if (!s.dataset.touched) s.value = slugify(t.value); return; }
  if (t.id === 'p-slug') t.dataset.touched = '1';
});

document.addEventListener('change', async (e) => {
  if (e.target.id === 'img-file' && e.target.files.length) { await uploadImages(currentProduct(), [...e.target.files]); }
});

document.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  if (f.id === 'login') {
    const msg = f.querySelector('#lg-msg');
    const email = f.querySelector('#lg-email').value.trim();
    const password = f.querySelector('#lg-pass').value;
    if (!email || !password) { msg.textContent = 'Informe e-mail e senha.'; return; }
    const btn = f.querySelector('[type=submit]'); btn.disabled = true; msg.textContent = '';
    const { error } = await sb.auth.signInWithPassword({ email, password });
    btn.disabled = false;
    if (error) msg.textContent = /invalid/i.test(error.message) ? 'E-mail ou senha incorretos.' : dbError(error);
    return;
  }
  if (f.id === 'newpass') {
    const pass = f.querySelector('#np-pass').value;
    const msg = f.querySelector('#np-msg');
    if (pass.length < 10) { msg.textContent = 'Use ao menos 10 caracteres.'; return; }
    const { error } = await sb.auth.updateUser({ password: pass });
    if (error) { msg.textContent = dbError(error); return; }
    toast('Senha atualizada.');
    enter();
    return;
  }
  if (f.id === 'pform') { await saveProduct(f); return; }
  if (f.id === 'simple-new') { await simpleCreate(f); return; }
  if (f.id === 'sform') await saveSettings(f);
});

/* ---------- início ---------- */
async function start() {
  if (!isSupabaseConfigured) { viewNotConfigured(); return; }
  sb = await getSupabase();
  sb.auth.onAuthStateChange((event, s) => {
    session = s;
    if (event === 'PASSWORD_RECOVERY') { viewNewPassword(); return; }
    if (event === 'SIGNED_IN' && s && entered !== s.user.id) { setTimeout(enter, 0); return; }
    if (event === 'SIGNED_OUT') { entered = null; viewLogin(); }
  });
  const { data: { session: s } } = await sb.auth.getSession();
  session = s;
  if (session) await enter(); else viewLogin();
}
start();
