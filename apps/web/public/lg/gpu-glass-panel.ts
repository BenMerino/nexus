// Left-hand parameter panel for glass-gpu.html: form (size, corner, bezel,
// thickness, dome) and optics (IOR, background distance, frost, tint). Pure
// DOM built from a spec; every input forwards to GlassControl.set, which
// re-runs the render pass. Styles live in the page's <style> (.gpu-panel*).
import type { GlassControl, GlassParams } from "./gpu-glass-params";

type NumKey = { [K in keyof GlassParams]: GlassParams[K] extends number ? K : never }[keyof GlassParams];
type Slider = { key: NumKey; label: string; min: number; max: number; step: number };

const SECTIONS: Array<{ title: string; sliders: Slider[] }> = [
  { title: "form", sliders: [
    { key: "w", label: "width", min: 160, max: 900, step: 2 },
    { key: "h", label: "height", min: 120, max: 700, step: 2 },
    { key: "radius", label: "corner", min: 0, max: 80, step: 1 },
    { key: "bezel", label: "bezel", min: 1, max: 60, step: 1 },
    { key: "thick", label: "thickness", min: 2, max: 80, step: 1 },
    { key: "dome", label: "dome", min: 0, max: 16, step: 0.5 },
  ] },
  { title: "optics", sliders: [
    { key: "ior", label: "ior", min: 1, max: 2.4, step: 0.01 },
    { key: "dispersion", label: "dispersion", min: 0, max: 0.04, step: 0.001 },
    { key: "gap", label: "bg distance", min: 0, max: 200, step: 2 },
    { key: "frost", label: "frost", min: 0, max: 1, step: 0.01 },
    { key: "tintStrength", label: "tint", min: 0, max: 1, step: 0.01 },
  ] },
];

const fmt = (v: number, step: number) =>
  step >= 1 ? String(Math.round(v)) : v.toFixed(step >= 0.01 ? 2 : 3);

function el(tag: string, cls: string, text?: string): HTMLElement {
  const n = document.createElement(tag);
  n.className = cls;
  if (text) n.textContent = text;
  return n;
}

function sliderRow(glass: GlassControl, s: Slider): HTMLElement {
  const row = el("label", "gpu-panel-row");
  const input = document.createElement("input");
  input.type = "range";
  input.min = String(s.min);
  input.max = String(s.max);
  input.step = String(s.step);
  input.value = String(glass.params[s.key]);
  const val = el("span", "gpu-panel-val", fmt(glass.params[s.key], s.step));
  input.addEventListener("input", () => {
    glass.set({ [s.key]: Number(input.value) } as Partial<GlassParams>);
    val.textContent = fmt(Number(input.value), s.step);
  });
  row.append(el("span", "", s.label), input, val);
  return row;
}

function tintRow(glass: GlassControl): HTMLElement {
  const row = el("label", "gpu-panel-row");
  const input = document.createElement("input");
  input.type = "color";
  input.value = glass.params.tint;
  input.addEventListener("input", () => glass.set({ tint: input.value }));
  row.append(el("span", "", "tint color"), input, el("span", "gpu-panel-val"));
  return row;
}

export function mountGlassPanel(host: HTMLElement, glass: GlassControl): void {
  host.append(el("div", "gpu-panel-title", "glass parameters"));
  for (const sec of SECTIONS) {
    host.append(el("div", "gpu-panel-sec", sec.title));
    for (const s of sec.sliders) host.append(sliderRow(glass, s));
    if (sec.title === "optics") host.append(tintRow(glass));
  }
}
