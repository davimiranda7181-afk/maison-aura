// Formatação, escape e validações usadas em toda a loja.

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Valor em reais para exibir na página. */
export const brl = (v) => BRL.format(Number(v) || 0);

/** Valor em reais em texto simples (sem espaço inquebrável), para mensagens. */
export const brlText = (v) => brl(v).replace(/ /g, ' ');

/** Escapa texto para inserir em HTML (conteúdo e atributos entre aspas). */
export const esc = (s) => String(s ?? '').replace(/[&<>"'`]/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;',
}[c]));

/** Normaliza para busca: sem acentos e em minúsculas. */
export const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Slug de URL: letras minúsculas, números e hífens. */
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const isSlug = (s) => typeof s === 'string' && s.length <= 120 && SLUG_RE.test(s);
export const slugify = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);

/**
 * Aceita só URLs seguras para imagens e links: https, http em desenvolvimento local
 * e caminhos do próprio site. Recusa javascript:, data:, vbscript: e afins.
 */
export function safeUrl(u, { allowRelative = true } = {}) {
  const s = String(u ?? '').trim();
  if (!s) return '';
  if (allowRelative && /^\/(?!\/)[^\s]*$/.test(s)) return s;
  try {
    const url = new URL(s);
    if (url.protocol === 'https:') return url.href;
    if (url.protocol === 'http:' && /^(localhost|127\.0\.0\.1)$/.test(url.hostname)) return url.href;
  } catch { /* inválida */ }
  return '';
}

/** Remove caracteres de controle e limita o tamanho. Mantém quebras de linha quando pedido. */
export function cleanText(s, max = 200, { multiline = false } = {}) {
  let v = String(s ?? '');
  v = multiline
    ? v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').replace(/\n{3,}/g, '\n\n')
    : v.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s{2,}/g, ' ');
  return v.trim().slice(0, max);
}

export const maskCep = (v) => String(v ?? '').replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2');

/**
 * Texto com marcação mínima (títulos "## ", listas "- ", parágrafos por linha em branco).
 * Tudo é escapado: nenhuma tag digitada no painel chega à página.
 */
export function miniMarkup(src) {
  const blocks = String(src ?? '').replace(/\r\n?/g, '\n').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return blocks.map((b) => {
    if (b.startsWith('## ')) return `<h2>${esc(b.slice(3).trim())}</h2>`;
    const lines = b.split('\n');
    if (lines.every((l) => /^[-•]\s+/.test(l))) {
      return `<ul>${lines.map((l) => `<li>${esc(l.replace(/^[-•]\s+/, ''))}</li>`).join('')}</ul>`;
    }
    return `<p>${lines.map(esc).join('<br>')}</p>`;
  }).join('');
}

/** Valida CNPJ numérico ou alfanumérico (formato da Receita a partir de julho de 2026). */
export function isCnpj(v) {
  const s = String(v ?? '').toUpperCase().replace(/[./-]/g, '');
  if (!/^[0-9A-Z]{12}\d{2}$/.test(s) || /^(\d)\1{13}$/.test(s)) return false;
  const val = (c) => c.charCodeAt(0) - 48;
  const dv = (base) => {
    let w = 2, sum = 0;
    for (let i = base.length - 1; i >= 0; i--) { sum += val(base[i]) * w; w = w === 9 ? 2 : w + 1; }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(s.slice(0, 12));
  const d2 = dv(s.slice(0, 12) + d1);
  return d1 === +s[12] && d2 === +s[13];
}
