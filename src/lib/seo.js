// Título, descrição, link canônico, robots e dados estruturados por página.
import { SITE_URL } from './config.js';

function meta(selector, attr, name, content) {
  let el = document.head.querySelector(selector);
  if (content == null) { el?.remove(); return; }
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, name); document.head.appendChild(el); }
  el.setAttribute('content', content);
}

export function absoluteUrl(path) {
  return SITE_URL ? SITE_URL + path : '';
}

/**
 * @param {object} o
 * @param {string} o.title
 * @param {string} [o.description]
 * @param {string} [o.path] caminho canônico, ex.: /produto/aura-noir
 * @param {boolean} [o.noindex]
 * @param {object} [o.jsonLd]
 * @param {string} [o.image]
 */
export function setPage({ title, description, path, noindex = false, jsonLd = null, image = null, storeName = 'Maison Aura' }) {
  document.title = title ? `${title} · ${storeName}` : `${storeName} · Perfumaria`;
  if (description) {
    meta('meta[name="description"]', 'name', 'description', description);
    meta('meta[property="og:description"]', 'property', 'og:description', description);
  }
  meta('meta[property="og:title"]', 'property', 'og:title', document.title);
  meta('meta[name="robots"]', 'name', 'robots', noindex ? 'noindex, nofollow' : null);

  const abs = path != null ? absoluteUrl(path) : '';
  let link = document.head.querySelector('link[rel="canonical"]');
  if (abs) {
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
    link.href = abs;
    meta('meta[property="og:url"]', 'property', 'og:url', abs);
  } else {
    link?.remove();
    meta('meta[property="og:url"]', 'property', 'og:url', null);
  }
  const img = image && /^\//.test(image) ? absoluteUrl(image) : image;
  meta('meta[property="og:image"]', 'property', 'og:image', img || null);

  document.head.querySelectorAll('script[data-ld]').forEach((s) => s.remove());
  if (jsonLd) {
    const s = document.createElement('script');
    s.type = 'application/ld+json';
    s.dataset.ld = '1';
    // JSON.stringify não escapa "</" — evita fechar a tag script por engano.
    s.textContent = JSON.stringify(jsonLd).replace(/</g, '\\u003c');
    document.head.appendChild(s);
  }
}
