// Coleções da vitrine. Cada uma é um filtro sobre os dados cadastrados.
import { state } from '../state.js';
import { isNew, hasPromo } from '../lib/product.js';

export const COLLECTIONS = {
  perfumes: { title: 'Todas as fragrâncias', sub: 'Perfumes e kits disponíveis na boutique.', test: () => true },
  femininos: { title: 'Perfumes femininos', sub: 'Fragrâncias cadastradas como femininas.', test: (p) => p.gender === 'feminino' },
  masculinos: { title: 'Perfumes masculinos', sub: 'Fragrâncias cadastradas como masculinas.', test: (p) => p.gender === 'masculino' },
  unissex: { title: 'Fragrâncias unissex', sub: 'Para quem escolhe pelo cheiro, não pela etiqueta.', test: (p) => p.gender === 'unissex' },
  importados: { title: 'Perfumes importados', sub: 'Produtos da categoria Importados.', test: (p) => p.categories.includes('importados') },
  kits: { title: 'Kits para presente', sub: 'Coffrets com miniaturas, loções e frascos de viagem.', test: (p) => p.type === 'kit' },
  novidades: { title: 'Novidades', sub: '', test: (p) => isNew(p, state.settings.new_badge_days) },
  ofertas: { title: 'Ofertas', sub: 'Produtos com preço promocional em volumes disponíveis.', test: (p) => hasPromo(p) },
};

export const NAV = [['/', 'Início'], ['/perfumes', 'Perfumes'], ['/femininos', 'Femininos'], ['/masculinos', 'Masculinos'], ['/unissex', 'Unissex'], ['/kits', 'Kits'], ['/ofertas', 'Ofertas']];

export function collection(key) {
  if (COLLECTIONS[key]) {
    const c = COLLECTIONS[key];
    const sub = key === 'novidades' ? `Cadastradas nos últimos ${state.settings.new_badge_days} dias.` : c.sub;
    return { key, title: c.title, sub, path: `/${key}`, test: c.test };
  }
  return null;
}

/** Categoria cadastrada no banco, acessada por /colecao/:slug. */
export function dbCollection(slug) {
  const c = state.categories.find((x) => x.slug === slug);
  if (!c) return null;
  return { key: `colecao/${slug}`, title: c.name, sub: '', path: `/colecao/${slug}`, test: (p) => p.categories.includes(slug) };
}

export const countIn = (test) => state.products.filter(test).length;
