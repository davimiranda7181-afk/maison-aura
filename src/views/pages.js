// Páginas institucionais. Os textos podem ser substituídos no painel (store_settings).
// Os modelos abaixo devem ser revisados por assessoria jurídica antes da publicação.
import { state } from '../state.js';
import { esc, miniMarkup, safeUrl } from '../lib/format.js';
import { pageHead, card } from '../ui/components.js';
import { storeWhatsApp, waUrl, formatPhone, GENERAL_MESSAGE } from '../lib/whatsapp.js';
import { IC } from '../ui/icons.js';

const S = () => state.settings;
const who = () => esc(S().company_name || S().store_name);
const contactLine = () => {
  const parts = [];
  if (storeWhatsApp.ok) parts.push(`pelo WhatsApp ${formatPhone(storeWhatsApp.number)}`);
  if (S().contact_email) parts.push(`pelo e-mail ${S().contact_email}`);
  return parts.length ? parts.join(' ou ') : 'pelos canais de atendimento informados no site';
};

const DEFAULTS = {
  about: () => `A ${S().store_name} é uma perfumaria multimarcas. Reunimos fragrâncias de diferentes casas e ajudamos você a escolher pela conversa: notas, ocasião, intensidade e volume.

## Como funciona
- Você escolhe o perfume e o volume aqui no site.
- A sacola monta a mensagem do pedido.
- No WhatsApp, a loja confirma disponibilidade, frete e forma de pagamento antes de qualquer cobrança.

## Nosso compromisso
Mostramos na vitrine apenas informações cadastradas pela loja: preço, volume, concentração e disponibilidade. Não exibimos avaliações, selos ou números de vendas que não possamos comprovar.`,

  privacy: () => `Esta política explica como ${S().company_name || S().store_name} trata dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).

## Dados tratados no site
- Sacola, favoritos e o rascunho do pedido ficam salvos apenas no seu navegador (armazenamento local). Não são enviados para nós.
- Se você assinar a newsletter, guardamos seu e-mail e o registro do consentimento.

## Pedidos pelo WhatsApp
Ao clicar em “Abrir conversa no WhatsApp”, a mensagem com os itens e os dados opcionais que você preencheu é aberta no aplicativo WhatsApp, operado pela Meta. A partir daí, a conversa segue as regras do WhatsApp e é usada por nós para atender e entregar o seu pedido.

## Seus direitos
Você pode pedir acesso, correção ou exclusão dos seus dados e revogar o consentimento de marketing a qualquer momento, ${contactLine()}.`,

  terms: () => `Ao usar este site, você concorda com estes termos.

## Vitrine e preços
Os preços e a disponibilidade exibidos podem mudar. O pedido só é fechado depois que a loja confirma, pelo WhatsApp, disponibilidade, valor final, frete e forma de pagamento.

## Pedidos
Enviar a mensagem pelo WhatsApp não gera cobrança nem reserva automática. A confirmação é feita pela loja na conversa.

## Conteúdo
Marcas e nomes de produtos pertencem aos seus titulares.`,

  exchange: () => `## Direito de arrependimento
Pelo artigo 49 do Código de Defesa do Consumidor, compras feitas fora do estabelecimento comercial, como pela internet ou pelo WhatsApp, podem ser desfeitas em até 7 dias a contar do recebimento, com devolução dos valores pagos.

## Condições
- Por higiene e segurança, perfumes devem ser devolvidos lacrados, sem uso e na embalagem original.
- Kits devem ser devolvidos completos.

## Produto com defeito ou avaria
Avise ${contactLine()} com fotos da embalagem e do produto. Combinamos a troca ou o reembolso.`,

  shipping: () => `O valor e o prazo do frete não são calculados automaticamente no site. Depois que você envia o pedido pelo WhatsApp, a loja informa as opções disponíveis para o seu CEP.

## Retirada e entrega local
Se a loja oferecer retirada ou entrega local, isso é combinado na conversa.

## Rastreamento
Quando a modalidade escolhida tiver rastreamento, a loja envia o código pelo WhatsApp.`,
};

const DEFAULT_FAQ = () => [
  { q: 'Como faço um pedido?', a: 'Escolha o perfume e o volume, adicione à sacola e clique em “Finalizar pedido pelo WhatsApp”. A mensagem com os itens é aberta no WhatsApp da loja, e o atendimento confirma disponibilidade, frete e pagamento.' },
  { q: 'Pago alguma coisa no site?', a: 'Não. O site não processa pagamentos. A forma de pagamento é combinada com a loja no WhatsApp.' },
  { q: 'Qual a diferença entre Eau de Toilette e Eau de Parfum?', a: 'A concentração de óleos aromáticos. A Eau de Toilette costuma ter de 5% a 15% e é mais leve. A Eau de Parfum costuma ter de 15% a 20% e tende a durar mais na pele. Os valores variam conforme o fabricante.' },
  { q: 'Como é calculado o frete?', a: 'A loja informa valor e prazo pelo WhatsApp, a partir do seu CEP.' },
  { q: 'Posso desistir da compra?', a: 'Sim. Compras feitas à distância podem ser desfeitas em até 7 dias após o recebimento, conforme o Código de Defesa do Consumidor. Veja a política de trocas.' },
  ...(S().payment_methods.length ? [{ q: 'Quais formas de pagamento são aceitas?', a: `A loja aceita: ${S().payment_methods.join(', ')}.` }] : []),
];

