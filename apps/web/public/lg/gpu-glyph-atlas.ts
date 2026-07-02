// Glyph atlas: rasterize a fixed glyph set (ASCII + common punctuation/digits)
// for the app's two families (Inter sans, JetBrains mono) once, into a single
// GPU texture, recording each glyph's atlas rect + advance. Text in the GPU
// scene (gpu-scene-text.ts) is then drawn as textured quads sampling this
// atlas — so labels/numbers live in the scene texture the glass refracts.
//
// Signed-distance would scale crisper, but a plain coverage atlas at a fixed
// high pixel size (rendered down) is far simpler and sharp enough for the
// dashboard's size range; revisit only if large headings look soft.
export type Glyph = { x: number; y: number; w: number; h: number;   // atlas px
  advance: number; bearingX: number; bearingY: number };            // em-relative units (px at ATLAS_PX)
export type FamilyKey = "sans" | "mono";
export type Atlas = {
  canvas: HTMLCanvasElement;
  glyphs: Record<FamilyKey, Map<number, Glyph>>;
  pxSize: number;         // the size each glyph was rasterized at
  lineHeight: number;     // rasterized line box
};

export const ATLAS_PX = 48;                 // rasterization size (downscaled at draw)
const PAD = 3;                              // px gutter between glyphs
const CHARS = (() => {                       // printable ASCII + a few extras
  let s = "";
  for (let c = 0x20; c <= 0x7e; c++) s += String.fromCharCode(c);
  return s + "–—•·×→←↑↓°%";
})();
const FAMILIES: Record<FamilyKey, string> = {
  sans: `${ATLAS_PX}px Inter, system-ui, sans-serif`,
  mono: `${ATLAS_PX}px "JetBrains Mono", ui-monospace, monospace`,
};

export function buildGlyphAtlas(): Atlas {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const cell = ATLAS_PX + PAD * 2;
  const perRow = 32;
  const rows = Math.ceil((CHARS.length * 2) / perRow);
  canvas.width = perRow * cell;
  canvas.height = rows * cell;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#fff";

  const glyphs: Record<FamilyKey, Map<number, Glyph>> = { sans: new Map(), mono: new Map() };
  let idx = 0;
  const baseline = ATLAS_PX * 0.8;
  for (const fam of ["sans", "mono"] as FamilyKey[]) {
    ctx.font = FAMILIES[fam];
    for (const ch of CHARS) {
      const col = idx % perRow, row = Math.floor(idx / perRow);
      const ox = col * cell + PAD, oy = row * cell + PAD;
      const m = ctx.measureText(ch);
      ctx.fillText(ch, ox, oy + baseline);
      glyphs[fam].set(ch.codePointAt(0)!, {
        x: ox, y: oy, w: ATLAS_PX, h: ATLAS_PX,
        advance: m.width,
        bearingX: -(m.actualBoundingBoxLeft || 0),
        bearingY: baseline,
      });
      idx++;
    }
  }
  return { canvas, glyphs, pxSize: ATLAS_PX, lineHeight: ATLAS_PX * 1.2 };
}

// Upload the atlas canvas to a GPU texture (premultiplied coverage in alpha).
export function uploadAtlas(device: GPUDevice, atlas: Atlas): GPUTexture {
  const tex = device.createTexture({
    size: [atlas.canvas.width, atlas.canvas.height], format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
      | GPUTextureUsage.RENDER_ATTACHMENT });
  device.queue.copyExternalImageToTexture(
    { source: atlas.canvas, flipY: false }, { texture: tex },
    [atlas.canvas.width, atlas.canvas.height]);
  return tex;
}
