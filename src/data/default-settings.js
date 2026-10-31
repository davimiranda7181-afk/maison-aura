// Configuração padrão da loja. Campos vazios ficam ocultos na vitrine.
// No modo real, os valores vêm da tabela store_settings e substituem estes.

export const DEFAULT_SETTINGS = {
  store_name: 'Maison Aura',
  topbar_message: 'Atendimento e pedidos pelo WhatsApp',
  about_text: '',
  contact_email: '',
  opening_hours: '',
  instagram_url: '',
  tiktok_url: '',
  facebook_url: '',
  company_name: '',
  cnpj: '',
  address: '',
  payment_methods: [],
  shipping_text: '',
  privacy_text: '',
  terms_text: '',
  exchange_text: '',
  faq: [],
  new_badge_days: 30,
  benefits: [
    { icon: 'care', on: true, title: 'Atendimento pelo WhatsApp', text: 'Tire dúvidas sobre notas, volumes e disponibilidade antes de decidir.' },
    { icon: 'pay', on: true, title: 'Confirmação antes de pagar', text: 'Disponibilidade, frete e forma de pagamento são combinados na conversa, antes de qualquer cobrança.' },
    { icon: 'swap', on: true, title: 'Direito de arrependimento', text: 'Compras feitas à distância podem ser desfeitas em até 7 dias após o recebimento, conforme o Código de Defesa do Consumidor.' },
    { icon: 'info', on: true, title: 'Informação clara', text: 'Volume, concentração e preço de cada fragrância na página do produto.' },
  ],
};

export const BENEFIT_ICONS = ['care', 'pay', 'swap', 'info', 'track', 'shield'];

/** Mescla a linha do banco com o padrão, ignorando valores nulos e listas inválidas. */
export function mergeSettings(row) {
  const out = { ...DEFAULT_SETTINGS };
  if (!row || typeof row !== 'object') return out;
  for (const k of Object.keys(DEFAULT_SETTINGS)) {
    const v = row[k];
    if (v === null || v === undefined) continue;
    if (Array.isArray(DEFAULT_SETTINGS[k]) && !Array.isArray(v)) continue;
    out[k] = v;
  }
  out.faq = (out.faq || []).filter((x) => x && typeof x.q === 'string' && typeof x.a === 'string');
  out.benefits = (out.benefits || []).filter((x) => x && typeof x.title === 'string');
  out.payment_methods = (out.payment_methods || []).filter((x) => typeof x === 'string' && x.trim());
  out.new_badge_days = Math.max(0, Math.min(365, Number(out.new_badge_days) || 0));
  return out;
}
