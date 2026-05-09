export type TypeMetal = { token: string; name: string; rank: number };

export const TYPE_METAL: Record<string, TypeMetal> = {
  'journal-article':  { token: '--metal-18k-gold',    name: '18k Gold',    rank: 1 },
  'review':           { token: '--metal-platinum',    name: 'Platinum',    rank: 2 },
  'conference-paper': { token: '--metal-silver',      name: 'Silver',      rank: 3 },
  'book-chapter':     { token: '--metal-gold-plated', name: 'Gold-plated', rank: 4 },
  'book':             { token: '--metal-rose-gold',   name: 'Rose Gold',   rank: 5 },
  'preprint':         { token: '--metal-bronze',      name: 'Bronze',      rank: 6 },
  'dataset':          { token: '--metal-copper',      name: 'Copper',      rank: 7 },
  'editorial':        { token: '--metal-tin',         name: 'Tin',         rank: 8 },
  'letter':           { token: '--metal-nickel',      name: 'Nickel',      rank: 9 },
  'erratum':          { token: '--metal-lead',        name: 'Lead',        rank: 10 },
  'paratext':         { token: '--metal-zinc',        name: 'Zinc',        rank: 11 },
  'peer-review':      { token: '--metal-rust',        name: 'Rust',        rank: 12 },
};

export const typeColor = (t: string) => `var(${TYPE_METAL[t]?.token || '--metal-unknown'})`;
export const typeRank = (t: string) => TYPE_METAL[t]?.rank ?? 99;
export const typeMetalName = (t: string) => TYPE_METAL[t]?.name || '';
