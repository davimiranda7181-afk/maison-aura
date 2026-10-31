// Servidor que imita as rotas do Supabase usadas pela loja e pelo painel (Auth + PostgREST).
// Serve só para os testes de ponta a ponta; as regras de segurança reais estão testadas em tests/unit/db.test.js.
import http from 'node:http';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (sub) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600, aal: 'aal1', session_id: 's1' })}.assinatura`;
const USERS = {
  'admin@loja.test': { id: '11111111-1111-1111-1111-111111111111', password: 'senha-forte-123', admin: true },
  'cliente@loja.test': { id: '22222222-2222-2222-2222-222222222222', password: 'senha-forte-123', admin: false },
};

export function createMock() {
  const log = { rpc: [], settings: [], newsletter: [] };
  const brand = { id: 'b1', name: 'Casa Real', slug: 'casa-real' };
  const products = [
    { id: 'p1', slug: 'perfume-real', name: 'Perfume Real', type: 'perfume', gender: 'feminino', family: 'floral', concentration: 'Eau de Parfum', description: 'Floral cadastrado pela loja.', notes_top: ['Bergamota'], notes_heart: ['Rosa'], notes_base: ['Almíscar'], occasions: ['noite'], intensity: 2, styles: ['doce'], kit_contents: [], featured: true, is_active: true, created_at: '2025-01-01T00:00:00Z', sort: 0, brand_id: 'b1', brand,
      variants: [{ id: 'v1', label: '50 ml', volume_ml: 50, price: 320, promo_price: null, stock: 3, sort: 0, sku: null }],
      images: [{ id: 'i1', url: 'http://localhost:54321/storage/v1/object/public/product-images/nao-existe.webp', alt: 'Frasco do Perfume Real', sort: 0, storage_path: 'p1/nao-existe.webp' }],
      product_categories: [] },
    { id: 'p2', slug: 'perfume-oculto', name: 'Perfume Oculto', type: 'perfume', gender: 'unissex', family: null, concentration: null, description: '', notes_top: [], notes_heart: [], notes_base: [], occasions: [], intensity: null, styles: [], kit_contents: [], featured: false, is_active: false, created_at: '2025-01-01T00:00:00Z', sort: 1, brand_id: 'b1', brand,
      variants: [{ id: 'v2', label: '100 ml', volume_ml: 100, price: 400, promo_price: null, stock: 1, sort: 0, sku: null }], images: [], product_categories: [] },
  ];
  let settings = { id: 1, store_name: 'Loja Real', topbar_message: 'Mensagem real', contact_email: 'contato@loja.test', payment_methods: ['Pix'], benefits: null, faq: [], new_badge_days: 30, cnpj: '', company_name: '' };

  const userFromAuth = (req) => {
    const tok = (req.headers.authorization || '').replace(/^Bearer /, '');
    const parts = tok.split('.');
    if (parts.length !== 3) return null;
    try { const sub = JSON.parse(Buffer.from(parts[1], 'base64url').toString()).sub; return Object.entries(USERS).find(([, u]) => u.id === sub) || null; } catch { return null; }
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'Access-Control-Expose-Headers': 'Content-Range' };
    const send = (code, body, extra = {}) => { res.writeHead(code, { 'Content-Type': 'application/json', ...cors, ...extra }); res.end(body === undefined ? '' : JSON.stringify(body)); };
    if (req.method === 'OPTIONS') return send(204);
    let raw = '';
    for await (const c of req) raw += c;
    const body = raw ? JSON.parse(raw) : null;
    const who = userFromAuth(req);
    const wantsObject = (req.headers.accept || '').includes('vnd.pgrst.object');
    const out = (rows) => send(200, wantsObject ? (rows[0] ?? null) : rows);

    if (url.pathname === '/auth/v1/token') {
      const u = USERS[body?.email];
      if (!u || u.password !== body.password) return send(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      return send(200, { access_token: jwt(u.id), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: { id: u.id, email: body.email, aud: 'authenticated', role: 'authenticated' } });
    }
    if (url.pathname === '/auth/v1/user') return who ? send(200, { id: who[1].id, email: who[0], aud: 'authenticated', role: 'authenticated' }) : send(401, { msg: 'no' });
    if (url.pathname === '/auth/v1/logout') return send(204);
    if (url.pathname.startsWith('/storage/')) return send(404, { error: 'not found' });

    const table = url.pathname.replace('/rest/v1/', '');
    const isAdmin = Boolean(who && who[1].admin);
    if (table === 'rpc/save_product') {
      if (!isAdmin) return send(403, { code: '42501', message: 'Permissão negada' });
      log.rpc.push(body.payload);
      return send(200, body.payload.id || 'p-novo');
    }
    if (table === 'products' && req.method === 'GET') {
      const onlyActive = url.searchParams.get('is_active') === 'eq.true';
      return out(products.filter((p) => isAdmin || p.is_active).filter((p) => !onlyActive || p.is_active));
    }
    if (table === 'brands') return out([brand]);
    if (table === 'categories') return out([]);
    if (table === 'admin_users') return out(isAdmin ? [{ user_id: who[1].id }] : []);
    if (table === 'store_settings' && req.method === 'GET') return out([settings]);
    if (table === 'store_settings' && req.method === 'PATCH') {
      if (!isAdmin) return send(200, []);
      settings = { ...settings, ...body }; log.settings.push(body); return send(204);
    }
    if (table === 'newsletter_subscribers' && req.method === 'POST') { log.newsletter.push(body); return send(201); }
    return send(404, { message: `rota não simulada: ${req.method} ${url.pathname}` });
  });
  return { server, log };
}
