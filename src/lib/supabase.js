// Cliente Supabase com a chave pública. As permissões reais ficam nas políticas RLS do banco.
// A biblioteca só é baixada quando o Supabase está configurado.
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from './config.js';

let clientPromise = null;

export function getSupabase() {
  if (!isSupabaseConfigured) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    }));
  }
  return clientPromise;
}
