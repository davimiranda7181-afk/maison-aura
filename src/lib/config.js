// Única fonte das configurações públicas da loja (variáveis VITE_ do arquivo .env).
const env = import.meta.env || {};

const read = (k) => String(env[k] ?? '').trim();

/** Número de WhatsApp da loja, como foi configurado. Validado em lib/whatsapp.js. */
export const WHATSAPP_NUMBER_RAW = read('VITE_WHATSAPP_NUMBER');

export const SITE_URL = read('VITE_SITE_URL').replace(/\/+$/, '');

const SUPABASE_URL_RAW = read('VITE_SUPABASE_URL');
const SUPABASE_KEY_RAW = read('VITE_SUPABASE_ANON_KEY');

/**
 * Recusa chaves privilegiadas. A chave service_role/secret ignora as políticas de segurança
 * do banco e nunca pode ir para o navegador.
 */
export function isPrivilegedKey(key) {
  if (!key) return false;
  if (/^sb_secret_/i.test(key)) return true;
  const parts = key.split('.');
  if (parts.length === 3) {
    try {
      const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)));
      return json.role === 'service_role';
    } catch { return false; }
  }
  return false;
}

const urlOk = /^https:\/\/[a-z0-9.-]+$/i.test(SUPABASE_URL_RAW.replace(/\/+$/, '')) ||
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(SUPABASE_URL_RAW.replace(/\/+$/, ''));

export const SUPABASE_KEY_REJECTED = isPrivilegedKey(SUPABASE_KEY_RAW);
export const SUPABASE_URL = urlOk ? SUPABASE_URL_RAW.replace(/\/+$/, '') : '';
export const SUPABASE_ANON_KEY = SUPABASE_KEY_REJECTED ? '' : SUPABASE_KEY_RAW;
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (SUPABASE_KEY_REJECTED) {
  console.error('[Maison Aura] VITE_SUPABASE_ANON_KEY contém uma chave privilegiada (service_role/secret). ' +
    'Ela foi ignorada. Use a chave pública "anon" ou "publishable" e troque a chave exposta no painel do Supabase.');
}
if (SUPABASE_URL_RAW && !urlOk) {
  console.error('[Maison Aura] VITE_SUPABASE_URL inválida. Use o endereço https://<projeto>.supabase.co');
}
