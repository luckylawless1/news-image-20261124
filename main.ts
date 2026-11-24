// News 24 Nov 2026 — first edition.
// A hand-written, stdlib-only renderer: draws the day's news poster
// (Broadcast News Package design) as a 1024x1024 PNG and writes it to
// /output/entry.png (or $MAKEFUN_OUTPUT_DIR). No network, no files read,
// no timestamps anywhere in the output, so two runs are byte-identical.
//
// Run: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

// ---------------------------------------------------------------- palette
// Broadcast News Package (STYLE.md section 4), kept exactly.
const INK = '#121417';
const INK2 = '#1B1E23';
const INK3 = '#22262C';
const LEMON = '#F2CF1D';
const LEMON_LIGHT = '#F8DE4A';
const LEMON_DARK = '#D8B30C';
const GOLD = '#D4B064';
const PAPER = '#F4F1E8';
const OLIVE = '#6E5A1E';

function rgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

// ------------------------------------------------------------------ canvas
const W = 1024;
const H = 1024;
const px = new Uint8Array(W * H * 3);

function setPixel(x: number, y: number, c: [number, number, number]): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}

function fillRect(x: number, y: number, w: number, h: number, hex: string): void {
  const c = rgb(hex);
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w));
  const y1 = Math.min(H, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) setPixel(xx, yy, c);
  }
}

function strokeRect(x: number, y: number, w: number, h: number, t: number, hex: string): void {
  fillRect(x, y, w, t, hex);
  fillRect(x, y + h - t, w, t, hex);
  fillRect(x, y, t, h, hex);
  fillRect(x + w - t, y, t, h, hex);
}

// Even-odd scanline fill for any polygon.
function fillPolygon(points: Array<[number, number]>, hex: string): void {
  const c = rgb(hex);
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, y] of points) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  for (let y = Math.max(0, Math.ceil(minY)); y <= Math.min(H - 1, Math.floor(maxY)); y++) {
    const xs: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[(i + 1) % points.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.max(0, Math.ceil(xs[k])); x <= Math.min(W - 1, Math.floor(xs[k + 1])); x++) {
        setPixel(x, y, c);
      }
    }
  }
}

function drawLine(x0: number, y0: number, x1: number, y1: number, w: number, hex: string): void {
  const c = rgb(hex);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  const r = Math.max(1, Math.floor(w / 2));
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + (dx * i) / steps);
    const y = Math.round(y0 + (dy * i) / steps);
    for (let a = -r; a <= r; a++) {
      for (let b = -r; b <= r; b++) {
        if (a * a + b * b <= r * r + 1) setPixel(x + a, y + b, c);
      }
    }
  }
}

function fillCircle(cx: number, cy: number, r: number, hex: string): void {
  const c = rgb(hex);
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) setPixel(x, y, c);
    }
  }
}

function circleOutline(cx: number, cy: number, r: number, t: number, hex: string): void {
  const c = rgb(hex);
  const step = 1 / Math.max(8, r * 2);
  for (let a = 0; a < Math.PI * 2; a += step) {
    const x = Math.round(cx + r * Math.cos(a));
    const y = Math.round(cy + r * Math.sin(a));
    for (let dx = -t; dx <= t; dx++) {
      for (let dy = -t; dy <= t; dy++) setPixel(x + dx, y + dy, c);
    }
  }
}

function ellipseOutline(cx: number, cy: number, rx: number, ry: number, t: number, hex: string): void {
  const c = rgb(hex);
  const step = 1 / Math.max(8, rx * 2);
  for (let a = 0; a < Math.PI * 2; a += step) {
    const x = Math.round(cx + rx * Math.cos(a));
    const y = Math.round(cy + ry * Math.sin(a));
    for (let dx = -t; dx <= t; dx++) {
      for (let dy = -t; dy <= t; dy++) setPixel(x + dx, y + dy, c);
    }
  }
}

