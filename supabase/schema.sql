-- =====================================================================
-- MAISON AURA · Esquema do banco (Supabase / PostgreSQL)
-- Execute no Supabase: SQL Editor → New query → cole este arquivo → Run.
-- O script pode ser executado mais de uma vez.
--
-- Segurança: todas as tabelas usam Row Level Security (RLS).
--   · Visitantes (anon) só LEEM o catálogo ativo e as configurações.
--   · Visitantes podem INSERIR inscrição na newsletter (com consentimento), nunca ler.
--   · Escrita no catálogo, configurações e imagens: somente administradores
--     cadastrados em public.admin_users (ver supabase/add-admin.sql).
-- =====================================================================


-- ---------------------------------------------------------------------
-- Funções auxiliares
-- ---------------------------------------------------------------------
create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

-- Converte um array JSON em text[] removendo vazios e espaços.
create or replace function public.jsonb_text_array(j jsonb)
returns text[] language sql immutable as $$
  select coalesce(array_agg(btrim(x)) filter (where btrim(x) <> ''), '{}')
  from jsonb_array_elements_text(case when jsonb_typeof(j) = 'array' then j else '[]'::jsonb end) as t(x);
$$;

-- ---------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------
create table if not exists public.brands (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 80),
  slug       text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 60),
  slug       text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  sort       integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  name          text not null check (char_length(btrim(name)) between 1 and 120),
  brand_id      uuid not null references public.brands (id) on delete restrict,
  type          text not null default 'perfume' check (type in ('perfume', 'kit')),
  gender        text not null default 'unissex' check (gender in ('feminino', 'masculino', 'unissex')),
  family        text check (family in ('amadeirado', 'floral', 'citrico', 'oriental', 'gourmand', 'aromatico')),
  concentration text check (concentration in ('Eau de Cologne', 'Eau de Toilette', 'Eau de Parfum', 'Parfum', 'Extrait de Parfum')),
  description   text not null default '' check (char_length(description) <= 4000),
  notes_top     text[] not null default '{}' check (cardinality(notes_top) <= 12),
  notes_heart   text[] not null default '{}' check (cardinality(notes_heart) <= 12),
  notes_base    text[] not null default '{}' check (cardinality(notes_base) <= 12),
  occasions     text[] not null default '{}' check (occasions <@ array['trabalho', 'encontros', 'eventos', 'diaadia', 'noite']),
  intensity     smallint check (intensity between 1 and 3),
  styles        text[] not null default '{}' check (styles <@ array['fresca', 'doce', 'marcante', 'discreta']),
  kit_contents  text[] not null default '{}' check (cardinality(kit_contents) <= 20),
  featured      boolean not null default false,
  is_active     boolean not null default true,
  sort          integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists products_brand_idx on public.products (brand_id);
create index if not exists products_active_idx on public.products (is_active, sort);

create table if not exists public.product_variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  label       text not null check (char_length(btrim(label)) between 1 and 60),
  volume_ml   integer check (volume_ml > 0 and volume_ml <= 2000),
  price       numeric(10, 2) not null check (price > 0),
  promo_price numeric(10, 2) check (promo_price is null or (promo_price > 0 and promo_price < price)),
  stock       integer not null default 0 check (stock >= 0),
  sku         text unique check (sku is null or char_length(sku) <= 60),
  sort        integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists variants_product_idx on public.product_variants (product_id);

