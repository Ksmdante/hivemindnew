// Procedural node art — ported from the original prototype's generators.js.
// Each shape function takes (stage, color) and returns SVG inner markup
// centered on (0,0). Rasterized into sprites by sprites.ts; never used in DOM.

type ShapeFn = (stage: number, color: string) => string;

function shapeNeuron(stage: number, color: string): string {
  const r = [3.2, 5.5, 8.5][stage];
  const halo = r * 2.2;
  let spokes = '';
  if (stage >= 1) {
    const n = stage === 1 ? 4 : 6;
    const len = r * 1.9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = Math.cos(a) * len;
      const y = Math.sin(a) * len;
      spokes += `<line x1="0" y1="0" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}" stroke="${color}" stroke-width="0.7" stroke-opacity="0.6"/>`;
    }
  }
  return `
    <circle r="${halo}" fill="${color}" fill-opacity="0.12"/>
    ${spokes}
    <circle r="${r}" fill="${color}" fill-opacity="0.95"/>
    <circle r="${r * 0.4}" fill="#ffffff" fill-opacity="0.7"/>
  `;
}

function shapeSynapse(stage: number, color: string): string {
  const w = [5, 8, 12][stage];
  return `
    <ellipse cx="${-w * 0.6}" cy="0" rx="${w * 0.45}" ry="${w * 0.35}" fill="${color}" fill-opacity="0.9"/>
    <ellipse cx="${w * 0.6}" cy="0" rx="${w * 0.45}" ry="${w * 0.35}" fill="${color}" fill-opacity="0.9"/>
    <rect x="${-w * 0.6}" y="-0.6" width="${w * 1.2}" height="1.2" fill="${color}" fill-opacity="0.7"/>
    <circle r="${w * 0.18}" fill="#ffffff" fill-opacity="0.8"/>
  `;
}

function shapeCluster(stage: number, color: string): string {
  const s = [4, 7, 10][stage];
  return `
    <circle cx="0" cy="${-s}" r="${s * 0.45}" fill="${color}"/>
    <circle cx="${-s * 0.85}" cy="${s * 0.5}" r="${s * 0.45}" fill="${color}"/>
    <circle cx="${s * 0.85}" cy="${s * 0.5}" r="${s * 0.45}" fill="${color}"/>
    <circle r="${s * 0.55}" fill="${color}" fill-opacity="0.35"/>
  `;
}

function shapeCortex(stage: number, color: string): string {
  const s = [4.5, 7.5, 11][stage];
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    pts.push(`${(Math.cos(a) * s).toFixed(2)},${(Math.sin(a) * s).toFixed(2)}`);
  }
  return `
    <polygon points="${pts.join(' ')}" fill="${color}" fill-opacity="0.3" stroke="${color}" stroke-width="0.8"/>
    <polygon points="${pts.join(' ')}" transform="scale(0.55)" fill="${color}" fill-opacity="0.85"/>
    <circle r="${s * 0.18}" fill="#ffffff" fill-opacity="0.8"/>
  `;
}

function shapeLattice(stage: number, color: string): string {
  const s = [5, 8, 12][stage];
  return `
    <path d="M 0 ${-s} L ${s} 0 L 0 ${s} L ${-s} 0 Z" fill="none" stroke="${color}" stroke-width="0.9"/>
    <path d="M 0 ${-s * 0.6} L ${s * 0.6} 0 L 0 ${s * 0.6} L ${-s * 0.6} 0 Z" fill="${color}" fill-opacity="0.3"/>
    <line x1="${-s}" y1="0" x2="${s}" y2="0" stroke="${color}" stroke-width="0.6" stroke-opacity="0.7"/>
    <line x1="0" y1="${-s}" x2="0" y2="${s}" stroke="${color}" stroke-width="0.6" stroke-opacity="0.7"/>
    <circle r="${s * 0.25}" fill="${color}"/>
  `;
}

function shapeMycelial(stage: number, color: string): string {
  const s = [5, 9, 13][stage];
  let branches = '';
  const n = 6 + stage * 2;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const len = s * (0.7 + (i % 2) * 0.5);
    const x = Math.cos(a) * len;
    const y = Math.sin(a) * len;
    const mx = Math.cos(a + 0.3) * len * 0.55;
    const my = Math.sin(a + 0.3) * len * 0.55;
    branches += `<path d="M 0 0 Q ${mx.toFixed(2)} ${my.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)}" stroke="${color}" stroke-width="0.8" fill="none" stroke-opacity="0.8"/>`;
  }
  return `
    ${branches}
    <circle r="${s * 0.3}" fill="${color}" fill-opacity="0.9"/>
    <circle r="${s * 0.12}" fill="#ffffff"/>
  `;
}

