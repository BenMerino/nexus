// Glass surfaces use plain blur (the .surface recipe in dna-bridge.css) by
// default. This module sets the data-liquid flag and self-mounts the vendored
// liquid-glass-component-library A/B toggle (lg-glass.ts) so window.__lgGlass()
// works platform-wide. Preserves the `import './dna-liquid'` call site.
import "./lg-glass";
document.documentElement.setAttribute("data-liquid", "");
