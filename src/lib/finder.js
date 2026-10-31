// "Encontre sua fragrância": ordena os perfumes pelos atributos cadastrados.
// Sem percentuais: o resultado diz quantas escolhas o perfume atende, e quais.
import { FAMILIES, OCCASIONS, INTENSITY, STYLES } from '../data/labels.js';
import { isAvailable } from './product.js';

export const FINDER_KEYS = ['family', 'occasion', 'intensity', 'style'];

export function recommend(products, answers, limit = 3) {
  const picked = FINDER_KEYS.filter((k) => answers[k]);
  if (!picked.length) return [];
  const scored = products
    .filter((p) => p.type === 'perfume')
    .map((p) => {
      const hits = [];
      let score = 0;
      if (answers.family && p.family === answers.family) { score += 4; hits.push(FAMILIES[p.family]); }
      if (answers.occasion && p.occasions.includes(answers.occasion)) { score += 2; hits.push(OCCASIONS[answers.occasion]); }
      if (answers.intensity && p.intensity) {
        const d = Math.abs(p.intensity - Number(answers.intensity));
        if (d === 0) { score += 2; hits.push(`Intensidade ${INTENSITY[p.intensity].toLowerCase()}`); }
        else if (d === 1) score += 0.5;
      }
      if (answers.style && p.styles.includes(answers.style)) { score += 3; hits.push(STYLES[answers.style]); }
      return { product: p, score, hits, matched: hits.length, asked: picked.length };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score
      || Number(isAvailable(b.product)) - Number(isAvailable(a.product))
      || a.product.name.localeCompare(b.product.name, 'pt-BR'));
  return scored.slice(0, limit);
}

export function matchLabel(r) {
  if (r.matched === r.asked) return r.asked === 1 ? 'Atende à sua escolha' : 'Atende a todas as suas escolhas';
  if (r.matched === 0) return 'Próximo do que você procura';
  return `Atende a ${r.matched} de ${r.asked} escolhas`;
}
