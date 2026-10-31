import { describe, it, expect } from 'vitest';
import { parseWhatsAppNumber, waUrl, buildOrderMessage, formatPhone, buildProductQuestion } from '../../src/lib/whatsapp.js';

const product = (o = {}) => ({ name: 'Âmbar Solar', brand: { name: 'Maison & Filhos' }, concentration: 'Eau de Parfum', is_demo: false, ...o });
const line = (o = {}) => ({ product: product(), variant: { label: '100 ml' }, qty: 2, unit: 489, total: 978, ...o });

describe('número do WhatsApp', () => {
  it('aceita formato internacional só com dígitos', () => {
    expect(parseWhatsAppNumber('5571999998888')).toEqual({ ok: true, number: '5571999998888' });
  });
  it('recusa ausente, com símbolos, curto, longo ou iniciado por zero', () => {
    expect(parseWhatsAppNumber('').reason).toBe('missing');
    expect(parseWhatsAppNumber(undefined).reason).toBe('missing');
    expect(parseWhatsAppNumber('+55 71 99999-8888').reason).toBe('format');
    expect(parseWhatsAppNumber('5571abc').reason).toBe('format');
    expect(parseWhatsAppNumber('719999').reason).toBe('length');
    expect(parseWhatsAppNumber('1234567890123456').reason).toBe('length');
    expect(parseWhatsAppNumber('0071999998888').reason).toBe('length');
  });
  it('não gera link quando o número é inválido', () => {
    expect(waUrl('oi', parseWhatsAppNumber(''))).toBeNull();
    expect(waUrl('oi', parseWhatsAppNumber('+5571'))).toBeNull();
  });
  it('formata número brasileiro para exibição', () => {
    expect(formatPhone('5571999998888')).toBe('+55 (71) 99999-8888');
    expect(formatPhone('551133334444')).toBe('+55 (11) 3333-4444');
    expect(formatPhone('14155550123')).toBe('+14155550123');
  });
});

describe('link wa.me', () => {
  const wa = parseWhatsAppNumber('5571999998888');
  it('usa a URL oficial e codifica acentos, &, #, ?, + e quebras de linha', () => {
    const text = 'Olá! Âmbar & Couro #1? 2+2\nLinha 2 — ção 😊';
    const href = waUrl(text, wa);
    expect(href.startsWith('https://wa.me/5571999998888?text=')).toBe(true);
    const encoded = href.split('?text=')[1];
    expect(encoded).not.toMatch(/[ &#?+\n]/);
    expect(decodeURIComponent(encoded)).toBe(text);
    expect(new URL(href).searchParams.get('text')).toBe(text);
  });
});

describe('mensagem do pedido', () => {
  it('lista itens, volume, quantidade, preço unitário, subtotal e aviso de confirmação', () => {
    const msg = buildOrderMessage({ lines: [line(), line({ product: product({ name: 'Néroli Blanc', concentration: null }), variant: { label: '50 ml' }, qty: 1, unit: 299, total: 299 })] });
    expect(msg).toContain('1. Âmbar Solar (Maison & Filhos)');
    expect(msg).toContain('Eau de Parfum · 100 ml');
    expect(msg).toContain('2 × R$ 489,00 = R$ 978,00');
    expect(msg).toContain('2. Néroli Blanc');
    expect(msg).toContain('*Subtotal dos produtos:* R$ 1.277,00');
    expect(msg).toMatch(/a confirmar com a loja/);
    expect(msg).not.toMatch(/ /); // sem espaço inquebrável no texto enviado
    expect(msg).not.toContain('Meus dados');
  });
  it('inclui só os dados opcionais preenchidos, limpos e limitados', () => {
    const msg = buildOrderMessage({ lines: [line()], customer: { name: '  Ana\u0007 Souza ', cep: '40000000', city: '', notes: 'Para presente.\n\n\n\nObrigada' } });
    expect(msg).toContain('Nome: Ana Souza');
    expect(msg).toContain('CEP: 40000-000');
    expect(msg).not.toContain('Cidade/região');
    expect(msg).toContain('Observações: Para presente.\n\nObrigada');
    const long = buildOrderMessage({ lines: [line()], customer: { notes: 'x'.repeat(2000) } });
    expect(long.match(/x+/)[0].length).toBe(500);
  });
  it('ignora CEP incompleto e marca produtos de demonstração', () => {
    const msg = buildOrderMessage({ lines: [line({ product: product({ is_demo: true }) })], customer: { cep: '400' } });
    expect(msg).not.toContain('CEP');
    expect(msg).toContain('[produto de demonstração]');
  });
  it('pergunta sobre produto inclui o link da página quando existe', () => {
    expect(buildProductQuestion(product(), 'https://loja.com/produto/ambar')).toBe('Olá! Tenho uma dúvida sobre Âmbar Solar (Maison & Filhos).\nhttps://loja.com/produto/ambar');
  });
});
