// Real liquid-dom glass mount — only invoked by the gate on a supporting browser
// (WebGPU + HTML-in-Canvas). Renders a liquid-dom LiquidCanvas glass layer fixed
// over the page; where this runs, CSS hides our SVG glass on the same surfaces
// (data-liquid-dom) so liquid-dom's GPU-shader refraction governs instead. On any
// unsupported browser this module is never loaded (the 1.2 MB core stays off).

import React from "react";
import { createRoot } from "react-dom/client";
import { LiquidCanvas, GlassContainer, Glass, Html } from "@liquid-dom/react";

/* The liquid-dom glass overlay. A fixed full-viewport LiquidCanvas; the
   GlassContainer carries liquid-dom's material params (refraction/IOR/specular —
   the advanced lens model). The Html node sizes to fill so the page content
   shows through, refracted by the GPU shader. */
function LiquidGlassLayer() {
  return (
    <LiquidCanvas
      style={{ position: "fixed", inset: 0, zIndex: 5, pointerEvents: "none" }}
      frameloop="demand"
    >
      <GlassContainer
        blur={10}
        bezelWidth={9}
        thickness={120}
        ior={1.46}
        specularStrength={0.6}
        surfaceProfile="convexCircle"
        lightDirection={-150}
      >
        <Glass cornerRadius={18} cornerSmoothing={0.6}>
          <Html sizing="fill"><div style={{ width: "100%", height: "100%" }} /></Html>
        </Glass>
      </GlassContainer>
    </LiquidCanvas>
  );
}

let mounted = false;

export async function mountLiquidGlass(): Promise<void> {
  if (mounted) return;
  mounted = true;
  const host = document.createElement("div");
  host.id = "liquid-dom-root";
  host.setAttribute("aria-hidden", "true");
  document.body.appendChild(host);
  createRoot(host).render(<LiquidGlassLayer />);
}
