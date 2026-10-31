// Pedidos e atendimento pelo WhatsApp. O número vem só de VITE_WHATSAPP_NUMBER (lib/config.js).
import { WHATSAPP_NUMBER_RAW } from './config.js';
import { brlText, cleanText, maskCep } from './format.js';

/**
 * Valida o número no formato internacional, só com dígitos (E.164 sem o "+").
 * Retorna { ok:true, number } ou { ok:false, reason: 'missing' | 'format' | 'length' }.
 */
export function parseWhatsAppNumber(raw) {
  const v = String(raw ?? '').trim();
  if (!v) return { ok: false, reason: 'missing' };
  if (!/^\d+$/.test(v)) return { ok: false, reason: 'format' };
  if (v.length < 10 || v.length > 15 || v.startsWith('0')) return { ok: false, reason: 'length' };
  return { ok: true, number: v };
}

export const storeWhatsApp = parseWhatsAppNumber(WHATSAPP_NUMBER_RAW);

if (!storeWhatsApp.ok) {
  const why = {
    missing: 'VITE_WHATSAPP_NUMBER não foi definida.',
    format: 'VITE_WHATSAPP_NUMBER deve conter somente números, sem +, espaços ou traços.',
    length: 'VITE_WHATSAPP_NUMBER deve ter de 10 a 15 dígitos, começando pelo código do país (55 no Brasil).',
  }[storeWhatsApp.reason];
  console.warn(`[Maison Aura] WhatsApp desativado: ${why}`);
}

/** URL oficial https://wa.me/NUMERO?text=MENSAGEM. Retorna null se o número for inválido. */
export function waUrl(text, wa = storeWhatsApp) {
  if (!wa || !wa.ok) return null;
  const q = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${wa.number}${q}`;
}

/** Número para exibição: +55 (71) 99999-8888 no Brasil, +<número> nos demais. */
export function formatPhone(n) {
  const d = String(n ?? '');
  const br = d.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  if (br) return `+55 (${br[1]}) ${br[2]}-${br[3]}`;
  return d ? `+${d}` : '';
}

export const ORDER_LIMITS = { name: 80, city: 80, notes: 500 };

/**
 * Monta a mensagem do pedido a partir das linhas disponíveis da sacola.
 * @param {object} o
 * @param {Array} o.lines linhas { product, variant, qty, unit, total }
 * @param {object} [o.customer] { name, cep, city, notes } — todos opcionais
 * @param {string} [o.storeName]
 */
export function buildOrderMessage({ lines, customer = {}, storeName = 'Maison Aura' }) {
  const out = [];
  out.push(`Olá, ${storeName}! Gostaria de fazer um pedido pelo site.`);
  out.push('');
  out.push('*Itens*');
  let subtotal = 0;
  lines.forEach((l, i) => {
    subtotal += l.total;
    const p = l.product, v = l.variant;
    const spec = [p.concentration, v.label].filter(Boolean).join(' · ');
    out.push(`${i + 1}. ${p.name} (${p.brand.name})${p.is_demo ? ' [produto de demonstração]' : ''}`);
    if (spec) out.push(`   ${spec}`);
    out.push(`   ${l.qty} × ${brlText(l.unit)} = ${brlText(l.total)}`);
  });
  out.push('');
  out.push(`*Subtotal dos produtos:* ${brlText(subtotal)}`);
  out.push('Frete, forma de pagamento e disponibilidade a confirmar com a loja.');

  const name = cleanText(customer.name, ORDER_LIMITS.name);
  const cep = maskCep(customer.cep);
  const city = cleanText(customer.city, ORDER_LIMITS.city);
  const notes = cleanText(customer.notes, ORDER_LIMITS.notes, { multiline: true });
  const data = [];
  if (name) data.push(`Nome: ${name}`);
  if (cep.length === 9) data.push(`CEP: ${cep}`);
  if (city) data.push(`Cidade/região: ${city}`);
  if (notes) data.push(`Observações: ${notes}`);
  if (data.length) { out.push(''); out.push('*Meus dados*'); out.push(...data); }
  return out.join('\n');
}

export function buildProductQuestion(product, pageUrl) {
  const lines = [`Olá! Tenho uma dúvida sobre ${product.name} (${product.brand.name}).`];
  if (pageUrl) lines.push(pageUrl);
  return lines.join('\n');
}

export const GENERAL_MESSAGE = 'Olá! Vim pelo site e gostaria de atendimento.';
