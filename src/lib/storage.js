// localStorage com tolerância a falhas (aba anônima, cota cheia, armazenamento bloqueado).
// Uso restrito a dados do próprio visitante: sacola, favoritos e rascunho do pedido.

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const v = JSON.parse(raw);
    return v ?? fallback;
  } catch { return fallback; }
}

export function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

export function remove(key) {
  try { localStorage.removeItem(key); } catch { /* ignora */ }
}
