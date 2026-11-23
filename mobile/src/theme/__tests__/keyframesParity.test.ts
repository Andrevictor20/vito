import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KEYFRAMES, PORTED_KEYFRAME_NAMES, type KeyframeSpec } from '../keyframes';

/**
 * Paridade 1:1 entre `theme/keyframes.ts` e os @keyframes de Vito-telas-atualizadas.html.
 *
 * O teste parseia o CSS do protótipo e, para cada keyframe portado, compara:
 *  - o conjunto exato de offsets (0%, 60%, 100%...);
 *  - os valores declarados de opacity/translate/scale/scaleX/scaleY/rotate em cada stop,
 *    respeitando a semântica CSS de `transform:none` (reset para identidade) e de
 *    carry-forward de propriedades não declaradas.
 *
 * Divergência técnica aceita e documentada: `splIn` usa `filter:blur(10px)` no HTML,
 * impossível de reproduzir com `Text` nativo — o frame é comparado sem o blur.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HTML_PATH = path.resolve(__dirname, '../../../../Vito-telas-atualizadas.html');
const html = fs.readFileSync(HTML_PATH, 'utf8');

interface HtmlFrame {
  opacity: number;
  translateX: number;
  translateY: number;
  translateXPercent: number;
  scale: number;
  scaleX: number;
  scaleY: number;
  rotate: number;
}

const IDENTITY: HtmlFrame = {
  opacity: 1,
  translateX: 0,
  translateY: 0,
  translateXPercent: 0,
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  rotate: 0,
};

function extractKeyframeBodies(css: string): Record<string, string> {
  const result: Record<string, string> = {};
  let cursor = 0;
  while (true) {
    const start = css.indexOf('@keyframes', cursor);
    if (start < 0) break;
    const braceStart = css.indexOf('{', start);
    if (braceStart < 0) break;
    const name = css.slice(start + '@keyframes'.length, braceStart).trim();
    let depth = 0;
    let end = braceStart;
    for (; end < css.length; end += 1) {
      if (css[end] === '{') depth += 1;
      else if (css[end] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    result[name] = css.slice(braceStart + 1, end);
    cursor = end + 1;
  }
  return result;
}

const KEYFRAME_BODIES = extractKeyframeBodies(html);

function toOffset(token: string): number | null {
  const value = token.trim();
  if (value === 'from') return 0;
  if (value === 'to') return 1;
  const match = value.match(/^(-?\d+(?:\.\d+)?)%$/);
  if (!match) return null;
  return Number(match[1]) / 100;
}

function parseTranslateArgs(raw: string): { x: number; y: number; xPercent: boolean } {
  const args = raw.split(',').map((part) => part.trim());
  const parseAxis = (value: string) => {
    const num = Number.parseFloat(value);
    return { num: Number.isFinite(num) ? num : 0, percent: value.endsWith('%') };
  };
  const x = parseAxis(args[0] ?? '0');
  const y = parseAxis(args[1] ?? '0');
  return { x: x.num, y: y.num, xPercent: x.percent };
}

function applyTransform(frame: HtmlFrame, value: string): void {
  if (value === 'none') {
    frame.translateX = 0;
    frame.translateY = 0;
    frame.translateXPercent = 0;
    frame.scale = 1;
    frame.scaleX = 1;
    frame.scaleY = 1;
    frame.rotate = 0;
    return;
  }
  const fnRe = /([a-zA-Z]+)\(([^)]*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = fnRe.exec(value))) {
    const fn = match[1];
    const args = match[2];
    if (fn === 'translateX') {
      if (args.trim().endsWith('%')) frame.translateXPercent = Number.parseFloat(args) || 0;
      else frame.translateX = Number.parseFloat(args) || 0;
    } else if (fn === 'translateY') frame.translateY = Number.parseFloat(args) || 0;
    else if (fn === 'translate') {
      const parsed = parseTranslateArgs(args);
      if (parsed.xPercent) frame.translateXPercent = parsed.x;
      else frame.translateX = parsed.x;
      frame.translateY = parsed.y;
    } else if (fn === 'scale') frame.scale = Number.parseFloat(args) || 0;
    else if (fn === 'scaleX') frame.scaleX = Number.parseFloat(args) || 0;
    else if (fn === 'scaleY') frame.scaleY = Number.parseFloat(args) || 0;
    else if (fn === 'rotate') frame.rotate = Number.parseFloat(args) || 0;
  }
}

function parseHtmlFrames(body: string): Map<number, HtmlFrame> {
  const declared = new Map<number, HtmlFrame>();
  const blockRe = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(body))) {
    const selectors = match[1].split(',');
    const declarations = match[2];
    for (const selector of selectors) {
      const at = toOffset(selector);
      if (at === null) continue;
      const frame: HtmlFrame = declared.get(at) ?? { ...IDENTITY };
      for (const decl of declarations.split(';')) {
        const [rawProp, ...rest] = decl.split(':');
        if (!rawProp || rest.length === 0) continue;
        const prop = rawProp.trim();
        const value = rest.join(':').trim();
        if (prop === 'opacity') frame.opacity = Number.parseFloat(value);
        else if (prop === 'transform') applyTransform(frame, value);
        else if (prop === 'translate') {
          const parts = value.split(/\s+/).map((p) => Number.parseFloat(p) || 0);
          frame.translateX = parts[0] ?? 0;
          frame.translateY = parts[1] ?? 0;
        }
      }
      declared.set(at, frame);
    }
  }
  return declared;
}

function carryForward(declared: Map<number, HtmlFrame>): Map<number, HtmlFrame> {
  const offsets = [...declared.keys()].sort((a, b) => a - b);
  const effective = new Map<number, HtmlFrame>();
  let previous: HtmlFrame = { ...IDENTITY };
  for (const at of offsets) {
    const frame = { ...previous, ...declared.get(at)! };
    effective.set(at, frame);
    previous = frame;
  }
  return effective;
}

function normalizeSpec(spec: KeyframeSpec): Map<number, HtmlFrame> {
  const sorted = [...spec.frames].sort((a, b) => a.at - b.at);
  const result = new Map<number, HtmlFrame>();
  let previous: HtmlFrame = { ...IDENTITY };
  for (const frame of sorted) {
    const next: HtmlFrame = {
      opacity: frame.opacity ?? previous.opacity,
      translateX: frame.translateX ?? previous.translateX,
      translateY: frame.translateY ?? previous.translateY,
      translateXPercent: frame.translateXPercent ?? previous.translateXPercent,
      scale: frame.scale ?? previous.scale,
      scaleX: frame.scaleX ?? previous.scaleX,
      scaleY: frame.scaleY ?? previous.scaleY,
      rotate: frame.rotate ?? previous.rotate,
    };
    result.set(frame.at, next);
    previous = next;
  }
  return result;
}

const EPSILON = 1e-6;
function nearly(a: number, b: number): boolean {
  return Math.abs(a - b) <= EPSILON;
}

describe('Keyframes Parity — Vito-telas-atualizadas.html', () => {
  it('porta todos os keyframes declarados e nenhum inventado', () => {
    for (const name of PORTED_KEYFRAME_NAMES) {
      assert.ok(KEYFRAME_BODIES[name], `@keyframes ${name} não existe no protótipo`);
      assert.ok(KEYFRAMES[name], `KEYFRAMES.${name} ausente`);
    }
  });

  for (const name of PORTED_KEYFRAME_NAMES) {
    it(`@keyframes ${name} — offsets e valores idênticos ao protótipo`, () => {
      const spec = KEYFRAMES[name];
      const htmlFrames = carryForward(parseHtmlFrames(KEYFRAME_BODIES[name]));
      const ourFrames = normalizeSpec(spec);

      const htmlOffsets = [...htmlFrames.keys()].sort((a, b) => a - b);
      const ourOffsets = [...ourFrames.keys()].sort((a, b) => a - b);

      // Cada stop do protótipo precisa existir no nosso spec.
      for (const at of htmlOffsets) {
        assert.ok(ourFrames.has(at), `${name}: stop ${at} do protótipo ausente no spec`);
      }
      // Só podemos acrescentar os extremos 0/1 (que o CSS preenche por carry-forward).
      for (const at of ourOffsets) {
        assert.ok(
          htmlOffsets.includes(at) || at === 0 || at === 1,
          `${name}: stop ${at} inventado (o protótipo não o declara)`
        );
      }

      for (const at of htmlOffsets) {
        const expected = htmlFrames.get(at)!;
        const actual = ourFrames.get(at)!;
        assert.ok(
          nearly(actual.opacity, expected.opacity),
          `${name}@${at}: opacity ${actual.opacity} ≠ ${expected.opacity}`
        );
        assert.ok(
          nearly(actual.translateX, expected.translateX),
          `${name}@${at}: translateX ${actual.translateX} ≠ ${expected.translateX}`
        );
        assert.ok(
          nearly(actual.translateY, expected.translateY),
          `${name}@${at}: translateY ${actual.translateY} ≠ ${expected.translateY}`
        );
        assert.ok(
          nearly(actual.translateXPercent, expected.translateXPercent),
          `${name}@${at}: translateXPercent ${actual.translateXPercent} ≠ ${expected.translateXPercent}`
        );
        assert.ok(
          nearly(actual.scale, expected.scale),
          `${name}@${at}: scale ${actual.scale} ≠ ${expected.scale}`
        );
        assert.ok(
          nearly(actual.scaleX, expected.scaleX),
          `${name}@${at}: scaleX ${actual.scaleX} ≠ ${expected.scaleX}`
        );
        assert.ok(
          nearly(actual.scaleY, expected.scaleY),
          `${name}@${at}: scaleY ${actual.scaleY} ≠ ${expected.scaleY}`
        );
        assert.ok(
          nearly(actual.rotate, expected.rotate),
          `${name}@${at}: rotate ${actual.rotate} ≠ ${expected.rotate}`
        );
      }
    });
  }
});
