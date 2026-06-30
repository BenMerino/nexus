// Physically-derived liquid-glass refraction — the kube.io / ObaidQatan math,
// ported faithfully (Snell's law through a beveled glass surface), NOT the
// radial-gradient approximation. Pure functions, no DOM — see refraction-map.ts
// for the pixel-buffer fill and liquid-glass.ts for the per-element host.
//
// Model (1D bevel cross-section, x∈[0,1], 0 = outer edge, 1 = flat interior):
//   1. surface height f(x)         — the bevel profile
//   2. slope s = f'(x)             — central difference
//   3. normal N = norm(-s·T, 1)    — air→glass interface, T = thickness scale
//   4. incident ray straight down  → sinθ₁ = N.x, cosθ₁ = N.y
//   5. Snell: sinθ₂ = (n1/n2)·sinθ₁ → θ₂ = asin(…)
//   6. lateral bend = tan(θ₁−θ₂), directed outward along the radius
// The 1D magnitude profile is then rotated around the centre to fill the 2D map.

export type Profile = "convex" | "squircle" | "concave" | "lip";

const N1 = 1.0; // air
const N2 = 1.5; // glass

const convex = (x: number) => Math.sqrt(Math.max(0, 1 - (1 - x) ** 2));
const squircle = (x: number) => Math.pow(Math.max(0, 1 - (1 - x) ** 4), 0.25);
const concave = (x: number) => 1 - convex(x);
const smootherstep = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);
const lip = (x: number) => {
  const t = smootherstep(Math.min(1, Math.max(0, x)));
  return convex(x) * (1 - t) + concave(x) * t;
};

function heightFn(profile: Profile): (x: number) => number {
  return profile === "squircle" ? squircle
    : profile === "concave" ? concave
    : profile === "lip" ? lip
    : convex;
}

// Per-radius lateral displacement magnitude (signed; >0 = outward). thickness
// scales the bevel's physical height → steeper normals → stronger refraction.
export function displacementAt(
  x: number,
  profile: Profile,
  thickness: number,
): number {
  const f = heightFn(profile);
  const delta = 0.001;
  const slope = (f(x + delta) - f(x - delta)) / (2 * delta);
  // Surface normal of the air→glass interface (tangent (1, slope·T) → normal).
  const nx = -slope * thickness;
  const ny = 1;
  const len = Math.hypot(nx, ny) || 1;
  const sinT1 = Math.abs(nx) / len; // |horizontal component| of the unit normal
  const sign = nx >= 0 ? 1 : -1; // bend direction (outward vs inward along radius)
  const t1 = Math.asin(Math.min(1, sinT1));
  const sinT2 = (N1 / N2) * sinT1;
  const t2 = Math.asin(Math.min(1, sinT2));
  // Lateral offset the ray picks up bending toward the normal by (θ1−θ2).
  return sign * Math.tan(t1 - t2);
}

// Sample the 1D bevel profile across `samples` points (0 = edge → 1 = interior),
// returning the RAW signed magnitudes (un-normalized; the caller finds the max).
export function sampleProfile(
  profile: Profile,
  thickness: number,
  samples: number,
): number[] {
  const out: number[] = new Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = samples === 1 ? 1 : i / (samples - 1);
    out[i] = displacementAt(x, profile, thickness);
  }
  return out;
}