// ------------------------------------------------------- 5x7 bitmap font
// Each glyph: 7 rows, 5 bits each (bit 4 = leftmost column). Hand-authored.
const FONT: Record<string, number[]> = {
  A: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  B: [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
  C: [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
  D: [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
  E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  F: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
  G: [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01111],
  H: [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  I: [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  J: [0b00111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100],
  K: [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
  L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  M: [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001],
  N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
  O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  P: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
  Q: [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
  R: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
  S: [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
  T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  U: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  V: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  W: [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b11011, 0b10001],
  X: [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
  Y: [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
  Z: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
  '0': [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
  '1': [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  '2': [0b01110, 0b10001, 0b00001, 0b00110, 0b01000, 0b10000, 0b11111],
  '3': [0b11111, 0b00010, 0b00100, 0b00010, 0b00001, 0b10001, 0b01110],
  '4': [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
  '5': [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110],
  '6': [0b00110, 0b01000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
  '7': [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
  '8': [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
  '9': [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00010, 0b01100],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '.': [0, 0, 0, 0, 0, 0b01100, 0b01100],
  ',': [0, 0, 0, 0, 0b01100, 0b00100, 0b01000],
  ':': [0, 0b01100, 0b01100, 0, 0b01100, 0b01100, 0],
  ';': [0, 0b01100, 0b01100, 0, 0b01100, 0b00100, 0b01000],
  "'": [0b00100, 0b00100, 0b01000, 0, 0, 0, 0],
  '"': [0b01010, 0b01010, 0, 0, 0, 0, 0],
  '-': [0, 0, 0, 0b01110, 0, 0, 0],
  '/': [0b00001, 0b00010, 0b00010, 0b00100, 0b01000, 0b01000, 0b10000],
  '(': [0b00010, 0b00100, 0b01000, 0b01000, 0b01000, 0b00100, 0b00010],
  ')': [0b01000, 0b00100, 0b00010, 0b00010, 0b00010, 0b00100, 0b01000],
  '!': [0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0, 0b00100],
  '?': [0b01110, 0b10001, 0b00001, 0b00110, 0b00100, 0, 0b00100],
  '%': [0b11001, 0b11010, 0b00010, 0b00100, 0b01000, 0b01011, 0b10011],
  '&': [0b01100, 0b10010, 0b10100, 0b01000, 0b10101, 0b10010, 0b01101],
  '+': [0, 0b00100, 0b00100, 0b11111, 0b00100, 0b00100, 0],
  '=': [0, 0, 0b11111, 0, 0b11111, 0, 0],
  '·': [0, 0, 0, 0b01100, 0b01100, 0, 0],
  _: [0, 0, 0, 0, 0, 0, 0b11111],
  '*': [0, 0b00100, 0b10101, 0b01110, 0b10101, 0b00100, 0],
  '[': [0b01110, 0b01000, 0b01000, 0b01000, 0b01000, 0b01000, 0b01110],
  ']': [0b01110, 0b00010, 0b00010, 0b00010, 0b00010, 0b00010, 0b01110],
};

function textWidth(text: string, scale: number): number {
  return text.length * 6 * scale - scale; // 5px glyph + 1px tracking
}

function drawText(text: string, x: number, y: number, scale: number, hex: string): void {
  const c = rgb(hex);
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const g = FONT[ch] ?? FONT['?'];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (g[row] & (1 << (4 - col))) {
          for (let dy = 0; dy < scale; dy++) {
            for (let dx = 0; dx < scale; dx++) {
              setPixel(cx + col * scale + dx, y + row * scale + dy, c);
            }
          }
        }
      }
    }
    cx += 6 * scale;
  }
}

function drawTextRight(text: string, rightX: number, y: number, scale: number, hex: string): void {
  drawText(text, rightX - textWidth(text, scale), y, scale, hex);
}

function drawTextCenter(text: string, cx: number, y: number, scale: number, hex: string): void {
  drawText(text, Math.round(cx - textWidth(text, scale) / 2), y, scale, hex);
}

// ------------------------------------------------------------- pictograms
// Small geometric plates, drawn in code — illustration only, never a photo
// of the event, place or person.
function pictogram(kind: string, cx: number, cy: number): void {
  if (kind === 'globe') {
    circleOutline(cx, cy, 30, 2, LEMON);
    ellipseOutline(cx, cy, 12, 30, 2, GOLD);
    drawLine(cx - 30, cy, cx + 30, cy, 2, GOLD);
    drawLine(cx - 21, cy - 21, cx + 21, cy + 21, 2, GOLD);
  } else if (kind === 'chip') {
    strokeRect(cx - 26, cy - 20, 52, 40, 3, LEMON);
    strokeRect(cx - 11, cy - 8, 22, 16, 2, PAPER);
    for (let i = -1; i <= 1; i++) {
      drawLine(cx + i * 16, cy - 28, cx + i * 16, cy - 20, 2, GOLD);
      drawLine(cx + i * 16, cy + 20, cx + i * 16, cy + 28, 2, GOLD);
      drawLine(cx - 34, cy + i * 13, cx - 26, cy + i * 13, 2, GOLD);
      drawLine(cx + 26, cy + i * 13, cx + 34, cy + i * 13, 2, GOLD);
    }
    drawLine(cx - 24, cy + 26, cx - 8, cy + 12, 2, LEMON_LIGHT);
    drawLine(cx - 8, cy + 12, cx + 2, cy + 18, 2, LEMON_LIGHT);
    drawLine(cx + 2, cy + 18, cx + 22, cy - 2, 2, LEMON_LIGHT);
  } else if (kind === 'ball') {
    circleOutline(cx, cy, 30, 2, LEMON);
    const pent: Array<[number, number]> = [];
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      pent.push([cx + 11 * Math.cos(a), cy + 11 * Math.sin(a)]);
    }
    fillPolygon(pent, PAPER);
    for (const [pxx, pyy] of pent) {
      // Short spokes: stop inside the ball so it reads as a ball, not a wheel.
      drawLine(pxx, pyy, cx + 22 * ((pxx - cx) / 11), cy + 22 * ((pyy - cy) / 11), 2, GOLD);
    }
  } else if (kind === 'warning') {
    fillPolygon(
      [
        [cx, cy - 32],
        [cx - 30, cy + 24],
        [cx + 30, cy + 24],
      ],
      LEMON,
    );
    fillPolygon(
      [
        [cx, cy - 22],
        [cx - 21, cy + 17],
        [cx + 21, cy + 17],
      ],
      INK,
    );
    drawText('!', cx - 10, cy - 16, 4, LEMON);
  } else if (kind === 'flame') {
    fillPolygon(
      [
        [cx - 22, cy + 28],
        [cx - 26, cy + 2],
        [cx - 13, cy - 12],
        [cx - 6, cy - 30],
        [cx + 3, cy - 10],
        [cx + 17, cy - 4],
        [cx + 23, cy + 12],
        [cx + 16, cy + 28],
      ],
      GOLD,
    );
    fillPolygon(
      [
        [cx - 10, cy + 26],
        [cx - 12, cy + 8],
        [cx - 2, cy - 4],
        [cx + 8, cy + 6],
        [cx + 12, cy + 18],
        [cx + 6, cy + 26],
      ],
      LEMON,
    );
  } else if (kind === 'ship') {
    fillPolygon(
      [
        [cx - 30, cy + 6],
        [cx + 30, cy + 6],
        [cx + 20, cy + 24],
        [cx - 20, cy + 24],
      ],
      LEMON,
    );
    drawLine(cx, cy - 28, cx, cy + 6, 3, PAPER);
    fillPolygon(
      [
        [cx, cy - 28],
        [cx, cy + 2],
        [cx + 20, cy + 2],
      ],
      PAPER,
    );
    drawLine(cx - 32, cy + 32, cx - 14, cy + 32, 2, GOLD);
    drawLine(cx - 8, cy + 32, cx + 10, cy + 32, 2, GOLD);
    drawLine(cx + 16, cy + 32, cx + 32, cy + 32, 2, GOLD);
  }
}

// ---------------------------------------------------------------- stories
// Researched Tue 24 Nov 2026 ~00:30 UTC. Every story is dated with the day
// it happened / was first reported; the poster is the 24 Nov first edition
// of the cycle leading into it. Sources in design.md.
interface Story {
  n: string;
  cat: string;
  head: string;
  detail: string;
  date: string;
  pic: string;
}

const STORIES: Story[] = [
  {
    n: '1',
    cat: 'CLIMATE',
    head: 'COP31 COLLAPSES WITH NO DEAL',
    detail: 'ANTALYA: EU REJECTS TEXT WITH NO FOSSIL FUELS',
    date: '22 NOV · UN NEWS',
    pic: 'globe',
  },
  {
    n: '2',
    cat: 'TECH',
    head: 'HUANG BACK AS NVIDIA CEO',
    detail: 'BOARD VOTES UNANIMOUSLY; SHARES JUMP A THIRD',
    date: '23 NOV · REUTERS',
    pic: 'chip',
  },
  {
    n: '3',
    cat: 'SPORT',
    head: "WOMEN'S WORLD CUP HOSTS NAMED",
    detail: 'USA, MEXICO, COSTA RICA, JAMAICA IN 2031; UK IN 2035',
    date: '23 NOV · FIFA.COM',
    pic: 'ball',
  },
  {
    n: '4',
    cat: 'MIDDLE EAST',
    head: "GAZA 'TOXIC WASTELAND': REPORT",
    detail: 'OXFAM: CONTAMINATION SIGNS ACROSS 99% OF GAZA',
    date: '23 NOV · OXFAM',
    pic: 'warning',
  },
  {
    n: '5',
    cat: 'ASIA',
    head: 'INDONESIA FIRE: 24 DEAD',
    detail: 'CIKANDE FACTORY: ABOUT 30 STILL MISSING',
    date: '23 NOV · REUTERS',
    pic: 'flame',
  },
  {
    n: '6',
    cat: 'WAR',
    head: 'UKRAINE CLAIMS WARSHIP SUNK',
    detail: 'KYIV SAYS IT SANK RUSSIAN CORVETTE OFF LIBYA',
    date: '23 NOV · NAVAL NEWS',
    pic: 'ship',
  },
];

// ------------------------------------------------------------------ draw
fillRect(0, 0, W, H, INK);
strokeRect(12, 12, W - 24, H - 24, 2, GOLD);

// ---- header: brand plate (parallelogram) + date block
fillPolygon(
  [
    [36, 140],
    [58, 44],
    [336, 44],
    [314, 140],
  ],
  LEMON,
);
fillPolygon(
  [
    [36, 140],
    [58, 44],
    [70, 44],
    [48, 140],
  ],
  LEMON_DARK,
);
fillPolygon(
  [
    [78, 140],
    [92, 44],
    [98, 44],
    [84, 140],
  ],
  GOLD,
);
drawText('NEWS 24', 108, 60, 5, INK);
drawText('THE WORLD TODAY', 108, 106, 2, INK);
drawText('TUESDAY', 560, 48, 2, GOLD);
drawText('24 NOVEMBER 2026', 560, 74, 4, PAPER);
drawText('FIRST EDITION · AS OF 00:30 UTC', 560, 124, 2, GOLD);
fillRect(36, 158, 952, 4, LEMON);

// ---- rundown rows
let rowY = 186;
for (const s of STORIES) {
  fillRect(36, rowY, 952, 112, INK2);
  fillRect(36, rowY, 952, 4, LEMON);
  // number block
  fillRect(36, rowY, 64, 112, LEMON);
  drawTextCenter(s.n, 68, rowY + 38, 5, INK);
  // category tab
  const tabW = textWidth(s.cat, 2) + 16;
  fillRect(112, rowY + 12, tabW, 26, LEMON);
  drawText(s.cat, 120, rowY + 17, 2, INK);
  // dateline, right-aligned above the pictogram zone
  drawTextRight(s.date, 840, rowY + 17, 2, GOLD);
  // headline + detail
  drawText(s.head, 112, rowY + 48, 3, PAPER);
  drawText(s.detail, 112, rowY + 82, 2, GOLD);
  // pictogram panel
  fillRect(852, rowY + 8, 124, 96, INK3);
  fillRect(852, rowY + 8, 124, 3, LEMON);
  pictogram(s.pic, 914, rowY + 56);
  rowY += 120;
}

// ---- lower-third strap (paper) with sources
fillRect(36, 924, 952, 64, PAPER);
drawText('SOURCES: UN NEWS · REUTERS · AP · FIFA.COM · OXFAM · CNN · NAVAL NEWS', 52, 938, 2, INK);
drawText('DRAWN IN CODE - NO PHOTOGRAPHS · EVERY STORY DATED ON ITS ROW', 52, 962, 2, OLIVE);

// ---- footer line
drawTextCenter('NEWS-IMAGE-20261124 · TUESDAY 24 NOVEMBER 2026 · MAKE.FUN', 512, 996, 2, GOLD);

// ------------------------------------------------------------------- png
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}

const raw = Buffer.alloc(H * (1 + W * 3));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 3)] = 0; // filter: none
  raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // colour type: RGB
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'entry.png'), png);
