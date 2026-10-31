// Executado depois do "vite build": gera dist/robots.txt e dist/sitemap.xml.
// No modo de demonstração (sem Supabase), o robots.txt bloqueia a indexação da vitrine fictícia.
import { writeFileSync } from 'node:fs';
import { loadEnv } from 'vite';

const env = loadEnv('production', process.cwd(), 'VITE_');
const site = (env.VITE_SITE_URL || '').trim().replace(/\/+$/, '');
const sbUrl = (env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const sbKey = (env.VITE_SUPABASE_ANON_KEY || '').trim();
const live = Boolean(sbUrl && sbKey);
const dist = new URL('../dist/', import.meta.url);

const xmlEsc = (s) => s.replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&apos;', '"': '&quot;' }[c]));

if (!live) {
  writeFileSync(new URL('robots.txt', dist), 'User-agent: *\nDisallow: /\n');
  console.log('[postbuild] Modo demonstração: robots.txt bloqueia a indexação. sitemap.xml não gerado.');
  process.exit(0);
}

const robots = ['User-agent: *', 'Allow: /', 'Disallow: /admin', 'Disallow: /admin.html', 'Disallow: /pedido', 'Disallow: /favoritos'];
if (site) robots.push('', `Sitemap: ${site}/sitemap.xml`);
writeFileSync(new URL('robots.txt', dist), robots.join('\n') + '\n');

if (!site) {
  console.warn('[postbuild] VITE_SITE_URL não definida: sitemap.xml não gerado (o sitemap exige endereços absolutos).');
  process.exit(0);
}

const paths = ['/', '/perfumes', '/femininos', '/masculinos', '/unissex', '/kits', '/ofertas', '/novidades', '/importados', '/sobre', '/contato', '/faq', '/trocas', '/entrega', '/privacidade', '/termos'];
const entries = paths.map((p) => ({ loc: site + p }));

try {
  const res = await fetch(`${sbUrl}/rest/v1/products?select=slug,updated_at&is_active=eq.true`, {
    headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const rows = await res.json();
  for (const r of rows) {
    if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(r.slug)) entries.push({ loc: `${site}/produto/${r.slug}`, lastmod: r.updated_at?.slice(0, 10) });
  }
  console.log(`[postbuild] ${rows.length} produtos incluídos no sitemap.`);
} catch (err) {
  console.warn(`[postbuild] Não foi possível ler os produtos do Supabase (${err.message}). Sitemap gerado só com as páginas fixas.`);
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries
  .map((e) => `  <url><loc>${xmlEsc(e.loc)}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`;
writeFileSync(new URL('sitemap.xml', dist), xml);
console.log('[postbuild] robots.txt e sitemap.xml gerados.');
