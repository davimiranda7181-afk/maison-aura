// @vitest-environment node
// Testa supabase/schema.sql num PostgreSQL real (PGlite), com simulação mínima dos esquemas
// auth e storage do Supabase. Verifica as políticas RLS e a função save_product.
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const schema = readFileSync(new URL('../../supabase/schema.sql', import.meta.url), 'utf8');
const ADMIN = '11111111-1111-1111-1111-111111111111';
const USER = '22222222-2222-2222-2222-222222222222';

const SUPABASE_STUB = `
create role anon nologin; create role authenticated nologin;
create schema auth; create schema storage;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
insert into auth.users values ('${ADMIN}', 'admin@loja.test'), ('${USER}', 'cliente@loja.test');
`;
const GRANTS = `
grant usage on schema public, auth, storage to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
`;

let db;
/** Executa como um papel do Supabase (anon, authenticated) com o usuário indicado. */
async function as(role, uid, sql, params = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid || ''}', false); set role ${role};`);
  try { return await db.query(sql, params); } finally { await db.exec('reset role;'); }
}
const fails = async (p) => { try { await p; return null; } catch (e) { return e.message; } };

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  await db.exec(schema);
  await db.exec(schema); // idempotente
  await db.exec(GRANTS);
  await db.exec(`insert into public.admin_users (user_id) values ('${ADMIN}');
    insert into public.brands (id, name, slug) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Casa Teste', 'casa-teste');
    insert into public.categories (id, name, slug) values ('cccccccc-0000-0000-0000-000000000001', 'Importados', 'importados');
    insert into public.products (id, slug, name, brand_id, is_active) values
      ('bbbbbbbb-0000-0000-0000-000000000001', 'ativo', 'Ativo', 'aaaaaaaa-0000-0000-0000-000000000001', true),
      ('bbbbbbbb-0000-0000-0000-000000000002', 'inativo', 'Inativo', 'aaaaaaaa-0000-0000-0000-000000000001', false);
    insert into public.product_variants (product_id, label, volume_ml, price, stock) values
      ('bbbbbbbb-0000-0000-0000-000000000001', '50 ml', 50, 300, 3),
      ('bbbbbbbb-0000-0000-0000-000000000002', '50 ml', 50, 300, 3);`);
}, 60000);

describe('leitura pública', () => {
  it('visitante vê só produtos ativos e seus volumes', async () => {
    const p = await as('anon', null, 'select slug from public.products order by slug');
    expect(p.rows.map((r) => r.slug)).toEqual(['ativo']);
    const v = await as('anon', null, 'select count(*)::int as n from public.product_variants');
    expect(v.rows[0].n).toBe(1);
  });
  it('administrador vê também os inativos', async () => {
    const p = await as('authenticated', ADMIN, 'select count(*)::int as n from public.products');
    expect(p.rows[0].n).toBe(2);
  });
  it('configurações são públicas para leitura', async () => {
    const s = await as('anon', null, 'select store_name from public.store_settings');
    expect(s.rows[0].store_name).toBe('Maison Aura');
  });
});

describe('escrita protegida', () => {
  it('visitante não cadastra marca', async () => {
    expect(await fails(as('anon', null, "insert into public.brands (name, slug) values ('X', 'x')"))).toMatch(/row-level security/);
  });
  it('cliente logado (não administrador) não altera preço nem configurações', async () => {
    const r = await as('authenticated', USER, 'update public.product_variants set price = 1 returning id');
    expect(r.rows.length).toBe(0);
    const s = await as('authenticated', USER, "update public.store_settings set store_name = 'Invadido' returning id");
    expect(s.rows.length).toBe(0);
  });
  it('cliente logado não usa save_product', async () => {
    const err = await fails(as('authenticated', USER, 'select public.save_product($1::jsonb)', [JSON.stringify({ slug: 'x', name: 'X', brand_id: 'aaaaaaaa-0000-0000-0000-000000000001', variants: [{ label: '50 ml', price: 10 }] })]));
    expect(err).toMatch(/Permissão negada/);
  });
  it('visitante não executa save_product', async () => {
    expect(await fails(as('anon', null, "select public.save_product('{}'::jsonb)"))).toMatch(/permission denied/);
  });
  it('lista de administradores não pode ser alterada pelo site', async () => {
    expect(await fails(as('authenticated', USER, `insert into public.admin_users (user_id) values ('${USER}')`))).toMatch(/row-level security/);
  });
});

