// Sprite pipeline — design.md §12 rule 5. At boot, the procedural SVG shapes
// are rasterized into offscreen canvases (per generator × stage) plus an
// additive-blend glow sprite per color. The canvas renderer only ever calls
// drawImage — no per-frame path drawing.

import { GENERATORS } from '../data/generators';
import { SHAPES } from './shapes';

/** World units covered by one node sprite (viewBox -24..24). */
export const SPRITE_WORLD = 48;
const SPRITE_PX = 96;
const GLOW_PX = 128;

export interface SpriteSet {
  stages: HTMLCanvasElement[]; // index = visual stage 0/1/2
  glow: HTMLCanvasElement;
}

export type SpriteAtlas = Record<string, SpriteSet>;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function makeGlow(color: string, px: number = GLOW_PX): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const ctx = c.getContext('2d')!;
  const [r, g, b] = hexToRgb(color);
  const grad = ctx.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2);
  grad.addColorStop(0, `rgba(${r},${g},${b},0.55)`);
  grad.addColorStop(0.35, `rgba(${r},${g},${b},0.18)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, px, px);
  return c;
}

async function rasterizeSVG(inner: string, px: number): Promise<HTMLCanvasElement> {
  const half = SPRITE_WORLD / 2;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-half} ${-half} ${SPRITE_WORLD} ${SPRITE_WORLD}" ` +
    `width="${px}" height="${px}">${inner}</svg>`;
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('sprite rasterization failed'));
      img.src = url;
    });
    const c = document.createElement('canvas');
    c.width = c.height = px;
    c.getContext('2d')!.drawImage(img, 0, 0, px, px);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function buildSprites(): Promise<SpriteAtlas> {
  const atlas: SpriteAtlas = {};
  await Promise.all(
    GENERATORS.map(async (g) => {
      const shape = SHAPES[g.id];
      const stages = await Promise.all(
        [0, 1, 2].map((stage) => rasterizeSVG(shape(stage, g.color), SPRITE_PX)),
      );
      atlas[g.id] = { stages, glow: makeGlow(g.color) };
    }),
  );
  return atlas;
}
