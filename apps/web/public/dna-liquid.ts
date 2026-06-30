// Liquid-glass entry point. The radial-gradient approximation that lived here
// was replaced by the faithful per-element Snell's-law refraction in liquid/ —
// this file now just self-mounts that host, preserving the existing
// `import './dna-liquid'` call sites (sky-bg.ts, dna-sky-scrub.tsx).
import "./liquid/liquid-glass";
