// Lay out TextNodes into glyph quad instances for the scene text pass. Each
// instance = a dest rect (page px, pre-scroll) + the glyph's atlas rect +
// color. The scene renderer draws these sampling the glyph atlas, so text
// lands in the scene texture the glass refracts. Simple left-to-right layout
// (the dashboard's runs are single-line labels/numbers); no bidi/kerning.
import type { Atlas } from "./gpu-glyph-atlas";
import type { TextNode, Scene } from "./gpu-scene-model";

export const GLYPH_STRIDE = 12;   // floats per glyph instance

// 12 floats: dest(x,y,w,h) page px · atlasUV(u0,v0,u1,v1) 0..1 · color rgba.
// maxDepth keeps only text strictly behind it (so a glass surface refracting
// this scene never sees its own text).
export function layoutText(scene: Scene, atlas: Atlas, dpr: number, maxDepth = Infinity): Float32Array {
  const texts = scene.nodes.filter((n): n is TextNode => n.kind === "text" && n.depth < maxDepth);
  const out: number[] = [];
  const aw = atlas.canvas.width, ah = atlas.canvas.height;
  for (const t of texts) {
    const scale = t.size / atlas.pxSize;          // atlas rasterized at ATLAS_PX
    const map = atlas.glyphs[t.family];
    let penX = t.x;
    // t.y is the run's client-rect top (tight to the glyph box). The atlas was
    // rasterized with baseline at 0.8·ATLAS_PX from the cell top; the client
    // rect top sits ~ascent above the baseline, so align baselines directly.
    const baseY = t.y + (atlas.glyphs[t.family].get(72)?.bearingY ?? atlas.pxSize * 0.8) * scale;
    for (const ch of t.text) {
      const g = map.get(ch.codePointAt(0)!);
      if (!g) { penX += t.size * 0.5; continue; }
      const dx = (penX + g.bearingX * scale) * dpr;
      const dy = (baseY - g.bearingY * scale) * dpr;
      const dw = g.w * scale * dpr, dh = g.h * scale * dpr;
      out.push(
        dx, dy, dw, dh,
        g.x / aw, g.y / ah, (g.x + g.w) / aw, (g.y + g.h) / ah,
        t.color[0], t.color[1], t.color[2], t.color[3],
      );
      penX += g.advance * scale;
    }
  }
  return new Float32Array(out);
}

export function glyphCount(data: Float32Array): number {
  return data.length / GLYPH_STRIDE;
}
