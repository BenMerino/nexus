// Pipeline + buffer construction for the scene renderer (split from
// gpu-scene-render.ts for the 150-line cap). Builds the four passes that fill
// the scene texture — sky (fullscreen), rects (squircle cards), polys (chart
// strokes), text (glyph quads) — all writing FORMAT with straight-alpha blend.
import { SCENE_SHADER, SCENE_SKY_SHADER } from "./gpu-scene-shader";
import { SCENE_TEXT_SHADER, SCENE_POLY_SHADER } from "./gpu-scene-shader-glyph";

export const FORMAT: GPUTextureFormat = "rgba16float";
const BLEND: GPUBlendState = {
  color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
  alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
};

function pipe(device: GPUDevice, code: string, blend: boolean): GPURenderPipeline {
  const mod = device.createShaderModule({ code });
  return device.createRenderPipeline({
    layout: "auto",
    vertex: { module: mod, entryPoint: "vs" },
    fragment: { module: mod, entryPoint: "fs",
      targets: [{ format: FORMAT, blend: blend ? BLEND : undefined }] },
    primitive: { topology: "triangle-list" },
  });
}

export type ScenePipes = {
  sky: GPURenderPipeline; rect: GPURenderPipeline;
  poly: GPURenderPipeline; text: GPURenderPipeline;
};

export function buildScenePipes(device: GPUDevice): ScenePipes {
  return {
    sky: pipe(device, SCENE_SKY_SHADER, false),
    rect: pipe(device, SCENE_SHADER, true),
    poly: pipe(device, SCENE_POLY_SHADER, true),
    text: pipe(device, SCENE_TEXT_SHADER, true),
  };
}
