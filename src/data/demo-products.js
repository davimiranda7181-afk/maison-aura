// Catálogo de DEMONSTRAÇÃO. Usado somente enquanto o Supabase não está configurado.
// Marcas, nomes, notas e preços são fictícios; cada item leva is_demo: true e é identificado na vitrine.
// As imagens em /images/demo/ são ilustrações geradas por scripts/build-demo-images.mjs.

const BRANDS = {
  'maison-aura': { id: 'b-maison-aura', name: 'Maison Aura', slug: 'maison-aura' },
  'atelier-solene': { id: 'b-atelier-solene', name: 'Atelier Solène', slug: 'atelier-solene' },
  'casa-ibira': { id: 'b-casa-ibira', name: 'Casa Ibirá', slug: 'casa-ibira' },
};

export const DEMO_CATEGORIES = [
  { id: 'c-importados', slug: 'importados', name: 'Importados', sort: 1 },
];

// look: parâmetros da ilustração (formato do frasco, cores do líquido e da tampa).
const RAW = [
  { slug: 'aura-noir', name: 'Aura Noir', brand: 'maison-aura', gender: 'unissex', concentration: 'Eau de Parfum', family: 'amadeirado', occasions: ['noite', 'eventos', 'encontros'], intensity: 3, styles: ['marcante'], notes: [['Pimenta-rosa', 'Bergamota'], ['Íris', 'Cedro'], ['Vetiver', 'Âmbar', 'Couro']], description: 'Um amadeirado escuro e polido, em que a íris encontra o vetiver e um âmbar seco.', featured: true, variants: [[50, 389, null, 6], [100, 549, 489, 4]], look: { shape: 'facet', c1: '#6B4A2B', c2: '#1C130C', cap: 'gold' } },
  { slug: 'lumiere-de-jasmin', name: 'Lumière de Jasmin', brand: 'maison-aura', gender: 'feminino', concentration: 'Eau de Parfum', family: 'floral', occasions: ['diaadia', 'trabalho', 'encontros'], intensity: 2, styles: ['discreta', 'fresca'], notes: [['Neroli', 'Tangerina'], ['Jasmim sambac', 'Flor de laranjeira'], ['Almíscar branco', 'Sândalo']], description: 'Jasmim luminoso com neroli e um fundo de almíscar limpo. Floral claro, que acompanha sem anunciar.', featured: true, variants: [[30, 259, null, 5], [50, 349, null, 8], [100, 499, null, 3]], look: { shape: 'tower', c1: '#F2DFA6', c2: '#D9B866', cap: 'ivory' } },
  { slug: 'cedre-atlantique', name: 'Cèdre Atlantique', brand: 'atelier-solene', categories: ['importados'], gender: 'masculino', concentration: 'Eau de Toilette', family: 'aromatico', occasions: ['trabalho', 'diaadia'], intensity: 2, styles: ['fresca', 'discreta'], notes: [['Lavanda', 'Toranja'], ['Sálvia esclareia', 'Gerânio'], ['Cedro', 'Musgo de carvalho']], description: 'Lavanda e sálvia sobre cedro. Um aromático de alfaiataria, fresco e seguro.', variants: [[50, 329, null, 4], [100, 459, null, 2]], look: { shape: 'square', c1: '#B9C7C4', c2: '#6F8783', cap: 'black' } },
  { slug: 'neroli-blanc', name: 'Néroli Blanc', brand: 'atelier-solene', categories: ['importados'], gender: 'unissex', concentration: 'Eau de Toilette', family: 'citrico', occasions: ['diaadia', 'trabalho'], intensity: 1, styles: ['fresca', 'discreta'], notes: [['Limão siciliano', 'Petitgrain'], ['Neroli', 'Chá verde'], ['Almíscar branco']], description: 'Cítrico transparente de neroli e petitgrain, como linho branco recém-passado.', newDays: 6, variants: [[50, 299, null, 7], [100, 419, null, 5]], look: { shape: 'tower', c1: '#F6F0D6', c2: '#E4D7A2', cap: 'gold' } },
  { slug: 'vanille-sauvage', name: 'Vanille Sauvage', brand: 'casa-ibira', gender: 'feminino', concentration: 'Eau de Parfum', family: 'gourmand', occasions: ['encontros', 'noite'], intensity: 3, styles: ['doce', 'marcante'], notes: [['Pera', 'Cardamomo'], ['Fava tonka', 'Caramelo salgado'], ['Baunilha', 'Benjoim']], description: 'Baunilha escura e tostada, cortada por cardamomo e um toque de sal. Doce com caráter.', featured: true, variants: [[50, 319, null, 6], [100, 449, 399, 3]], look: { shape: 'round', c1: '#D79A5E', c2: '#7A4321', cap: 'gold' } },
  { slug: 'couro-ebano', name: 'Couro Ébano', brand: 'casa-ibira', gender: 'masculino', concentration: 'Extrait de Parfum', family: 'oriental', occasions: ['noite', 'eventos'], intensity: 3, styles: ['marcante'], notes: [['Açafrão', 'Pimenta-preta'], ['Couro', 'Ládano'], ['Oud', 'Patchouli', 'Âmbar']], description: 'Couro macio, açafrão e oud em forma de extrato. Uma assinatura densa para noites longas.', variants: [[50, 529, null, 2], [100, 759, null, 0]], look: { shape: 'square', c1: '#4A2618', c2: '#140A06', cap: 'black' } },
  { slug: 'rose-sepia', name: 'Rose Sépia', brand: 'atelier-solene', categories: ['importados'], gender: 'feminino', concentration: 'Extrait de Parfum', family: 'floral', occasions: ['eventos', 'encontros', 'noite'], intensity: 3, styles: ['marcante'], notes: [['Framboesa', 'Açafrão'], ['Rosa damascena'], ['Patchouli', 'Almíscar']], description: 'Rosa sobre patchouli e almíscar. Floral profundo, de cor sépia e veludo.', newDays: 12, variants: [[50, 589, null, 3], [100, 829, null, 1]], look: { shape: 'facet', c1: '#C1666B', c2: '#5E1F28', cap: 'gold' } },
  { slug: 'figueira-mate', name: 'Figueira & Mate', brand: 'casa-ibira', gender: 'unissex', concentration: 'Eau de Toilette', family: 'aromatico', occasions: ['diaadia', 'trabalho'], intensity: 1, styles: ['fresca', 'discreta'], notes: [['Folha de figo', 'Bergamota'], ['Erva-mate', 'Folha de violeta'], ['Vetiver']], description: 'Folha de figo e erva-mate verde sobre vetiver. Verde, fresco e um pouco leitoso.', newDays: 3, variants: [[50, 269, null, 9], [100, 379, null, 6]], look: { shape: 'flask', c1: '#C8D3A2', c2: '#7E8D4F', cap: 'wood' } },
  { slug: 'ambar-solar', name: 'Âmbar Solar', brand: 'maison-aura', gender: 'unissex', concentration: 'Eau de Parfum', family: 'oriental', occasions: ['noite', 'eventos', 'encontros'], intensity: 3, styles: ['doce', 'marcante'], notes: [['Laranja amarga', 'Canela'], ['Labdanum', 'Flor de laranjeira'], ['Âmbar', 'Benjoim', 'Baunilha']], description: 'Âmbar quente e resinoso iluminado por laranja amarga e canela.', featured: true, variants: [[50, 369, null, 5], [100, 519, null, 4]], look: { shape: 'round', c1: '#E8A84A', c2: '#9A5418', cap: 'black' } },
  { slug: 'the-blanc', name: 'Thé Blanc', brand: 'atelier-solene', categories: ['importados'], gender: 'feminino', concentration: 'Eau de Toilette', family: 'citrico', occasions: ['trabalho', 'diaadia'], intensity: 1, styles: ['fresca', 'discreta'], notes: [['Bergamota', 'Pera'], ['Chá branco', 'Peônia'], ['Almíscar', 'Cedro branco']], description: 'Chá branco, pera e peônia. Sutil e limpo, feito para estar perto.', variants: [[50, 289, 249, 6], [100, 399, null, 4]], look: { shape: 'flask', c1: '#F3E6DA', c2: '#DCC3AE', cap: 'ivory' } },
  { slug: 'tabac-dore', name: 'Tabac Doré', brand: 'maison-aura', gender: 'masculino', concentration: 'Eau de Parfum', family: 'gourmand', occasions: ['noite', 'encontros'], intensity: 3, styles: ['doce', 'marcante'], notes: [['Rum', 'Cravo'], ['Folha de tabaco', 'Mel'], ['Cacau', 'Fava tonka']], description: 'Folha de tabaco no mel, com cacau e fava tonka. Quente, envolvente e noturno.', featured: true, variants: [[50, 399, null, 5], [100, 569, null, 3]], look: { shape: 'tower', c1: '#A2622B', c2: '#3E2110', cap: 'gold' } },
  { slug: 'vetiver-gris', name: 'Vetiver Gris', brand: 'atelier-solene', categories: ['importados'], gender: 'masculino', concentration: 'Eau de Parfum', family: 'amadeirado', occasions: ['trabalho', 'diaadia', 'encontros'], intensity: 2, styles: ['discreta', 'fresca'], notes: [['Toranja', 'Pimenta-rosa'], ['Vetiver', 'Íris'], ['Almíscar', 'Cedro']], description: 'Vetiver limpo e mineral, aberto por toranja. Amadeirado sóbrio e elegante.', featured: true, variants: [[50, 419, null, 4], [100, 589, 529, 2]], look: { shape: 'square', c1: '#C9C2B2', c2: '#827A69', cap: 'black' } },
  { slug: 'coffret-descoberta', name: 'Coffret Descoberta', brand: 'maison-aura', type: 'kit', gender: 'unissex', concentration: null, description: 'Miniaturas das fragrâncias da casa para descobrir sua assinatura antes de escolher o frasco grande.', kit_contents: ['Aura Noir 10 ml', 'Lumière de Jasmin 10 ml', 'Âmbar Solar 10 ml', 'Tabac Doré 10 ml'], featured: true, variants: [['4 × 10 ml', 249, null, 8, 40]], look: { kit: ['aura-noir', 'lumiere-de-jasmin', 'ambar-solar'] } },
  { slug: 'coffret-lumiere', name: 'Coffret Lumière', brand: 'maison-aura', type: 'kit', gender: 'feminino', concentration: 'Eau de Parfum', description: 'Lumière de Jasmin em Eau de Parfum com a loção corporal da mesma fragrância, em caixa presente.', kit_contents: ['Lumière de Jasmin Eau de Parfum 50 ml', 'Loção corporal 100 ml', 'Caixa presente'], variants: [['50 ml + loção 100 ml', 449, 399, 4, 50]], look: { kit: ['lumiere-de-jasmin', 'the-blanc', 'neroli-blanc'] } },
  { slug: 'coffret-noite', name: 'Coffret Noite', brand: 'maison-aura', type: 'kit', gender: 'masculino', concentration: 'Eau de Parfum', description: 'Tabac Doré no frasco de 100 ml com a versão de viagem de 10 ml.', kit_contents: ['Tabac Doré Eau de Parfum 100 ml', 'Tabac Doré 10 ml de viagem', 'Caixa presente'], variants: [['100 ml + 10 ml', 599, null, 0, 110]], look: { kit: ['tabac-dore', 'aura-noir', 'couro-ebano'] } },
];

