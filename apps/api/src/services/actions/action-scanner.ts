/* ── Action Scanner ────────────────────────────────────────────
 * Auto-discovers every `{Domain}Actions.ts` in the services tree at
 * boot and registers its exported `actions: ActionManifest[]` by name.
 * CJS-flavored port of Zincro's scanner: synchronous walk + `require`
 * of the COMPILED output (runs from dist/src/services/), since the app
 * runs `node dist/index.js`. Empty until domains add manifests.
 * ──────────────────────────────────────────────────────────── */

import { readdirSync, statSync } from "fs";
import { resolve } from "path";
import type { ActionManifest } from "./action.types";

const SERVICES_DIR = resolve(__dirname, "..");
const registry = new Map<string, ActionManifest>();

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === "__tests__" || entry === "actions") continue;
      out.push(...walk(full));
    } else if (entry.endsWith("Actions.js")) {
      out.push(full);
    }
  }
  return out;
}

/** Scan + register all action manifests. Call once at bootstrap. */
export function scanActions(): void {
  const files = walk(SERVICES_DIR);
  for (const file of files) {
    try {
      const mod = require(file);
      const manifests: ActionManifest[] = mod.actions || [];
      for (const action of manifests) {
        if (registry.has(action.name)) {
          console.warn(`[ActionScanner] Duplicate action: ${action.name} — skipping`);
          continue;
        }
        registry.set(action.name, action);
      }
    } catch (err: any) {
      console.error(`[ActionScanner] Failed to load ${file}: ${err.message}`);
    }
  }
  console.log(`[ActionScanner] Discovered ${registry.size} actions from ${files.length} files`);
}

export function getAllActions(): ActionManifest[] {
  return Array.from(registry.values());
}

export function getAction(name: string): ActionManifest | undefined {
  return registry.get(name);
}
