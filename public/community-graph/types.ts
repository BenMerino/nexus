export interface CommunityAdapter<N> {
  getId(n: N): string;
  getLabel(n: N): string;
  getRadius(n: N): number;
  /** Community grouping key. Null = node has no community (e.g. ego or unclassified). */
  getCommunityKey(n: N): string | null;
  /** Ego nodes are pinned to center and get emphasis in their hull. */
  isEgo(n: N): boolean;
  /** Optional — override the color the community palette would assign. Return null to keep the community color. */
  getNodeColor?(n: N, communityColor: string | null): string | null;
  /** Optional — tooltip line 2 (subtitle, usually affiliation or institution name). */
  getHoverSubtitle?(n: N): string | null;
  /** Optional — tooltip line 3 (footnote, usually a small mono-font fact). */
  getHoverFootnote?(n: N): string | null;
  /** Optional — human label for a community key (for the legend). */
  getCommunityLabel?(key: string, sampleNode: N): string;
}

export interface ForceConfig {
  linkDistance: number;
  linkStrength: number;
  charge: number | ((group: string | undefined) => number);
  clusterStrengthX: number;
  clusterStrengthY: number;
  collidePad: number;
  /** Minimum number of members for a grouping key to earn its own community. */
  minCommunitySize: number;
}

export const DEFAULT_FORCE_CONFIG: ForceConfig = {
  linkDistance: 25,
  linkStrength: 0.1,
  charge: -40,
  clusterStrengthX: 0.4,
  clusterStrengthY: 0.45,
  collidePad: 3,
  minCommunitySize: 3,
};
