// Testes de ponta a ponta num navegador real (Chrome/Chromium headless).
// Uso: CHROME_PATH=/caminho/do/chrome npm run test:e2e
// Compila três versões do site e verifica navegação, filtros, sacola, WhatsApp, layout no celular,
// modo real com Supabase simulado e o painel administrativo.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { build } from 'vite';
import puppeteer from 'puppeteer-core';
import { createMock } from './mock-supabase.mjs';

const ROOT = new URL('../../', import.meta.url).pathname;
const WA = '5571999998888';
const results = [];
let failures = 0;

function check(name, cond, detail = '') {
  results.push(`${cond ? '✓' : '✗'} ${name}${!cond && detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
}

async function buildVariant(dir, env) {
  for (const k of ['VITE_WHATSAPP_NUMBER', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_SITE_URL']) process.env[k] = env[k] ?? '';
  await build({ root: ROOT, logLevel: 'error', build: { outDir: join(ROOT, dir), emptyOutDir: true } });
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.txt': 'text/plain' };
function serve(dir, port) {
  const base = join(ROOT, dir);
  const server = http.createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/admin') p = '/admin.html';
    let file = join(base, p);
    try { if (!(await stat(file)).isFile()) throw 0; } catch { file = join(base, 'index.html'); }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  });
  return new Promise((r) => server.listen(port, () => r(server)));
}

const executablePath = process.env.CHROME_PATH;
if (!executablePath) { console.error('Defina CHROME_PATH com o caminho do Chrome ou Chromium.'); process.exit(2); }
const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote', '--single-process'] });

async function page(origin, { width = 1366, height = 900 } = {}) {
  const p = await browser.newPage();
  await p.setViewport({ width, height });
  p.errors = [];
  p.on('pageerror', (e) => p.errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/ERR_TUNNEL|ERR_PROXY|ERR_NAME|fonts\.g|Failed to load resource/.test(m.text())) p.errors.push(m.text()); });
  await p.setRequestInterception(true);
  p.on('request', (r) => (/fonts\.(googleapis|gstatic)\.com|wa\.me/.test(r.url()) ? r.abort() : r.continue()));
  p.origin = origin;
  p.go = async (path) => { await p.goto(origin + path, { waitUntil: 'networkidle0' }); await p.waitForFunction(() => !document.querySelector('.skel')); };
  return p;
}
const text = (p, sel) => p.$eval(sel, (e) => e.textContent.replace(/\u00a0/g, ' ').trim()).catch(() => null);
const exists = async (p, sel) => Boolean(await p.$(sel));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ============ 1. Demonstração com WhatsApp configurado ============ */
console.log('Compilando versões de teste…');
await buildVariant('.e2e/demo', { VITE_WHATSAPP_NUMBER: WA });
await buildVariant('.e2e/nowa', { VITE_WHATSAPP_NUMBER: '' });
await buildVariant('.e2e/badwa', { VITE_WHATSAPP_NUMBER: '+55 (71) 99999-8888' });
await buildVariant('.e2e/live', { VITE_WHATSAPP_NUMBER: WA, VITE_SUPABASE_URL: 'http://localhost:54321', VITE_SUPABASE_ANON_KEY: 'sb_publishable_teste', VITE_SITE_URL: 'https://loja.test' });
const servers = [await serve('.e2e/demo', 4301), await serve('.e2e/nowa', 4302), await serve('.e2e/badwa', 4303), await serve('.e2e/live', 4304)];
const mock = createMock();
await new Promise((r) => mock.server.listen(54321, r));

{
  const p = await page('http://localhost:4301');
  await p.go('/');
  check('Início carrega com título e vitrine', (await text(p, '#hero-title'))?.includes('Uma fragrância') && (await p.$$('.card')).length > 0);
  check('Aviso de demonstração visível e página marcada como noindex', !(await p.$eval('#demo-strip', (e) => e.hidden)) && (await p.$eval('meta[name=robots]', (e) => e.content)) === 'noindex, nofollow');
  check('Cartões de demonstração identificados', (await p.$$eval('.card .badge.demo', (b) => b.length)) === (await p.$$eval('.card', (c) => c.length)));
  check('Sem estrelas, avaliações ou “Mais vendido”', !(await p.evaluate(() => /★|avalia|mais vendido/i.test(document.body.innerText))));
  check('Sem promessas de Pix, cartão, parcelas, frete grátis ou rastreamento automático', !(await p.evaluate(() => /pix|cart[aã]o de cr[eé]dito|parcel|frete gr[aá]tis|sem juros|qr ?code/i.test(document.body.innerText))));
  check('Recomendação sem percentuais', !(await p.$eval('#finder-r', (e) => /%/.test(e.textContent))) && (await p.$$('#finder-r .res')).length === 3);
  await p.click('[data-fq="family"][data-fv="citrico"]');
  check('Recomendação reage às escolhas', (await text(p, '#finder-r .res .muted'))?.includes('Cítrico'));
  check('Botão do WhatsApp flutuante com link oficial', (await p.$eval('.wa-fab', (a) => a.href)).startsWith(`https://wa.me/${WA}?text=`));
  check('Primeiro Tab leva ao link “Pular para o conteúdo”', await (async () => { await p.go('/'); await p.keyboard.press('Tab'); return p.evaluate(() => document.activeElement.classList.contains('skip')); })());

  // Navegação pelo menu (sem recarregar)
  await p.evaluate(() => { window.__spa = 1; });
  await p.click('nav.main a[href="/femininos"]');
  await p.waitForSelector('#cat-grid .card');
  check('Menu navega sem recarregar a página', (await p.evaluate(() => window.__spa)) === 1 && p.url().endsWith('/femininos'));
  check('Link ativo no menu', (await p.$eval('nav.main a[aria-current="page"]', (a) => a.textContent)) === 'Femininos');

  // Filtros combinados
  await p.go('/perfumes');
  const total = (await p.$$('#cat-grid .card')).length;
  await p.click('input[data-f="gender"][value="feminino"]');
  await p.click('input[data-f="family"][value="floral"]');
  const names = await p.$$eval('#cat-grid .card h3', (h) => h.map((x) => x.textContent).sort());
  check('Filtros gênero + família funcionam juntos', JSON.stringify(names) === JSON.stringify(['Lumière de Jasmin', 'Rose Sépia']), names.join(', '));
  await p.click('[data-clearf]');
  check('Limpar filtros restaura a lista', (await p.$$('#cat-grid .card')).length === total);
  await p.type('#cq', 'baunílha');
  await sleep(400);
  check('Busca ignora acentos e atualiza a URL', (await p.$$('#cat-grid .card')).length === 2 && p.url().includes('q=ba'));
  await p.select('#sort', 'menor');
  const prices = await p.$$eval('#cat-grid .card .price b', (b) => b.map((x) => Number(x.textContent.replace(/[^\d,]/g, '').replace(',', '.'))));
  check('Ordenação por menor preço', prices.join() === [...prices].sort((a, b) => a - b).join() && p.url().includes('ordem=menor'));
  await p.go('/perfumes?q=zzzz');
  check('Busca sem resultado mostra mensagem útil', (await text(p, '#cat-grid h2')) === 'Nenhuma fragrância encontrada');
  await p.go('/perfumes?q=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E');
  check('Parâmetro de busca malicioso é exibido como texto', !(await exists(p, '#cat-grid img[src="x"]')) && (await p.$eval('#cq', (i) => i.value)).includes('<img'));

  // Página de produto, volume, quantidade e sacola
  await p.go('/perfumes');
  await p.click('#cat-grid .card h3 a[href="/produto/aura-noir"]');
  await p.waitForSelector('.pdp');
  check('Cartão abre a página do produto correto', (await text(p, '.info h1')) === 'Aura Noir' && (await p.$eval('.main-img img', (i) => i.getAttribute('src'))) === '/images/demo/aura-noir.svg');
  await p.click('[data-size="1"]');
  check('Trocar o volume atualiza o preço', (await text(p, '#pdp-buy .price b')) === 'R$ 489,00' && (await p.$eval('[data-size="1"]', (b) => b.getAttribute('aria-checked'))) === 'true');
  await p.click('[data-pq="1"]');
  await p.click('[data-add-pdp]');
  check('Adicionar à sacola atualiza o contador', (await text(p, '#cart-count')) === '2');
  for (let i = 0; i < 4; i++) await p.click('[data-pq="1"]');
  check('Quantidade limitada ao estoque', (await text(p, '#pq')) === '4' && (await p.$eval('[data-pq="1"]', (b) => b.disabled)));
  await p.reload({ waitUntil: 'networkidle0' });
  check('Sacola persiste após recarregar a página', (await text(p, '#cart-count')) === '2');

  await p.go('/produto/coffret-noite');
  check('Produto indisponível não pode ser adicionado', await p.$eval('[data-add-pdp]', (b) => b.disabled) && (await text(p, '.stock.out'))?.includes('Indisponível'));
  await p.go('/produto/nao-existe');
  check('Produto inexistente mostra página de não encontrado', (await text(p, 'main h1')) === 'Produto não encontrado');
  await p.go('/produto/..%2Fadmin');
  check('Endereço de produto inválido não quebra a página', (await text(p, 'main h1')) === 'Página não encontrada');

  // Favoritos
  await p.go('/produto/rose-sepia');
  await p.click('.fav-btn');
  await p.go('/favoritos');
  check('Favoritos guardam o produto', (await p.$$eval('.card h3', (h) => h.map((x) => x.textContent))).includes('Rose Sépia'));

  // Sacola → revisão → WhatsApp
  await p.go('/produto/the-blanc');
  await p.click('[data-add-pdp]');
  await p.click('[data-open-cart]');
  await p.waitForSelector('#cart.on');
  check('Gaveta da sacola lista os itens com subtotal', (await p.$$('#cart-body .ci')).length === 2 && (await text(p, '#cart-foot .sum-row b')) === 'R$ 1.227,00');
  await p.click('#cart-foot a[href="/pedido"]');
  await p.waitForSelector('#o-items .o-item');
  check('Revisão mostra itens, volume, preço unitário e subtotais', (await p.$$('#o-items .o-item')).length === 2 && (await p.evaluate(() => document.querySelector('#o-items').innerText)).includes('Preço unitário'));
  check('Botão flutuante some na revisão do pedido', await p.$eval('.wa-fab', (a) => a.hidden));
  await p.type('#o-name', 'José Ação & Filhos');
  await p.type('#o-cep', '40140110');
  await p.type('#o-city', 'Salvador');
  await p.type('#o-notes', 'Presente #1? Sim + embrulho 😊');
  const href = await p.$eval('#wa-send', (a) => a.href);
  const msg = new URL(href).searchParams.get('text');
  check('Link usa https://wa.me/NUMERO?text=', href.startsWith(`https://wa.me/${WA}?text=`));
  check('Mensagem tem produtos, volumes, quantidades e subtotal', msg.includes('Aura Noir (Maison Aura)') && msg.includes('Eau de Parfum · 100 ml') && msg.includes('2 × R$ 489,00 = R$ 978,00') && msg.includes('*Subtotal dos produtos:* R$ 1.227,00'), msg);
  check('Acentos, símbolos e emoji chegam intactos', msg.includes('Nome: José Ação & Filhos') && msg.includes('CEP: 40140-110') && msg.includes('Observações: Presente #1? Sim + embrulho 😊'));
  check('CPF e dados de pagamento não são pedidos', !(await exists(p, '#o-form [name=cpf], input[autocomplete^="cc-"]')));
  await p.click('#o-items [data-oq="0"][data-d="-1"]');
  check('Alterar quantidade na revisão atualiza a mensagem', new URL(await p.$eval('#wa-send', (a) => a.href)).searchParams.get('text').includes('1 × R$ 489,00'));
  const popup = new Promise((r) => browser.once('targetcreated', (t) => r(t)));
  await p.click('#wa-send');
  const t = await Promise.race([popup, sleep(3000).then(() => null)]);
  check('Clique abre o WhatsApp em nova aba', Boolean(t) && t.url().startsWith('https://wa.me/'));
  const status = await text(p, '#wa-status');
  check('Após abrir, o site não afirma que o pedido foi enviado', status.includes('Envie a mensagem por lá') && !/enviado com sucesso|pedido (recebido|confirmado)/i.test(status));
  check('Itens continuam na sacola após abrir o WhatsApp', (await text(p, '#cart-count')) === '2' && (await p.$$('#o-items .o-item')).length === 2);
  await p.reload({ waitUntil: 'networkidle0' });
  check('Dados opcionais do pedido são mantidos ao recarregar', (await p.$eval('#o-name', (i) => i.value)) === 'José Ação & Filhos');

  // Newsletter no modo demonstração
  await p.go('/');
  await p.type('#nl-email', 'ana@exemplo.com');
  await p.click('#news-form button[type=submit]');
  check('Newsletter exige consentimento', (await text(p, '#nl-msg')).includes('consentimento'));
  await p.click('#nl-ok');
  await p.click('#news-form button[type=submit]');
  check('Newsletter não finge inscrição sem banco configurado', (await text(p, '#nl-msg')).includes('ainda não está ativa'));
  check('Nenhum erro de JavaScript (desktop)', p.errors.length === 0, p.errors.join(' | '));
  await p.close();

  // Celular
  const m = await page('http://localhost:4301', { width: 375, height: 760 });
  const routes = ['/', '/perfumes', '/femininos', '/kits', '/produto/aura-noir', '/produto/coffret-descoberta', '/favoritos', '/pedido', '/contato', '/faq', '/sobre', '/privacidade', '/termos', '/trocas', '/entrega', '/rota-inexistente'];
  const overflow = [];
  for (const r of routes) {
    await m.go(r);
    const w = await m.evaluate(() => document.documentElement.scrollWidth);
    if (w > 375) overflow.push(`${r} (${w}px)`);
  }
  check('Nenhuma página rola na horizontal a 375 px', overflow.length === 0, overflow.join(', '));
  await m.go('/');
  await m.click('#menu-open');
  await m.waitForSelector('#mmenu.on');
  check('Menu mobile abre, bloqueia o fundo e lista as categorias', (await m.$$('#m-nav a')).length === 7 && (await m.$eval('#app', (e) => e.inert)));
  await m.keyboard.press('Escape');
  check('Menu mobile fecha com Esc', !(await exists(m, '#mmenu.on')));
  await m.go('/perfumes');
  await m.click('#ftog');
  check('Filtros abrem no celular', await m.$eval('#filters', (f) => getComputedStyle(f).display !== 'none'));
  await m.go('/produto/aura-noir');
  const fab = await m.$eval('.wa-fab', (a) => a.getBoundingClientRect().toJSON());
  check('Botão do WhatsApp é discreto (52×52) e fica no canto', fab.width <= 56 && fab.height <= 56 && fab.right <= 375 && fab.bottom <= 760);
  const small = await m.evaluate(() => [...document.querySelectorAll('.info p, .info .desc, .acc summary, .card .brand, .crumbs')].filter((e) => parseFloat(getComputedStyle(e).fontSize) < 12).length);
  check('Textos da página de produto legíveis no celular (≥ 12 px)', small === 0);
  await m.screenshot({ path: join(ROOT, '.e2e/celular-produto.png') });
  await m.go('/');
  await m.screenshot({ path: join(ROOT, '.e2e/celular-inicio.png'), fullPage: true });
  check('Nenhum erro de JavaScript (celular)', m.errors.length === 0, m.errors.join(' | '));
  await m.close();
}

/* ============ 2. Sem número de WhatsApp / número inválido ============ */
for (const [port, label] of [[4302, 'ausente'], [4303, 'inválido']]) {
  const p = await page(`http://localhost:${port}`);
  await p.go('/produto/aura-noir');
  await p.click('[data-add-pdp]');
  await p.go('/pedido');
  check(`Número ${label}: aviso claro e nenhum link aberto`, (await text(p, '#o-cta .alert.err'))?.includes('número da loja ainda não foi configurado') && !(await exists(p, '#wa-send')) && !(await exists(p, 'a[href*="wa.me"]')));
  check(`Número ${label}: oferece copiar a mensagem`, await exists(p, '[data-copy-order]'));
  check(`Número ${label}: sem botão flutuante`, !(await exists(p, '.wa-fab')));
  await p.close();
}

/* ============ 3. Modo real com Supabase simulado ============ */
{
  const p = await page('http://localhost:4304');
  await p.go('/');
  check('Modo real: sem aviso de demonstração e sem noindex', await p.$eval('#demo-strip', (e) => e.hidden) && !(await exists(p, 'meta[name=robots]')));
  check('Modo real: configurações vindas do banco', (await text(p, '#topbar-text')) === 'Mensagem real' && (await p.evaluate(() => document.querySelector('#footer').innerText)).includes('Pix'));
  await p.go('/perfumes');
  const names = await p.$$eval('#cat-grid .card h3', (h) => h.map((x) => x.textContent));
  check('Modo real: só produtos ativos aparecem', names.join() === 'Perfume Real', names.join());
  await p.go('/produto/perfume-real');
  await sleep(300);
  check('Imagem quebrada troca para a imagem padrão', (await p.$eval('.main-img img', (i) => i.getAttribute('src'))) === '/images/fallback.svg');
  const ld = await p.$eval('script[type="application/ld+json"]', (s) => JSON.parse(s.textContent)).catch(() => null);
  check('Dados estruturados do produto sem avaliações inventadas', ld?.['@type'] === 'Product' && ld.offers[0].price === '320.00' && !ld.aggregateRating && ld.offers[0].url === 'https://loja.test/produto/perfume-real');
  check('Link canônico usa VITE_SITE_URL', (await p.$eval('link[rel=canonical]', (l) => l.href)) === 'https://loja.test/produto/perfume-real');
  await p.go('/');
  await p.type('#nl-email', 'Cliente@Exemplo.com');
  await p.click('#nl-ok');
  await p.click('#news-form button[type=submit]');
  await p.waitForFunction(() => document.querySelector('#nl-msg').classList.contains('ok'));
  check('Newsletter grava e-mail em minúsculas com texto do consentimento', mock.log.newsletter[0]?.email === 'cliente@exemplo.com' && mock.log.newsletter[0]?.consent === true && mock.log.newsletter[0]?.consent_text.includes('Aceito'));
  check('Nenhum erro de JavaScript (modo real)', p.errors.length === 0, p.errors.join(' | '));
  await p.close();

  // Painel
  const a = await page('http://localhost:4304');
  await a.goto('http://localhost:4304/admin', { waitUntil: 'networkidle0' });
  check('Painel pede login', await exists(a, '#login'));
  await a.type('#lg-email', 'admin@loja.test');
  await a.type('#lg-pass', 'errada');
  await a.click('#login [type=submit]');
  await a.waitForFunction(() => document.querySelector('#lg-msg').textContent.length > 0);
  check('Senha errada mostra erro', (await text(a, '#lg-msg')) === 'E-mail ou senha incorretos.');
  await a.$eval('#lg-pass', (i) => { i.value = ''; });
  await a.type('#lg-pass', 'senha-forte-123');
  await a.click('#login [type=submit]');
  await a.waitForSelector('[data-tab]');
  check('Administrador entra e vê os produtos, inclusive ocultos', (await a.$$('tbody tr')).length === 2);
  await a.click('[data-edit="p1"]');
  await a.waitForSelector('#pform');
  await a.$eval('[data-k="price"]', (i) => { i.value = ''; });
  await a.type('[data-k="price"]', '350');
  await a.type('[data-k="promo_price"]', '400');
  await a.click('#pform [type=submit]');
  check('Painel recusa promoção maior que o preço antes de enviar', (await text(a, '#p-msg')).includes('menor que o preço') && mock.log.rpc.length === 0);
  await a.$eval('[data-k="promo_price"]', (i) => { i.value = '299'; });
  await a.click('#pform [type=submit]');
  await a.waitForFunction(() => document.querySelector('#toast').textContent.includes('Produto salvo'));
  const sent = mock.log.rpc[0];
  check('Salvar produto envia dados completos numa só chamada', sent?.id === 'p1' && sent.variants[0].price === 350 && sent.variants[0].promo_price === 299 && sent.notes_top[0] === 'Bergamota');
  await a.click('[data-tab="loja"]');
  await a.waitForSelector('#sform');
  check('Painel mostra o número de WhatsApp configurado', (await text(a, '#sform .box'))?.includes('+55 (71) 99999-8888'));
  await a.type('#st-cnpj', '11.222.333/0001-80');
  await a.click('#sform [type=submit]');
  check('CNPJ com dígito errado é recusado', (await text(a, '#st-msg')).includes('CNPJ inválido'));
  await a.$eval('#st-cnpj', (i) => { i.value = '11222333000181'; });
  await a.click('#sform [type=submit]');
  await a.waitForFunction(() => document.querySelector('#toast').textContent.includes('salvos'));
  check('Dados da loja salvos com CNPJ formatado', mock.log.settings[0]?.cnpj === '11.222.333/0001-81');
  await a.click('#logout');
  await a.waitForSelector('#login');
  await a.type('#lg-email', 'cliente@loja.test');
  await a.type('#lg-pass', 'senha-forte-123');
  await a.click('#login [type=submit]');
  await a.waitForFunction(() => document.querySelector('main h1')?.textContent === 'Sem permissão');
  check('Conta sem permissão não acessa o painel', !(await exists(a, '[data-tab]')));
  check('Nenhum erro de JavaScript (painel)', a.errors.length === 0, a.errors.join(' | '));
  await a.close();

  const nc = await page('http://localhost:4301');
  await nc.goto('http://localhost:4301/admin', { waitUntil: 'networkidle0' });
  check('Sem Supabase, o painel explica como ativar e não permite editar', (await text(nc, 'main h1')) === 'Painel indisponível' && !(await exists(nc, 'form')));
  await nc.close();
}

await browser.close();
servers.forEach((s) => s.close());
mock.server.close();
console.log(results.join('\n'));
console.log(`\n${results.length - failures} de ${results.length} verificações aprovadas.`);
process.exit(failures ? 1 : 0);