function shapeLoop(stage: number, color: string): string {
  const s = [5, 8.5, 12][stage];
  return `
    <circle r="${s}" fill="none" stroke="${color}" stroke-width="1" stroke-opacity="0.8"/>
    <circle r="${s * 0.65}" fill="none" stroke="${color}" stroke-width="0.7" stroke-opacity="0.6" stroke-dasharray="2 1.5"/>
    <circle r="${s * 0.35}" fill="${color}" fill-opacity="0.9"/>
    <circle r="${s * 0.12}" fill="#0c0612"/>
  `;
}

function shapeAether(stage: number, color: string): string {
  const s = [5, 9, 14][stage];
  let petals = '';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    petals += `<ellipse cx="0" cy="${-s * 0.6}" rx="${s * 0.3}" ry="${s * 0.6}" fill="${color}" fill-opacity="0.5" transform="rotate(${((a * 180) / Math.PI).toFixed(1)})"/>`;
  }
  return `
    ${petals}
    <circle r="${s * 0.3}" fill="${color}"/>
    <circle r="${s * 0.12}" fill="#ffffff"/>
  `;
}

function shapeXenoglyph(stage: number, color: string): string {
  const s = [5, 8.5, 13][stage];
  return `
    <polygon points="0,${-s} ${s * 0.9},${s * 0.55} ${-s * 0.9},${s * 0.55}" fill="none" stroke="${color}" stroke-width="0.9"/>
    <polygon points="0,${s} ${s * 0.9},${-s * 0.55} ${-s * 0.9},${-s * 0.55}" fill="${color}" fill-opacity="0.25" stroke="${color}" stroke-width="0.7"/>
    <circle r="${s * 0.25}" fill="${color}"/>
    <line x1="${-s * 0.5}" y1="0" x2="${s * 0.5}" y2="0" stroke="#0c0612" stroke-width="0.7"/>
  `;
}

function shapeChoir(stage: number, color: string): string {
  const s = [5, 9, 14][stage];
  return `
    <circle r="${s}" fill="${color}" fill-opacity="0.08" stroke="${color}" stroke-width="0.6" stroke-opacity="0.5"/>
    <path d="M ${-s * 0.8} 0 A ${s * 0.8} ${s * 0.8} 0 0 1 ${s * 0.8} 0" fill="none" stroke="${color}" stroke-width="0.9"/>
    <path d="M ${-s * 0.55} ${s * 0.2} A ${s * 0.55} ${s * 0.55} 0 0 1 ${s * 0.55} ${s * 0.2}" fill="none" stroke="${color}" stroke-width="0.8" stroke-opacity="0.8"/>
    <circle cx="${-s * 0.35}" cy="${-s * 0.1}" r="1" fill="${color}"/>
    <circle cx="${s * 0.35}" cy="${-s * 0.1}" r="1" fill="${color}"/>
    <circle r="${s * 0.18}" fill="${color}"/>
  `;
}

function shapeSingularity(stage: number, _color: string): string {
  const s = [5, 9, 14][stage];
  return `
    <circle r="${s * 1.4}" fill="none" stroke="#ffffff" stroke-width="0.5" stroke-opacity="0.4"/>
    <circle r="${s * 1.1}" fill="none" stroke="#ffffff" stroke-width="0.7" stroke-opacity="0.7"/>
    <circle r="${s}" fill="#000000" stroke="#ffffff" stroke-width="0.9"/>
    <circle r="${s * 0.45}" fill="#000000" stroke="#ffffff" stroke-width="0.4" stroke-opacity="0.6"/>
  `;
}

export const SHAPES: Record<string, ShapeFn> = {
  neuron: shapeNeuron,
  synapse: shapeSynapse,
  cluster: shapeCluster,
  cortex: shapeCortex,
  lattice: shapeLattice,
  mycelial: shapeMycelial,
  loop: shapeLoop,
  aether: shapeAether,
  xeno: shapeXenoglyph,
  choir: shapeChoir,
  singularity: shapeSingularity,
};