describe('save_product (administrador)', () => {
  let id;
  const base = {
    slug: 'novo-perfume', name: '  Novo Perfume ', brand_id: 'aaaaaaaa-0000-0000-0000-000000000001', type: 'perfume', gender: 'feminino',
    family: 'floral', concentration: 'Eau de Parfum', description: 'Teste', notes_top: ['Bergamota', ' '], notes_heart: ['Rosa'], notes_base: [],
    occasions: ['noite'], intensity: 2, styles: ['doce'], category_ids: ['cccccccc-0000-0000-0000-000000000001'],
    variants: [{ label: '50 ml', volume_ml: 50, price: 350, promo_price: 299, stock: 4 }, { label: '100 ml', volume_ml: 100, price: 500, stock: 0 }],
  };
  it('cria produto com volumes e categoria', async () => {
    const r = await as('authenticated', ADMIN, 'select public.save_product($1::jsonb) as id', [JSON.stringify(base)]);
    id = r.rows[0].id;
    const p = await db.query('select name, notes_top from public.products where id = $1', [id]);
    expect(p.rows[0].name).toBe('Novo Perfume');
    expect(p.rows[0].notes_top).toEqual(['Bergamota']);
    const v = await db.query('select count(*)::int as n from public.product_variants where product_id = $1', [id]);
    expect(v.rows[0].n).toBe(2);
    const c = await db.query('select count(*)::int as n from public.product_categories where product_id = $1', [id]);
    expect(c.rows[0].n).toBe(1);
  });
  it('atualiza e remove volumes que saíram do formulário', async () => {
    const keep = (await db.query("select id from public.product_variants where product_id = $1 and label = '50 ml'", [id])).rows[0].id;
    await as('authenticated', ADMIN, 'select public.save_product($1::jsonb)', [JSON.stringify({ ...base, id, category_ids: [], variants: [{ id: keep, label: '50 ml', volume_ml: 50, price: 360, stock: 2 }] })]);
    const v = await db.query('select price::float, promo_price, stock from public.product_variants where product_id = $1', [id]);
    expect(v.rows).toEqual([{ price: 360, promo_price: null, stock: 2 }]);
    const c = await db.query('select count(*)::int as n from public.product_categories where product_id = $1', [id]);
    expect(c.rows[0].n).toBe(0);
  });
  it('recusa promoção maior ou igual ao preço e produto sem volumes', async () => {
    expect(await fails(as('authenticated', ADMIN, 'select public.save_product($1::jsonb)', [JSON.stringify({ ...base, slug: 'p2', variants: [{ label: '50 ml', price: 100, promo_price: 100 }] })]))).toMatch(/check constraint/);
    expect(await fails(as('authenticated', ADMIN, 'select public.save_product($1::jsonb)', [JSON.stringify({ ...base, slug: 'p3', variants: [] })]))).toMatch(/ao menos um volume/);
  });
  it('falha numa variação desfaz o produto inteiro (transação)', async () => {
    await fails(as('authenticated', ADMIN, 'select public.save_product($1::jsonb)', [JSON.stringify({ ...base, slug: 'p4', variants: [{ label: '50 ml', price: 100 }, { label: '', price: 100 }] })]));
    const p = await db.query("select count(*)::int as n from public.products where slug = 'p4'");
    expect(p.rows[0].n).toBe(0);
  });
  it('recusa família ou ocasião fora da lista', async () => {
    expect(await fails(as('authenticated', ADMIN, 'select public.save_product($1::jsonb)', [JSON.stringify({ ...base, slug: 'p5', family: 'inventada' })]))).toMatch(/check constraint/);
    expect(await fails(as('authenticated', ADMIN, 'select public.save_product($1::jsonb)', [JSON.stringify({ ...base, slug: 'p6', occasions: ['praia'] })]))).toMatch(/check constraint/);
  });
});

describe('configurações e newsletter', () => {
  it('administrador altera configurações; CNPJ e links são validados', async () => {
    const ok = await as('authenticated', ADMIN, "update public.store_settings set cnpj = '12.ABC.345/01DE-35', instagram_url = 'https://instagram.com/loja' returning id");
    expect(ok.rows.length).toBe(1);
    expect(await fails(as('authenticated', ADMIN, "update public.store_settings set instagram_url = 'javascript:alert(1)'"))).toMatch(/check constraint/);
    expect(await fails(as('authenticated', ADMIN, "update public.store_settings set cnpj = '123'"))).toMatch(/check constraint/);
  });
  it('visitante se inscreve com consentimento, mas não lê a lista', async () => {
    await as('anon', null, "insert into public.newsletter_subscribers (email, consent, consent_text) values ('ana@exemplo.com', true, 'Aceito receber e-mails de marketing.')");
    const r = await as('anon', null, 'select count(*)::int as n from public.newsletter_subscribers');
    expect(r.rows[0].n).toBe(0);
    const a = await as('authenticated', ADMIN, 'select count(*)::int as n from public.newsletter_subscribers');
    expect(a.rows[0].n).toBe(1);
  });
  it('inscrição sem consentimento ou com e-mail inválido é recusada', async () => {
    expect(await fails(as('anon', null, "insert into public.newsletter_subscribers (email, consent, consent_text) values ('b@exemplo.com', false, 'Aceito receber e-mails de marketing.')"))).toBeTruthy();
    expect(await fails(as('anon', null, "insert into public.newsletter_subscribers (email, consent, consent_text) values ('invalido', true, 'Aceito receber e-mails de marketing.')"))).toBeTruthy();
  });
});

describe('imagens (storage)', () => {
  it('só administrador envia arquivos ao bucket', async () => {
    expect(await fails(as('anon', null, "insert into storage.objects (bucket_id, name) values ('product-images', 'a.webp')"))).toMatch(/row-level security/);
    expect(await fails(as('authenticated', USER, "insert into storage.objects (bucket_id, name) values ('product-images', 'b.webp')"))).toMatch(/row-level security/);
    const r = await as('authenticated', ADMIN, "insert into storage.objects (bucket_id, name) values ('product-images', 'c.webp') returning name");
    expect(r.rows[0].name).toBe('c.webp');
  });
  it('bucket criado com limite de tamanho e tipos de imagem', async () => {
    const b = await db.query("select public, file_size_limit::int, allowed_mime_types from storage.buckets where id = 'product-images'");
    expect(b.rows[0]).toEqual({ public: true, file_size_limit: 5242880, allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] });
  });
});
