/**
 * Genera los iconos de la aplicación desde la geometría compartida de la marca.
 *
 *   npm run icons
 *
 * Con PREVIEW=1 escribe además una tira de tamaños de revisión, incluidos los
 * 16 y 24 px donde un logo con demasiado detalle se convierte en una mancha.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';

import { logoSvg, VERDE_AZULADO } from '../src/components/brand/geometry';

const raiz = process.cwd();
const svg = logoSvg();

function png(fuente: string, size: number): Buffer {
  return Buffer.from(
    new Resvg(fuente, {
      fitTo: { mode: 'width', value: size },
      background: 'rgba(0,0,0,0)',
    })
      .render()
      .asPng()
  );
}

// SVG para la pestaña: escala sin pixelarse y pesa medio kilobyte.
writeFileSync(join(raiz, 'src', 'app', 'icon.svg'), svg);
console.log('  icon.svg');

// PNG para iOS, que no acepta SVG como icono de aplicación. El nombre
// `apple-icon.png` es una convención de Next: lo publica solo como ruta.
writeFileSync(join(raiz, 'src', 'app', 'apple-icon.png'), png(svg, 180));
console.log('  apple-icon.png   180×180');

// Iconos del manifiesto web (instalación en Android). Van en public/ y no en
// app/, porque Next sólo reconoce como iconos los nombres de su convención y
// `icon-192.png` no es uno: ahí dentro quedaría como un archivo muerto.
for (const size of [192, 512]) {
  writeFileSync(join(raiz, 'public', `icon-${size}.png`), png(svg, size));
  console.log(`  icon-${size}.png`.padEnd(19) + `${size}×${size}`);
}

if (process.env.PREVIEW) {
  const dir = process.argv[2] ?? join(raiz, '.preview');
  mkdirSync(dir, { recursive: true });
  for (const size of [16, 24, 32, 48, 64, 128, 256, 512]) {
    writeFileSync(join(dir, `marca-${size}.png`), png(svg, size));
  }
  // Versión a una tinta, para membretes y documentos impresos.
  writeFileSync(
    join(dir, 'marca-una-tinta.png'),
    png(logoSvg({ cubo: false, tinta: VERDE_AZULADO }), 512)
  );
  console.log(`  vistas previas → ${dir}`);
}

console.log('Iconos generados.');
