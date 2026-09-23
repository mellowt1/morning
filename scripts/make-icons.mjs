// Draws the app icon, a sunrise on morning paper, and writes the PNGs.
//   npm run icons
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, mkdirSync } from 'node:fs';

const GROUND = '#F1F0EC';
const INK = '#1D2125';
const SUN = '#D8AE5E';

// mark: share of the icon the 24px mark box takes.
function svg(size, mark) {
  const g = size * mark;
  const off = (size - g) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${GROUND}"/>
  <g transform="translate(${off} ${off}) scale(${g / 24})" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5.5 16a6.5 6.5 0 0 1 13 0z" fill="${SUN}"/>
    <g fill="none" stroke="${INK}" stroke-width="1.2">
      <path d="M5.5 16a6.5 6.5 0 0 1 13 0"/>
      <path d="M2.5 16h19"/>
      <path d="M12 4.2v2.3M4.6 8.6l1.6 1.6M19.4 8.6l-1.6 1.6"/>
      <path d="M8 19.3h8" stroke-width="1" opacity=".3"/>
    </g>
  </g>
</svg>`;
}

const out = new URL('../app/icons/', import.meta.url);
mkdirSync(out, { recursive: true });
const jobs = [
  ['icon-180.png', 180, 0.68],
  ['icon-192.png', 192, 0.68],
  ['icon-512.png', 512, 0.68],
  // Maskable: the mark stays inside the 80% safe zone, with room to spare.
  ['icon-512-maskable.png', 512, 0.52],
];
for (const [name, size, mark] of jobs) {
  const png = new Resvg(svg(size, mark)).render().asPng();
  writeFileSync(new URL(name, out), png);
  console.log(name, png.length, 'bytes');
}
writeFileSync(new URL('icon.svg', out), svg(512, 0.68));
