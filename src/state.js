// Estado compartilhado da vitrine.
import { load, save } from './lib/storage.js';
import { sanitizeItems, resolveCart } from './lib/cart.js';
import { DEFAULT_SETTINGS } from './data/default-settings.js';

export const KEYS = { cart: 'ma_cart_v2', favs: 'ma_favs_v2', draft: 'ma_order_draft', finder: 'ma_finder_v2' };

export const state = {
  status: 'loading', // loading | ready | error
  error: null,
  mode: 'demo',
  products: [],
  categories: [],
  settings: { ...DEFAULT_SETTINGS },
  byId: new Map(),
  bySlug: new Map(),
  cart: sanitizeItems(load(KEYS.cart, [])),
  favs: (load(KEYS.favs, []) || []).filter((x) => typeof x === 'string').slice(0, 200),
};

export function setCatalog({ mode, products, categories, settings }) {
  state.mode = mode;
  state.products = products;
  state.categories = categories;
  state.settings = settings;
  state.byId = new Map(products.map((p) => [p.id, p]));
  state.bySlug = new Map(products.map((p) => [p.slug, p]));
  state.status = 'ready';
}

export const saveCart = () => save(KEYS.cart, state.cart);
export const saveFavs = () => save(KEYS.favs, state.favs);
export const cartView = () => resolveCart(state.cart, state.byId);
export const isFav = (id) => state.favs.includes(id);