create table if not exists public.product_images (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  storage_path text,
  url          text not null check (url ~ '^https://' and char_length(url) <= 1000),
  alt          text not null check (char_length(btrim(alt)) between 1 and 200),
  sort         integer not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists images_product_idx on public.product_images (product_id);

create table if not exists public.product_categories (
  product_id  uuid not null references public.products (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  primary key (product_id, category_id)
);

-- ---------------------------------------------------------------------
-- Configurações da loja (uma única linha, id = 1)
-- O número de WhatsApp NÃO fica aqui: ele vem de VITE_WHATSAPP_NUMBER.
-- ---------------------------------------------------------------------
create table if not exists public.store_settings (
  id              smallint primary key default 1 check (id = 1),
  store_name      text not null default 'Maison Aura' check (char_length(btrim(store_name)) between 1 and 60),
  topbar_message  text not null default 'Atendimento e pedidos pelo WhatsApp' check (char_length(topbar_message) <= 120),
  about_text      text not null default '' check (char_length(about_text) <= 8000),
  contact_email   text not null default '' check (contact_email = '' or contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'),
  opening_hours   text not null default '' check (char_length(opening_hours) <= 120),
  instagram_url   text not null default '' check (instagram_url = '' or instagram_url ~ '^https://'),
  tiktok_url      text not null default '' check (tiktok_url = '' or tiktok_url ~ '^https://'),
  facebook_url    text not null default '' check (facebook_url = '' or facebook_url ~ '^https://'),
  company_name    text not null default '' check (char_length(company_name) <= 120),
  cnpj            text not null default '' check (cnpj = '' or cnpj ~ '^[0-9A-Z]{2}\.[0-9A-Z]{3}\.[0-9A-Z]{3}/[0-9A-Z]{4}-[0-9]{2}$'),
  address         text not null default '' check (char_length(address) <= 200),
  payment_methods text[] not null default '{}' check (cardinality(payment_methods) <= 10),
  shipping_text   text not null default '' check (char_length(shipping_text) <= 8000),
  privacy_text    text not null default '' check (char_length(privacy_text) <= 12000),
  terms_text      text not null default '' check (char_length(terms_text) <= 12000),
  exchange_text   text not null default '' check (char_length(exchange_text) <= 8000),
  faq             jsonb not null default '[]' check (jsonb_typeof(faq) = 'array'),
  benefits        jsonb check (benefits is null or jsonb_typeof(benefits) = 'array'),
  new_badge_days  smallint not null default 30 check (new_badge_days between 0 and 365),
  updated_at      timestamptz not null default now()
);
insert into public.store_settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Newsletter
-- ---------------------------------------------------------------------
create table if not exists public.newsletter_subscribers (
  id           uuid primary key default gen_random_uuid(),
  email        text not null unique check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' and email = lower(email)),
  consent      boolean not null check (consent),
  consent_text text not null check (char_length(consent_text) between 10 and 500),
  source       text not null default 'site' check (char_length(source) <= 40),
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Gatilhos
-- ---------------------------------------------------------------------
drop trigger if exists products_updated on public.products;
create trigger products_updated before update on public.products for each row execute function public.set_updated_at();
drop trigger if exists variants_updated on public.product_variants;
create trigger variants_updated before update on public.product_variants for each row execute function public.set_updated_at();
drop trigger if exists settings_updated on public.store_settings;
create trigger settings_updated before update on public.store_settings for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.admin_users            enable row level security;
alter table public.brands                 enable row level security;
alter table public.categories             enable row level security;
alter table public.products               enable row level security;
alter table public.product_variants       enable row level security;
alter table public.product_images         enable row level security;
alter table public.product_categories     enable row level security;
alter table public.store_settings         enable row level security;
alter table public.newsletter_subscribers enable row level security;

-- Administradores: cada usuário só vê a própria linha (o painel usa isso para checar a permissão).
-- Não há política de escrita: o cadastro de administradores é feito no SQL Editor.
drop policy if exists admin_users_self on public.admin_users;
create policy admin_users_self on public.admin_users for select to authenticated using (user_id = auth.uid());

-- Leitura pública do catálogo
drop policy if exists brands_read on public.brands;
create policy brands_read on public.brands for select using (true);
drop policy if exists categories_read on public.categories;
create policy categories_read on public.categories for select using (true);
drop policy if exists settings_read on public.store_settings;
create policy settings_read on public.store_settings for select using (true);
drop policy if exists products_read on public.products;
create policy products_read on public.products for select using (is_active or public.is_admin());
drop policy if exists variants_read on public.product_variants;
create policy variants_read on public.product_variants for select using (
  exists (select 1 from public.products p where p.id = product_id and (p.is_active or public.is_admin())));
drop policy if exists images_read on public.product_images;
create policy images_read on public.product_images for select using (
  exists (select 1 from public.products p where p.id = product_id and (p.is_active or public.is_admin())));
drop policy if exists pc_read on public.product_categories;
create policy pc_read on public.product_categories for select using (
  exists (select 1 from public.products p where p.id = product_id and (p.is_active or public.is_admin())));

-- Escrita: somente administradores
drop policy if exists brands_admin on public.brands;
create policy brands_admin on public.brands for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists categories_admin on public.categories;
create policy categories_admin on public.categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists products_admin on public.products;
create policy products_admin on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists variants_admin on public.product_variants;
create policy variants_admin on public.product_variants for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists images_admin on public.product_images;
create policy images_admin on public.product_images for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists pc_admin on public.product_categories;
create policy pc_admin on public.product_categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists settings_admin on public.store_settings;
create policy settings_admin on public.store_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Newsletter: qualquer visitante pode se inscrever com consentimento; só administradores leem e excluem.
drop policy if exists news_insert on public.newsletter_subscribers;
create policy news_insert on public.newsletter_subscribers for insert to anon, authenticated with check (consent = true and source = 'site');
drop policy if exists news_admin_read on public.newsletter_subscribers;
create policy news_admin_read on public.newsletter_subscribers for select to authenticated using (public.is_admin());
drop policy if exists news_admin_delete on public.newsletter_subscribers;
create policy news_admin_delete on public.newsletter_subscribers for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- Salvar produto completo (dados + volumes + categorias) numa única transação.
-- SECURITY INVOKER: as políticas RLS continuam valendo; a checagem explícita dá um erro claro.
-- ---------------------------------------------------------------------
create or replace function public.save_product(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  pid  uuid := nullif(payload->>'id', '')::uuid;
  v    jsonb;
  vid  uuid;
  keep uuid[] := '{}';
begin
  if not public.is_admin() then
    raise exception 'Permissão negada' using errcode = '42501';
  end if;
  if jsonb_typeof(payload->'variants') is distinct from 'array' or jsonb_array_length(payload->'variants') = 0 then
    raise exception 'Cadastre ao menos um volume com preço' using errcode = '22023';
  end if;

  if pid is null then
    insert into public.products (slug, name, brand_id, type, gender, family, concentration, description,
      notes_top, notes_heart, notes_base, occasions, intensity, styles, kit_contents, featured, is_active, sort)
    values (
      payload->>'slug', btrim(payload->>'name'), (payload->>'brand_id')::uuid,
      coalesce(payload->>'type', 'perfume'), coalesce(payload->>'gender', 'unissex'),
      nullif(payload->>'family', ''), nullif(payload->>'concentration', ''), coalesce(payload->>'description', ''),
      public.jsonb_text_array(payload->'notes_top'), public.jsonb_text_array(payload->'notes_heart'), public.jsonb_text_array(payload->'notes_base'),
      public.jsonb_text_array(payload->'occasions'), nullif(payload->>'intensity', '')::smallint, public.jsonb_text_array(payload->'styles'),
      public.jsonb_text_array(payload->'kit_contents'), coalesce((payload->>'featured')::boolean, false),
      coalesce((payload->>'is_active')::boolean, true), coalesce((payload->>'sort')::integer, 0))
    returning id into pid;
  else
    update public.products set
      slug = payload->>'slug', name = btrim(payload->>'name'), brand_id = (payload->>'brand_id')::uuid,
      type = coalesce(payload->>'type', 'perfume'), gender = coalesce(payload->>'gender', 'unissex'),
      family = nullif(payload->>'family', ''), concentration = nullif(payload->>'concentration', ''),
      description = coalesce(payload->>'description', ''),
      notes_top = public.jsonb_text_array(payload->'notes_top'), notes_heart = public.jsonb_text_array(payload->'notes_heart'),
      notes_base = public.jsonb_text_array(payload->'notes_base'), occasions = public.jsonb_text_array(payload->'occasions'),
      intensity = nullif(payload->>'intensity', '')::smallint, styles = public.jsonb_text_array(payload->'styles'),
      kit_contents = public.jsonb_text_array(payload->'kit_contents'),
      featured = coalesce((payload->>'featured')::boolean, false), is_active = coalesce((payload->>'is_active')::boolean, true),
      sort = coalesce((payload->>'sort')::integer, 0)
    where id = pid;
    if not found then raise exception 'Produto não encontrado' using errcode = 'P0002'; end if;
  end if;

  for v in select * from jsonb_array_elements(payload->'variants') loop
    vid := nullif(v->>'id', '')::uuid;
    if vid is null then
      insert into public.product_variants (product_id, label, volume_ml, price, promo_price, stock, sku, sort)
      values (pid, btrim(v->>'label'), nullif(v->>'volume_ml', '')::integer, (v->>'price')::numeric,
              nullif(v->>'promo_price', '')::numeric, coalesce(nullif(v->>'stock', '')::integer, 0),
              nullif(btrim(coalesce(v->>'sku', '')), ''), coalesce((v->>'sort')::integer, 0))
      returning id into vid;
    else
      update public.product_variants set
        label = btrim(v->>'label'), volume_ml = nullif(v->>'volume_ml', '')::integer, price = (v->>'price')::numeric,
        promo_price = nullif(v->>'promo_price', '')::numeric, stock = coalesce(nullif(v->>'stock', '')::integer, 0),
        sku = nullif(btrim(coalesce(v->>'sku', '')), ''), sort = coalesce((v->>'sort')::integer, 0)
      where id = vid and product_id = pid;
      if not found then raise exception 'Volume não pertence a este produto' using errcode = 'P0002'; end if;
    end if;
    keep := keep || vid;
  end loop;
  delete from public.product_variants where product_id = pid and not (id = any (keep));

  delete from public.product_categories where product_id = pid;
  insert into public.product_categories (product_id, category_id)
  select pid, c::uuid from jsonb_array_elements_text(coalesce(payload->'category_ids', '[]'::jsonb)) as t(c)
  on conflict do nothing;

  return pid;
end $$;

revoke all on function public.save_product(jsonb) from public, anon;
grant execute on function public.save_product(jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- Armazenamento de imagens (Supabase Storage)
-- Bucket público para leitura; envio, troca e exclusão só para administradores.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists product_images_read on storage.objects;
create policy product_images_read on storage.objects for select using (bucket_id = 'product-images');
drop policy if exists product_images_insert on storage.objects;
create policy product_images_insert on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and public.is_admin());
drop policy if exists product_images_update on storage.objects;
create policy product_images_update on storage.objects for update to authenticated using (bucket_id = 'product-images' and public.is_admin()) with check (bucket_id = 'product-images' and public.is_admin());
drop policy if exists product_images_delete on storage.objects;
create policy product_images_delete on storage.objects for delete to authenticated using (bucket_id = 'product-images' and public.is_admin());
