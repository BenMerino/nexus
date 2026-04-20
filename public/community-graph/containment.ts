import type { CommunityAdapter } from './types';
import { majorCommunities, effectiveKey } from './communities';

interface SimNode { x: number; y: number; vx: number; vy: number }

/** A d3-force that keeps each community's members inside a soft radial
 *  boundary around the community's live centroid. Dominant over links:
 *  once a node reaches the perimeter, the boundary pulls harder than any
 *  link tugging it outward, so communities stay visibly apart.
 *
 *  Each tick: compute centroid per community, compute a radius as
 *  median-distance × radiusMultiplier, then for every node beyond that
 *  radius apply a velocity delta proportional to (dist − radius) × strength. */
export function forceCommunityContainment<N>(
  adapter: CommunityAdapter<N>,
  primaryKey: string | null,
  minSize: number,
  strength: number,
  radiusMultiplier: number,
) {
  let simNodes: (SimNode & N)[] = [];

  function force() {
    if (simNodes.length === 0) return;
    const major = majorCommunities(simNodes, adapter, primaryKey, minSize);

    // Group nodes by their effective community key.
    const groups = new Map<string, (SimNode & N)[]>();
    for (const n of simNodes) {
      if (adapter.isEgo(n)) continue;
      const key = effectiveKey(n, adapter, major);
      if (!key) continue;
      const list = groups.get(key);
      if (list) list.push(n);
      else groups.set(key, [n]);
    }

    for (const members of groups.values()) {
      if (members.length < 2) continue;

      // Centroid.
      let cx = 0, cy = 0;
      for (const n of members) { cx += n.x; cy += n.y; }
      cx /= members.length; cy /= members.length;

      // Radius = median distance × multiplier, so the boundary hugs the
      // actual cluster shape instead of a hardcoded size.
      const dists = members.map(n => Math.hypot(n.x - cx, n.y - cy));
      dists.sort((a, b) => a - b);
      const median = dists[Math.floor(dists.length / 2)] || 1;
      const radius = median * radiusMultiplier;

      for (const n of members) {
        const dx = n.x - cx;
        const dy = n.y - cy;
        const d = Math.hypot(dx, dy);
        if (d <= radius) continue;
        const overshoot = d - radius;
        // Pull toward centroid proportionally to how far past the boundary.
        const pull = (overshoot / d) * strength;
        n.vx -= dx * pull;
        n.vy -= dy * pull;
      }
    }
  }

  force.initialize = (nodes: (SimNode & N)[]) => { simNodes = nodes; };
  return force;
}
