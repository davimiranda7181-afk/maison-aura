// Vocabulário do catálogo. Os mesmos valores são validados no banco (supabase/schema.sql).

export const FAMILIES = {
  amadeirado: 'Amadeirado',
  floral: 'Floral',
  citrico: 'Cítrico',
  oriental: 'Oriental / ambarado',
  gourmand: 'Gourmand',
  aromatico: 'Aromático',
};

export const OCCASIONS = {
  trabalho: 'Trabalho',
  encontros: 'Encontros',
  eventos: 'Eventos',
  diaadia: 'Dia a dia',
  noite: 'Noite',
};

export const STYLES = { fresca: 'Fresca', doce: 'Doce', marcante: 'Marcante', discreta: 'Discreta' };
export const STYLES_PLURAL = { fresca: 'Frescas', doce: 'Doces', marcante: 'Marcantes', discreta: 'Discretas' };

export const INTENSITY = { 1: 'Suave', 2: 'Moderada', 3: 'Intensa' };

export const GENDERS = { feminino: 'Feminino', masculino: 'Masculino', unissex: 'Unissex' };

/** Faixas usuais de concentração de óleos aromáticos. Variam conforme o fabricante. */
export const CONCENTRATIONS = {
  'Eau de Cologne': 'Concentração usual de cerca de 2% a 5% de óleos aromáticos. Leve e passageira, refrescante.',
  'Eau de Toilette': 'Concentração usual de cerca de 5% a 15% de óleos aromáticos. Mais leve e luminosa, boa para o dia e climas quentes.',
  'Eau de Parfum': 'Concentração usual de cerca de 15% a 20% de óleos aromáticos. Equilíbrio entre presença e fixação.',
  'Parfum': 'Concentração usual a partir de cerca de 20% de óleos aromáticos. Densa e de longa duração.',
  'Extrait de Parfum': 'Concentração usual a partir de cerca de 20% de óleos aromáticos. A forma mais densa de uma fragrância.',
};
