/**
 * Processa as artes brutas em art-raw/ e gera os assets finais em public/assets/.
 *
 * - Fundos (bg_*): redimensiona para 960x540.
 * - Retratos (portrait_*): redimensiona para 256x256.
 * - Sprites (hero_*, enemy_*): remove o fundo magenta (chroma key), recorta e redimensiona.
 *
 * Uso: node scripts/process-art.mjs
 */
import sharp from 'sharp';
import { readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';

const RAW = 'art-raw';
const OUT = 'public/assets';

const MAX_SPRITE_H = 420;

const dist = (r1, g1, b1, r2, g2, b2) => Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);

async function chromaKey(file, outFile) {
  const img = sharp(file).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;

  // Cor de fundo: média dos 4 cantos
  const corner = (x, y) => {
    const i = (y * w + x) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const cs = [corner(2, 2), corner(w - 3, 2), corner(2, h - 3), corner(w - 3, h - 3)];
  const bg = [0, 1, 2].map((k) => cs.reduce((a, c) => a + c[k], 0) / 4);

  const LOOSE = 95; // tolerância para flood fill a partir das bordas
  const TIGHT = 45; // tolerância global (buracos fechados)
  const SOFT = 30; // faixa de suavização de borda

  const alpha = new Float32Array(w * h).fill(1);
  const visited = new Uint8Array(w * h);
  const queue = [];

  const d = (idx) => {
    const i = idx * 4;
    return dist(data[i], data[i + 1], data[i + 2], bg[0], bg[1], bg[2]);
  };

  // Semear com as bordas
  for (let x = 0; x < w; x++) {
    queue.push(x, (h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    queue.push(y * w, y * w + (w - 1));
  }

  while (queue.length) {
    const idx = queue.pop();
    if (visited[idx]) continue;
    visited[idx] = 1;
    const dd = d(idx);
    if (dd > LOOSE) continue;
    alpha[idx] = 0;
    const x = idx % w;
    const y = (idx - x) / w;
    if (x > 0) queue.push(idx - 1);
    if (x < w - 1) queue.push(idx + 1);
    if (y > 0) queue.push(idx - w);
    if (y < h - 1) queue.push(idx + w);
  }

  // Passe global para buracos fechados e suavização das bordas
  for (let idx = 0; idx < w * h; idx++) {
    if (alpha[idx] === 0) continue;
    const dd = d(idx);
    if (dd < TIGHT) alpha[idx] = 0;
    else if (dd < TIGHT + SOFT) {
      // Só suaviza se estiver adjacente a um pixel transparente (borda real)
      const x = idx % w;
      const y = (idx - x) / w;
      const nb = [idx - 1, idx + 1, idx - w, idx + w].filter(
        (n) => n >= 0 && n < w * h && Math.abs((n % w) - x) <= 1,
      );
      if (nb.some((n) => alpha[n] === 0)) alpha[idx] = Math.min(alpha[idx], (dd - TIGHT) / SOFT);
      void y;
    }
  }

  // Aplicar alpha + despill (remover tinta magenta nas bordas semi-transparentes)
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let idx = 0; idx < w * h; idx++) {
    const i = idx * 4;
    const a = alpha[idx];
    data[i + 3] = Math.round(a * 255);
    if (a > 0) {
      if (a < 1) {
        // Puxa a cor para longe do magenta
        const t = 1 - a;
        data[i] = Math.max(0, Math.min(255, data[i] - (bg[0] - 128) * t * 0.5));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] - (bg[1] - 128) * t * 0.5));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] - (bg[2] - 128) * t * 0.5));
      }
      const x = idx % w;
      const y = (idx - x) / w;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  const pad = 6;
  const left = Math.max(0, minX - pad);
  const top = Math.max(0, minY - pad);
  const width = Math.min(w, maxX + pad) - left;
  const height = Math.min(h, maxY + pad) - top;

  let out = sharp(data, { raw: { width: w, height: h, channels: 4 } }).extract({ left, top, width, height });
  if (height > MAX_SPRITE_H) out = out.resize({ height: MAX_SPRITE_H, kernel: 'lanczos3' });
  await out.png({ compressionLevel: 9, palette: true, quality: 95, effort: 8 }).toFile(outFile);
  console.log(`✔ sprite  ${path.basename(outFile)} (${width}x${height})`);
}

async function background(file, outFile) {
  await sharp(file).resize(960, 540, { fit: 'cover', kernel: 'lanczos3' }).png({ compressionLevel: 9, palette: true, quality: 95, effort: 8 }).toFile(outFile);
  console.log(`✔ bg      ${path.basename(outFile)}`);
}

async function portrait(file, outFile) {
  await sharp(file).resize(256, 256, { fit: 'cover', kernel: 'lanczos3' }).png({ compressionLevel: 9, palette: true, quality: 95, effort: 8 }).toFile(outFile);
  console.log(`✔ retrato ${path.basename(outFile)}`);
}

async function main() {
  for (const d of ['bg', 'heroes', 'portraits', 'enemies']) await mkdir(path.join(OUT, d), { recursive: true });
  const files = await readdir(RAW);
  for (const f of files) {
    if (!/\.(png|jpg|jpeg)$/i.test(f)) continue;
    const src = path.join(RAW, f);
    const base = f.replace(/\.(png|jpg|jpeg)$/i, '');
    if (base.startsWith('bg_')) await background(src, path.join(OUT, 'bg', `${base.slice(3)}.png`));
    else if (base.startsWith('portrait_')) await portrait(src, path.join(OUT, 'portraits', `${base.slice(9)}.png`));
    else if (base.startsWith('hero_')) await chromaKey(src, path.join(OUT, 'heroes', `${base.slice(5)}.png`));
    else if (base.startsWith('enemy_')) await chromaKey(src, path.join(OUT, 'enemies', `${base.slice(6)}.png`));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