export const DEMO_LOOKS = Object.fromEntries(RAW.map((r) => [r.slug, { ...r.look, brand: BRANDS[r.brand].name, name: r.name }]));

const OLD_DATE = '2025-11-01T12:00:00.000Z';

/** Produtos de demonstração no mesmo formato que o catálogo real carregado do Supabase. */
export function demoProducts(now = Date.now()) {
  return RAW.map((r, i) => {
    const brand = BRANDS[r.brand];
    return {
      id: `demo-${r.slug}`,
      slug: r.slug,
      name: r.name,
      brand,
      type: r.type || 'perfume',
      gender: r.gender,
      family: r.family || null,
      concentration: r.concentration,
      description: r.description,
      notes: r.notes ? { top: r.notes[0], heart: r.notes[1], base: r.notes[2] } : null,
      occasions: r.occasions || [],
      intensity: r.intensity || null,
      styles: r.styles || [],
      kit_contents: r.kit_contents || [],
      categories: r.categories || [],
      featured: Boolean(r.featured),
      created_at: r.newDays ? new Date(now - r.newDays * 864e5).toISOString() : OLD_DATE,
      is_demo: true,
      sort: i,
      images: [{ url: `/images/demo/${r.slug}.svg`, alt: `Ilustração de demonstração do frasco de ${r.name}` }],
      variants: r.variants.map(([vol, price, promo, stock, ml], k) => ({
        id: `demo-${r.slug}-${k}`,
        label: typeof vol === 'number' ? `${vol} ml` : vol,
        volume_ml: typeof vol === 'number' ? vol : (ml ?? null),
        price,
        promo_price: promo,
        stock,
      })),
    };
  });
}
