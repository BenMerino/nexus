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
  /** Optional — the Z elevation for this node. Nodes on different layers
   *  stratify vertically when the camera is tilted. Defaults to 0. */
  getLayerZ?(n: N): number;
  /** Optional — short all-caps type tag rendered above the node label
   *  (AUTHOR, JOURNAL, INSTITUTION, PAPER). Returning null hides the tag. */
  getTypeTag?(n: N): string | null;
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
  /** Fraction of min(width, height) used as the community-anchor orbit radius. */
  orbitRadius: number;
  /** Per-node target Z pull strength toward adapter.getLayerZ(n). */
  layerStrength: number;
}

export const DEFAULT_FORCE_CONFIG: ForceConfig = {
  linkDistance: 25,
  linkStrength: 0.1,
  charge: -40,
  clusterStrengthX: 0.4,
  clusterStrengthY: 0.45,
  collidePad: 3,
  minCommunitySize: 3,
  orbitRadius: 0.38,
  layerStrength: 0.12,
};
