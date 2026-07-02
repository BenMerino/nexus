// Telemetry probes for the liquid engine (dev only — POSTs to the Vite
// middleware /__lg-telemetry, which writes files under apps/web/.lg-telemetry
// for offline inspection). Wired onto window.__kubeDebug by kube-debug.ts.
//
//   snap()    render EVERY live filter against a known checkerboard input and
//             send the PNGs — if an artifact is in the filter chain it will
//             reproduce on the probe where it can be seen offline.
//   report()  send environment + host/filter diagnostics as JSON.

const post = (name: string, body: { dataUrl?: string; json?: unknown }) =>
  fetch("/__lg-telemetry", { method: "POST", body: JSON.stringify({ name, ...body }) })
    .then((r) => (r.ok ? name : Promise.reject(r.status)));

// Rasterize one live <filter> applied to a checkerboard the size of its padded
// overlay. The filter (incl. its data-URL textures) is inlined so the SVG is
// fully self-contained — required for SVG-as-image rasterization.
function probeFilter(f: SVGElement): Promise<string> {
  const img = f.querySelector("feImage");
  const w = Number(img?.getAttribute("width") || 0);
  const h = Number(img?.getAttribute("height") || 0);
  const pad = Number(img?.getAttribute("x") || 0);
  const W = w + 2 * pad, H = h + 2 * pad;
  if (!w || !h) return Promise.reject(`no geometry on #${f.id}`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>${f.outerHTML}
      <pattern id="chk" width="24" height="24" patternUnits="userSpaceOnUse">
        <rect width="24" height="24" fill="#334"/>
        <rect width="12" height="12" fill="#dde"/>
        <rect x="12" y="12" width="12" height="12" fill="#dde"/>
        <line x1="0" y1="24" x2="24" y2="0" stroke="#e66" stroke-width="2"/>
      </pattern>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#chk)" filter="url(#${f.id})"/>
  </svg>`;
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const im = new Image();
    im.onload = () => {
      const c = document.createElement("canvas");
      c.width = W; c.height = H;
      c.getContext("2d")!.drawImage(im, 0, 0);
      URL.revokeObjectURL(url);
      try { res(c.toDataURL("image/png")); }
      catch (e) { rej(`canvas tainted for #${f.id}: ${e}`); }
    };
    im.onerror = () => { URL.revokeObjectURL(url); rej(`SVG probe failed to load for #${f.id}`); };
    im.src = url;
  });
}

export async function snap(): Promise<void> {
  const fs = [...document.querySelectorAll<SVGElement>('filter[id^="lgk-"]')];
  console.log(`snapping ${fs.length} filters…`);
  for (const f of fs) {
    try { await post(f.id, { dataUrl: await probeFilter(f) }); console.log("sent", f.id); }
    catch (e) { console.warn("probe failed:", e); await post(`${f.id}-FAILED`, { json: String(e) }); }
  }
  console.log("snap done → apps/web/.lg-telemetry/");
}

export async function report(hostRows: unknown): Promise<void> {
  await post("report", { json: {
    ua: navigator.userAgent,
    dpr: devicePixelRatio,
    cornerShape: CSS.supports("corner-shape: superellipse(1.5)"),
    attrs: {
      lg: document.documentElement.hasAttribute("data-lg"),
      liquid: document.documentElement.hasAttribute("data-lg-liquid"),
    },
    mode: localStorage.getItem("nexus.lg-glass.v2"),
    filters: [...document.querySelectorAll('filter[id^="lgk-"]')].map((f) => f.id),
    hosts: hostRows,
  }});
  console.log("report sent → apps/web/.lg-telemetry/");
}