const PAGES = {
  sobre: ['Sobre a loja', 'about_text', 'about'],
  privacidade: ['Política de privacidade', 'privacy_text', 'privacy'],
  termos: ['Termos de uso', 'terms_text', 'terms'],
  trocas: ['Trocas e devoluções', 'exchange_text', 'exchange'],
  entrega: ['Informações de entrega', 'shipping_text', 'shipping'],
};

export const hasPage = (k) => Boolean(PAGES[k]) || k === 'faq' || k === 'contato';

export function pageMeta(k) {
  if (k === 'faq') return { title: 'Perguntas frequentes' };
  if (k === 'contato') return { title: 'Contato' };
  return { title: PAGES[k][0] };
}

export function viewPage(k) {
  if (k === 'faq') {
    const items = S().faq.length ? S().faq : DEFAULT_FAQ();
    return `${pageHead('Perguntas frequentes')}<div class="wrap"><div class="prose faq">${items.map((x) => `<details><summary>${esc(x.q)}</summary><div class="a">${miniMarkup(x.a)}</div></details>`).join('')}</div></div>`;
  }
  if (k === 'contato') return viewContact();
  const [title, field, def] = PAGES[k];
  const text = S()[field] || DEFAULTS[def]();
  const ident = k === 'termos' && S().cnpj ? `<h2>Identificação</h2><p>${who()} · CNPJ ${esc(S().cnpj)}${S().address ? ` · ${esc(S().address)}` : ''}</p>` : '';
  return `${pageHead(title)}<div class="wrap"><div class="prose">${miniMarkup(text)}${ident}</div></div>`;
}

function viewContact() {
  const s = S();
  const wa = waUrl(GENERAL_MESSAGE);
  const socials = [['Instagram', s.instagram_url], ['TikTok', s.tiktok_url], ['Facebook', s.facebook_url]]
    .map(([n, u]) => [n, safeUrl(u, { allowRelative: false })]).filter(([, u]) => u);
  return `${pageHead('Contato', 'Fale com a loja para tirar dúvidas, pedir indicações ou acompanhar um pedido.')}
  <div class="wrap contact">
    <div class="box"><h2>WhatsApp</h2>${wa
      ? `<p class="copyable"><span class="tnum">${esc(formatPhone(storeWhatsApp.number))}</span></p><a class="btn wa" href="${esc(wa)}" target="_blank" rel="noopener noreferrer">${IC.whatsapp}Conversar no WhatsApp</a>`
      : '<p class="muted">O número de WhatsApp da loja ainda não foi configurado.</p>'}
      ${s.opening_hours ? `<p class="muted">${esc(s.opening_hours)}</p>` : ''}</div>
    ${s.contact_email ? `<div class="box"><h2>E-mail</h2><p class="copyable"><span>${esc(s.contact_email)}</span><button type="button" class="link" data-copy="${esc(s.contact_email)}">Copiar</button></p></div>` : ''}
    ${socials.length ? `<div class="box"><h2>Redes sociais</h2><ul style="list-style:none;margin:0;padding:0;display:grid;gap:8px">${socials.map(([n, u]) => `<li><a class="u-link" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${n}</a></li>`).join('')}</ul></div>` : ''}
    ${s.company_name || s.cnpj || s.address ? `<div class="box"><h2>Dados da empresa</h2>${s.company_name ? `<p>${esc(s.company_name)}</p>` : ''}${s.cnpj ? `<p class="tnum">CNPJ ${esc(s.cnpj)}</p>` : ''}${s.address ? `<p>${esc(s.address)}</p>` : ''}</div>` : ''}
  </div>`;
}

export function viewFavorites() {
  const list = state.favs.map((id) => state.byId.get(id)).filter(Boolean);
  return `${pageHead('Favoritos', 'Fragrâncias salvas neste navegador.')}
  <div class="wrap" style="padding-block:40px 96px">${list.length
    ? `<div class="grid">${list.map(card).join('')}</div>`
    : '<div class="empty"><h2>Nenhum favorito ainda</h2><p class="muted">Toque no coração de um perfume para guardá-lo aqui.</p><a href="/perfumes" class="btn">Explorar fragrâncias</a></div>'}</div>`;
}

export function viewNotFound(what = 'Página não encontrada', text = 'O endereço pode ter mudado ou o item saiu do catálogo.') {
  return `<div class="wrap"><div class="state" style="padding-block:120px"><h1 style="font-size:34px">${esc(what)}</h1><p>${esc(text)}</p><div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center"><a href="/perfumes" class="btn">Ver fragrâncias</a><a href="/" class="btn ghost">Voltar ao início</a></div></div></div>`;
}

export function viewError(message) {
  const wa = waUrl(GENERAL_MESSAGE);
  return `<div class="wrap"><div class="state" style="padding-block:120px" role="alert"><h1 style="font-size:34px">Não foi possível carregar a vitrine</h1><p>Verifique sua conexão e tente de novo. Se o problema continuar, fale com a loja.</p>${message ? `<p class="muted" style="font-size:13px">Detalhe técnico: ${esc(message)}</p>` : ''}<div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center"><button type="button" class="btn" data-retry>Tentar novamente</button>${wa ? `<a class="btn ghost" href="${esc(wa)}" target="_blank" rel="noopener noreferrer">Falar no WhatsApp</a>` : ''}</div></div></div>`;
}
