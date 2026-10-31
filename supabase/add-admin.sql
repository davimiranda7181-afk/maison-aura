-- Concede acesso ao painel para um usuário que já existe em Authentication → Users.
-- 1. No Supabase, crie o usuário em Authentication → Users → Add user (e-mail e senha forte).
-- 2. Troque o e-mail abaixo e execute no SQL Editor.

insert into public.admin_users (user_id)
select id from auth.users where email = 'admin@sualoja.com.br'
on conflict (user_id) do nothing;

-- Para remover o acesso:
-- delete from public.admin_users where user_id = (select id from auth.users where email = 'admin@sualoja.com.br');
