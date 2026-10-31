// Gera as ilustrações dos produtos de DEMONSTRAÇÃO em public/images/demo/<slug>.svg
// e a imagem padrão public/images/fallback.svg. Produtos reais usam fotos enviadas pelo painel.
// Uso: npm run demo-images
import { mkdirSync, writeFileSync } from 'node:fs';
import { DEMO_LOOKS } from '../src/data/demo-products.js';

const OUT = new URL('../public/images/demo/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const CAPS = { gold: ['#D9BE8A', '#8E6E3C'], black: ['#3A3631', '#0B0A09'], wood: ['#8F6B4A', '#4C3526'], ivory: ['#F6F1E8', '#CFC5B4'] };
const x = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let gid = 0;

function bottle(look) {
  const id = ++gid;
  const cap = CAPS[look.cap] || CAPS.gold;
  let defs = `<linearGradient id="l${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${look.c1}"/><stop offset="1" stop-color="${look.c2}"/></linearGradient>`
    + `<linearGradient id="c${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${cap[1]}"/><stop offset=".45" stop-color="${cap[0]}"/><stop offset="1" stop-color="${cap[1]}"/></linearGradient>`
    + `<linearGradient id="g${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".5" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#fff" stop-opacity=".4"/></linearGradient>`;
  const G = `fill="url(#g${id})" stroke="rgba(40,32,24,.35)" stroke-width="1.2"`, L = `fill="url(#l${id})"`, C = `fill="url(#c${id})"`;
  let b = '', bx, by, bw, bh;
  switch (look.shape) {
    case 'square': [bx, by, bw, bh] = [44, 112, 112, 130]; b = `<rect x="88" y="96" width="24" height="18" ${G}/><rect x="78" y="48" width="44" height="50" rx="3" ${C}/><rect x="44" y="112" width="112" height="130" rx="12" ${G}/><rect x="52" y="128" width="96" height="106" rx="8" ${L}/>`; break;
    case 'round': [bx, by, bw, bh] = [36, 111, 128, 128]; defs += `<clipPath id="k${id}"><rect x="0" y="138" width="200" height="120"/></clipPath>`; b = `<rect x="90" y="98" width="20" height="16" ${G}/><rect x="76" y="46" width="48" height="56" rx="24" ${C}/><circle cx="100" cy="175" r="64" ${G}/><circle cx="100" cy="175" r="56" ${L} clip-path="url(#k${id})"/>`; break;
    case 'facet': [bx, by, bw, bh] = [50, 98, 100, 144]; b = `<rect x="90" y="82" width="20" height="18" ${G}/><polygon points="82,34 118,34 127,46 127,84 73,84 73,46" ${C}/><polygon points="100,98 150,118 150,222 100,242 50,222 50,118" ${G}/><polygon points="100,114 142,130 142,216 100,232 58,216 58,130" ${L}/>`; break;
    case 'flask': [bx, by, bw, bh] = [50, 96, 100, 146]; b = `<rect x="88" y="80" width="24" height="18" ${G}/><rect x="82" y="32" width="36" height="50" rx="2" ${C}/><path d="M70 120Q70 100 90 96L110 96Q130 100 130 120L150 160L150 236Q150 242 144 242L56 242Q50 242 50 236L50 160Z" ${G}/><path d="M76 132L124 132L143 166L143 230Q143 235 138 235L62 235Q57 235 57 230L57 166Z" ${L}/>`; break;
    default: [bx, by, bw, bh] = [62, 92, 76, 150]; b = `<rect x="90" y="76" width="20" height="18" ${G}/><rect x="80" y="24" width="40" height="54" rx="2" ${C}/><rect x="62" y="92" width="76" height="150" rx="4" ${G}/><rect x="68" y="108" width="64" height="128" rx="2" ${L}/>`;
  }
  const lw = Math.min(bw * 0.62, 82), lx = 100 - lw / 2, ly = by + bh * 0.48;
  b += `<rect x="${bx + bw * 0.13}" y="${by + bh * 0.14}" width="4.5" height="${bh * 0.58}" rx="2.2" fill="#fff" opacity=".5"/>`;
  b += `<rect x="${lx}" y="${ly}" width="${lw}" height="24" fill="rgba(255,255,255,.82)"/><line x1="${lx + 6}" y1="${ly + 6}" x2="${lx + lw - 6}" y2="${ly + 6}" stroke="#9A7C46" stroke-width=".6"/>`;
  b += `<text x="100" y="${ly + 16.5}" text-anchor="middle" font-family="Futura, 'Helvetica Neue', Arial, sans-serif" font-size="6" letter-spacing="1.4" fill="#25211C" textLength="${lw - 12}" lengthAdjust="spacingAndGlyphs">${x(look.brand.toUpperCase())}</text>`;
  return { defs, body: b };
}

function frame(inner, defs, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000" role="img" aria-label="${x(label)}">
<defs><radialGradient id="bg" cx=".5" cy=".42" r=".75"><stop offset="0" stop-color="#F8F4EC"/><stop offset="1" stop-color="#E9E0D1"/></radialGradient><radialGradient id="sh" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#0F0E0C" stop-opacity=".18"/><stop offset="1" stop-color="#0F0E0C" stop-opacity="0"/></radialGradient>${defs}</defs>
<rect width="800" height="1000" fill="url(#bg)"/>
<ellipse cx="400" cy="868" rx="230" ry="26" fill="url(#sh)"/>
${inner}
<text x="400" y="960" text-anchor="middle" font-family="Futura, 'Helvetica Neue', Arial, sans-serif" font-size="15" letter-spacing="5" fill="#8C8273">ILUSTRAÇÃO · DEMONSTRAÇÃO</text>
</svg>`;
}

let n = 0;
for (const [slug, look] of Object.entries(DEMO_LOOKS)) {
  let defs = '', inner = '';
  if (look.kit) {
    const pos = [[150, 330, 1.75], [400, 300, 1.85], [275, 250, 1.95]];
    look.kit.forEach((kid, i) => {
      const s = bottle(DEMO_LOOKS[kid]); defs += s.defs;
      const [cx, y, sc] = pos[i];
      inner += `<g transform="translate(${cx - 100 * sc + 100},${y}) scale(${sc})">${s.body}</g>`;
    });
    inner += '<rect x="130" y="760" width="540" height="96" fill="#0F0E0C"/><text x="400" y="818" text-anchor="middle" font-family="Futura, Arial, sans-serif" font-size="22" letter-spacing="10" fill="#C8B086">COFFRET</text>';
  } else {
    const s = bottle(look); defs = s.defs;
    inner = `<g transform="translate(130,170) scale(2.7)">${s.body}</g>`;
  }
  writeFileSync(new URL(`${slug}.svg`, OUT), frame(inner, defs, `Ilustração de demonstração: ${look.name}`));
  n++;
}

writeFileSync(new URL('../public/images/fallback.svg', import.meta.url), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000" role="img" aria-label="Imagem indisponível">
<rect width="800" height="1000" fill="#F2EDE4"/>
<rect x="300" y="330" width="200" height="260" fill="none" stroke="#CFC3AE" stroke-width="2"/>
<text x="400" y="488" text-anchor="middle" font-family="Didot, 'Bodoni 72', 'Times New Roman', serif" font-size="92" fill="#B7A98F">MA</text>
<text x="400" y="680" text-anchor="middle" font-family="Futura, 'Helvetica Neue', Arial, sans-serif" font-size="17" letter-spacing="6" fill="#8C8273">FOTO EM BREVE</text>
</svg>`);

writeFileSync(new URL('../public/favicon.svg', import.meta.url), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#0F0E0C"/><text x="32" y="43" text-anchor="middle" font-family="Didot, 'Times New Roman', serif" font-size="30" fill="#C8B086">MA</text></svg>`);

console.log(`${n} ilustrações de demonstração + fallback.svg + favicon.svg geradas.`);
