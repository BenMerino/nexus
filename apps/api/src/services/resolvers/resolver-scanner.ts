/* ── Resolver Scanner ──────────────────────────────────────────
 * Auto-discovers every `{Domain}ResolverTools.ts` and registers its
 * exported `resolverTools: ResolverManifest[]`. CJS-flavored port of
 * Zincro's scanner; runs after conversation-bindings at bootstrap.
 * Empty until domains add manifests.
 * ──────────────────────────────────────────────────────────── */

import { readdirSync, statSync } from "fs";
import { resolve } from "path";
import type { ResolverManifest } from "./resolver.types";

const SERVICES_DIR = resolve(__dirname, "..");
const registry = new Map<string, ResolverManifest>();

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === "__tests__" || entry === "resolvers") continue;
      out.push(...walk(full));
    } else if (entry.endsWith("ResolverTools.js")) {
      out.push(full);
    }
  }
  return out;
}

/** Scan + register all resolver manifests. Call once at bootstrap. */
export function scanResolvers(): void {
  const files = walk(SERVICES_DIR);
  for (const file of files) {
    try {
      const mod = require(file);
      const manifests: ResolverManifest[] = mod.resolverTools || [];
      for (const tool of manifests) {
        if (registry.has(tool.name)) {
          console.warn(`[ResolverScanner] Duplicate resolver: ${tool.name} — skipping`);
          continue;
        }
        registry.set(tool.name, tool);
      }
    } catch (err: any) {
      console.error(`[ResolverScanner] Failed to load ${file}: ${err.message}`);
    }
  }
  console.log(`[ResolverScanner] Discovered ${registry.size} resolvers from ${files.length} files`);
}

export function getAllResolvers(): ResolverManifest[] {
  return Array.from(registry.values());
}

export function getResolver(name: string): ResolverManifest | undefined {
  return registry.get(name);
}
