import { describe, it, expect } from 'vitest';
import { esc, safeUrl, isSlug, slugify, miniMarkup, cleanText, maskCep, isCnpj, brl, brlText } from '../../src/lib/format.js';
import { isPrivilegedKey } from '../../src/lib/config.js';
import { mergeSettings } from '../../src/data/default-settings.js';

describe('escape e URLs', () => {
  it('escapa HTML e atributos', () => {
    expect(esc('<img src=x onerror="alert(1)">\'`&')).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&#39;&#96;&amp;');
    expect(esc(null)).toBe('');
  });
  it('aceita só https, http local e caminhos do site', () => {
    expect(safeUrl('https://x.supabase.co/a.webp')).toBe('https://x.supabase.co/a.webp');
    expect(safeUrl('/images/a.svg')).toBe('/images/a.svg');
    expect(safeUrl('http://localhost:54321/a.png')).toBe('http://localhost:54321/a.png');
    for (const bad of ['javascript:alert(1)', ' JaVaScRiPt:alert(1)', 'data:text/html,<b>', 'vbscript:x', '//evil.com/a.png', 'http://evil.com/a.png', '']) expect(safeUrl(bad)).toBe('');
    expect(safeUrl('/a.png', { allowRelative: false })).toBe('');
  });
  it('valida e gera slugs', () => {
    expect(isSlug('aura-noir')).toBe(true);
    for (const bad of ['Aura', 'aura--noir', '-a', '../x', 'a b', '']) expect(isSlug(bad)).toBe(false);
    expect(slugify('Âmbar & Couro Nº 5')).toBe('ambar-couro-n-5');
  });
});

describe('texto do painel', () => {
  it('marcação mínima escapa qualquer HTML digitado', () => {
    const html = miniMarkup('## Título <b>\n\nTexto <script>alert(1)</script>\nlinha 2\n\n- item 1\n- item <i>2</i>');
    expect(html).toBe('<h2>Título &lt;b&gt;</h2><p>Texto &lt;script&gt;alert(1)&lt;/script&gt;<br>linha 2</p><ul><li>item 1</li><li>item &lt;i&gt;2&lt;/i&gt;</li></ul>');
  });
  it('limpa controles e limita o tamanho', () => {
    expect(cleanText('a\u0000b\tc', 10)).toBe('a b c');
    expect(cleanText('x'.repeat(50), 5)).toBe('xxxxx');
    expect(maskCep('40.000-000abc')).toBe('40000-000');
  });
});

describe('CNPJ', () => {
  it('valida dígitos do CNPJ numérico e do alfanumérico', () => {
    expect(isCnpj('11.222.333/0001-81')).toBe(true);
    expect(isCnpj('11.222.333/0001-80')).toBe(false);
    expect(isCnpj('11.111.111/1111-11')).toBe(false);
    expect(isCnpj('12.ABC.345/01DE-35')).toBe(true);
    expect(isCnpj('12.ABC.345/01DE-36')).toBe(false);
  });
});

describe('chaves do Supabase', () => {
  const jwt = (role) => `x.${btoa(JSON.stringify({ role })).replace(/=+$/, '')}.y`;
  it('bloqueia service_role e secret; aceita anon e publishable', () => {
    expect(isPrivilegedKey(jwt('service_role'))).toBe(true);
    expect(isPrivilegedKey('sb_secret_abc')).toBe(true);
    expect(isPrivilegedKey(jwt('anon'))).toBe(false);
    expect(isPrivilegedKey('sb_publishable_abc')).toBe(false);
  });
});

describe('configurações e moeda', () => {
  it('mescla com o padrão e ignora tipos errados', () => {
    const s = mergeSettings({ store_name: 'Loja', payment_methods: 'Pix', faq: [{ q: 'a' }, { q: 'P', a: 'R' }], new_badge_days: 9999, cnpj: null });
    expect(s.store_name).toBe('Loja');
    expect(s.payment_methods).toEqual([]);
    expect(s.faq).toEqual([{ q: 'P', a: 'R' }]);
    expect(s.new_badge_days).toBe(365);
    expect(s.cnpj).toBe('');
  });
  it('formata reais', () => {
    expect(brlText(1277)).toBe('R$ 1.277,00');
    expect(brl(0.5)).toMatch(/R\$\s0,50/);
  });
});
