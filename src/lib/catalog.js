// Carrega o catálogo: Supabase quando configurado, demonstração quando não.
// Nunca troca silenciosamente o catálogo real pelo de demonstração em caso de erro.
import { isSupabaseConfigured } from './config.js';
import { getSupabase } from './supabase.js';
import { safeUrl, isSlug, cleanText } from './format.js';
import { mergeSettings } from '../data/default-settings.js';
import { FAMILIES, OCCASIONS, STYLES, GENDERS, CONCENTRATIONS } from '../data/labels.js';

const PRODUCT_SELECT = `
  id, slug, name, type, gender, family, concentration, description,
  notes_top, notes_heart, notes_base, occasions, intensity, styles, kit_contents,
  featured, created_at, sort,
  brand:brands ( id, name, slug ),
  variants:product_variants ( id, label, volume_ml, price, promo_price, stock, sort ),
  images:product_images ( url, alt, sort ),
  product_categories ( category:categories ( slug ) )
`;

const arr = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : []);
const bySort = (a, b) => (a.sort ?? 0) - (b.sort ?? 0);

/** Converte uma linha do banco no formato usado pela vitrine e descarta dados inconsistentes. */
export function normalizeProduct(row) {
  if (!row || !isSlug(row.slug) || !row.name || !row.brand) return null;
  const variants = (row.variants || [])
    .map((v) => ({
      id: String(v.id),
      label: cleanText(v.label, 60) || (v.volume_ml ? `${v.volume_ml} ml` : 'Unidade'),
      volume_ml: v.volume_ml == null ? null : Number(v.volume_ml),
      price: Number(v.price),
      promo_price: v.promo_price == null ? null : Number(v.promo_price),
      stock: Math.max(0, Math.trunc(Number(v.stock) || 0)),
      sort: v.sort ?? 0,
    }))
    .filter((v) => Number.isFinite(v.price) && v.price > 0)
    .sort(bySort);
  if (!variants.length) return null;
  const notes = [arr(row.notes_top), arr(row.notes_heart), arr(row.notes_base)];
  return {
    id: String(row.id),
    slug: row.slug,
    name: cleanText(row.name, 120),
    brand: { id: String(row.brand.id), name: cleanText(row.brand.name, 80), slug: row.brand.slug },
    type: row.type === 'kit' ? 'kit' : 'perfume',
    gender: GENDERS[row.gender] ? row.gender : 'unissex',
    family: FAMILIES[row.family] ? row.family : null,
    concentration: CONCENTRATIONS[row.concentration] ? row.concentration : null,
    description: cleanText(row.description, 4000, { multiline: true }),
    notes: notes.some((n) => n.length) ? { top: notes[0], heart: notes[1], base: notes[2] } : null,
    occasions: arr(row.occasions).filter((o) => OCCASIONS[o]),
    intensity: [1, 2, 3].includes(Number(row.intensity)) ? Number(row.intensity) : null,
    styles: arr(row.styles).filter((s) => STYLES[s]),
    kit_contents: arr(row.kit_contents),
    categories: (row.product_categories || []).map((pc) => pc.category?.slug).filter(Boolean),
    featured: Boolean(row.featured),
    created_at: row.created_at || null,
    is_demo: false,
    sort: row.sort ?? 0,
    images: (row.images || []).sort(bySort)
      .map((im) => ({ url: safeUrl(im.url), alt: cleanText(im.alt, 200) || `Foto de ${row.name}` }))
      .filter((im) => im.url),
    variants,
  };
}

export async function loadCatalog() {
  if (!isSupabaseConfigured) {
    const { demoProducts, DEMO_CATEGORIES } = await import('../data/demo-products.js');
    return { mode: 'demo', products: demoProducts(), categories: DEMO_CATEGORIES, settings: mergeSettings(null) };
  }
  const sb = await getSupabase();
  const [prod, cats, sett] = await Promise.all([
    sb.from('products').select(PRODUCT_SELECT).eq('is_active', true).order('sort').order('name'),
    sb.from('categories').select('id, slug, name, sort').order('sort'),
    sb.from('store_settings').select('*').eq('id', 1).maybeSingle(),
  ]);
  const err = prod.error || cats.error || sett.error;
  if (err) throw new Error(err.message || 'Falha ao carregar o catálogo');
  return {
    mode: 'live',
    products: (prod.data || []).map(normalizeProduct).filter(Boolean),
    categories: (cats.data || []).filter((c) => isSlug(c.slug)),
    settings: mergeSettings(sett.data),
  };
}

/** Inscrição na newsletter. Só grava com consentimento explícito. */
export async function subscribeNewsletter(email, consentText) {
  if (!isSupabaseConfigured) return { ok: false, reason: 'not_configured' };
  const sb = await getSupabase();
  const { error } = await sb.from('newsletter_subscribers')
    .insert({ email: email.toLowerCase(), consent: true, consent_text: consentText, source: 'site' });
  if (!error) return { ok: true };
  if (error.code === '23505') return { ok: true, duplicate: true };
  return { ok: false, reason: 'error', message: error.message };
}
