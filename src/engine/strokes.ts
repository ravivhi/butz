/* Letter strokes for the writing games (SPEC G-07): print letters on a 300×300 board, guide lines at y=43 and y=257,
   strokes in writing order. Base letters come from the Hebrew_Letters app; final forms descend to y≈286. Pure TS. */
import { LETTER } from './hebrew.ts';

export interface Pt { x: number; y: number }

const STROKES: Record<string, string[]> = {
  'א': ['M 82 60 L 218 240', 'M 212 60 L 212 108 Q 210 142 152 146', 'M 126 118 L 88 240'],
  'ב': ['M 82 60 L 200 60 Q 214 60 214 74 L 214 238', 'M 70 240 L 236 240'],
  'ג': ['M 102 59 L 193 59 L 182 62 L 201 241', 'M 185 174 L 99 240'],
  'ד': ['M 66 62 L 234 62', 'M 202 62 L 202 240'],
  'ה': ['M 73 56 L 223 56 L 226 59 L 227 241', 'M 96 137 L 96 244'],
  'ו': ['M 128 60 L 160 60 Q 170 60 170 72 L 170 240'],
  'ז': ['M 112 60 L 192 60', 'M 152 60 L 150 240'],
  'ח': ['M 82 60 L 204 60 Q 218 60 218 74 L 218 240', 'M 82 62 L 82 240'],
  'ט': ['M 152 100 Q 152 62 186 62 Q 218 62 218 96 L 218 208 Q 218 240 186 240 L 120 240 Q 88 240 88 208 L 88 60'],
  'י': ['M 130 60 L 162 60 Q 172 60 170 72 L 160 132'],
  'כ': ['M 78 60 L 192 60 Q 220 60 220 88 L 220 212 Q 220 240 192 240', 'M 78 240 L 192 240'],
  'ל': ['M 92 14 L 92 96 L 204 96 Q 220 96 216 112 L 178 240'],
  'מ': ['M 118 62 L 198 62 Q 220 62 220 84 L 220 240 L 152 240', 'M 80 62 L 102 82 L 102 240'],
  'נ': ['M 118 60 L 172 60 Q 184 60 184 72 L 184 240 L 104 240'],
  'ס': ['M 74 60 L 190 60 Q 222 60 222 96 L 222 200 Q 222 240 182 240 L 124 240 Q 84 240 84 200 L 84 62'],
  'ע': ['M 212 60 L 206 204 Q 204 240 166 240 L 76 240', 'M 116 60 L 116 240'],
  'פ': ['M 78 60 L 192 60 Q 220 60 220 88 L 220 212 Q 220 240 192 240', 'M 78 240 L 192 240', 'M 84 62 L 84 128 L 140 128'],
  'צ': ['M 84 60 L 200 214 Q 210 240 180 240 L 74 240', 'M 212 60 Q 214 118 158 136'],
  'ק': ['M 78 60 L 204 60 Q 218 60 218 74 L 218 240', 'M 90 118 L 90 286'],
  'ר': ['M 78 60 L 192 60 Q 220 60 220 88 L 220 240'],
  'ש': ['M 84 60 L 84 204 Q 84 240 120 240 L 182 240 Q 218 240 218 204 L 218 60', 'M 151 60 L 151 240'],
  'ת': ['M 74 60 L 204 60 Q 218 60 218 74 L 218 240', 'M 102 60 L 102 224 Q 102 240 86 240 L 70 240'],
  'ך': ['M 82 60 L 200 60 Q 214 60 214 74 L 214 286'],
  'ם': ['M 80 60 L 204 60 Q 220 60 220 76 L 220 240 L 80 240 L 80 60'],
  'ן': ['M 132 60 L 160 60 Q 170 60 170 72 L 170 286'],
  'ף': ['M 78 60 L 192 60 Q 220 60 220 88 L 220 286', 'M 84 62 L 84 128 L 140 128'],
  'ץ': ['M 84 60 L 150 150 L 150 286', 'M 214 60 Q 216 116 156 134'],
};

/** Stroke paths of a letter id (dagesh and dots are not written separately: בּ and ב share one shape). */
export const strokesOf = (letterId: string): string[] => STROKES[LETTER[letterId]?.base ?? ''] ?? [];

/** Dense polyline of a path made of M / L / Q commands (absolute coordinates). */
function polyline(d: string): Pt[] {
  const t = d.trim().split(/[\s,]+/);
  const pts: Pt[] = [];
  let cur: Pt = { x: 0, y: 0 };
  for (let i = 0; i < t.length;) {
    const c = t[i++];
    if (c === 'M' || c === 'L') {
      cur = { x: +t[i++], y: +t[i++] };
      pts.push(cur);
    } else if (c === 'Q') {
      const cx = +t[i++], cy = +t[i++], x = +t[i++], y = +t[i++], p0 = cur;
      for (let k = 1; k <= 20; k++) {
        const u = k / 20, a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, e = u * u;
        pts.push({ x: a * p0.x + b * cx + e * x, y: a * p0.y + b * cy + e * y });
      }
      cur = { x, y };
    } else throw new Error(`unsupported path command ${c}`);
  }
  return pts;
}

/** n points spread evenly along a stroke path (the checkpoints a finger must pass, in order). */
export function samplePath(d: string, n = 40): Pt[] {
  const pl = polyline(d);
  const cum = [0];
  for (let i = 1; i < pl.length; i++) cum.push(cum[i - 1] + Math.hypot(pl[i].x - pl[i - 1].x, pl[i].y - pl[i - 1].y));
  const total = cum[cum.length - 1];
  const out: Pt[] = [];
  let j = 1;
  for (let k = 0; k < n; k++) {
    const target = (total * k) / (n - 1);
    while (j < pl.length - 1 && cum[j] < target) j++;
    const seg = cum[j] - cum[j - 1] || 1;
    const f = Math.min(1, Math.max(0, (target - cum[j - 1]) / seg));
    out.push({ x: pl[j - 1].x + (pl[j].x - pl[j - 1].x) * f, y: pl[j - 1].y + (pl[j].y - pl[j - 1].y) * f });
  }
  return out;
}

export const pathLength = (d: string): number => {
  const pl = polyline(d);
  let s = 0;
  for (let i = 1; i < pl.length; i++) s += Math.hypot(pl[i].x - pl[i - 1].x, pl[i].y - pl[i - 1].y);
  return s;
};

/** Points-to-path (for drawing the part of a stroke already traced). */
export const pointsPath = (pts: Pt[]): string => pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
