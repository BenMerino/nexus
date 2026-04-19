/** Returns an SVG path for the given group shape, or null for circles (use <circle>). */
export function shapePath(group: string, cx: number, cy: number, r: number): string | null {
  switch (group) {
    case 'institution': {
      // Diamond
      return `M ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} L ${cx - r} ${cy} Z`;
    }
    case 'author': {
      // Hexagon
      const pts: string[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        pts.push(`${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`);
      }
      return `M ${pts[0]} L ${pts.slice(1).join(' L ')} Z`;
    }
    case 'doi': {
      // Rounded square
      const h = r * 0.8;
      const rr = r * 0.2;
      return [
        `M ${cx - h + rr} ${cy - h}`,
        `L ${cx + h - rr} ${cy - h} Q ${cx + h} ${cy - h} ${cx + h} ${cy - h + rr}`,
        `L ${cx + h} ${cy + h - rr} Q ${cx + h} ${cy + h} ${cx + h - rr} ${cy + h}`,
        `L ${cx - h + rr} ${cy + h} Q ${cx - h} ${cy + h} ${cx - h} ${cy + h - rr}`,
        `L ${cx - h} ${cy - h + rr} Q ${cx - h} ${cy - h} ${cx - h + rr} ${cy - h}`,
        'Z',
      ].join(' ');
    }
    default:
      return null;
  }
}
