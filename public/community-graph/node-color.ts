import { effectiveKey, OTHER_KEY } from './communities';
import type { CommunityAdapter } from './types';

/** Resolve the rendered fill for one node: ego → accent, else community color
 *  with the adapter's override taking final say. Extracted so CommunityGraph
 *  stays focused on orchestration. */
export function resolveNodeColor<N>(
  n: N,
  adapter: CommunityAdapter<N>,
  communityColors: Map<string, string>,
  major: Set<string>,
): string {
  let communityColor: string | null = null;
  if (adapter.isEgo(n)) {
    communityColor = 'var(--accent)';
  } else {
    const key = effectiveKey(n, adapter, major);
    if (key === OTHER_KEY) communityColor = communityColors.get(OTHER_KEY) || '#b0b0b0';
    else if (key) communityColor = communityColors.get(key) || null;
  }
  const override = adapter.getNodeColor?.(n, communityColor);
  if (override) return override;
  return communityColor || 'var(--fg-muted)';
}
