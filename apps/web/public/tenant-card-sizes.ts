// ONE source of truth for each overview card's reserved BODY height (the space
// below the panel head). The real card and its skeleton both reserve exactly
// this, so a card is its final size from first paint — content renders INTO a
// pre-sized box and never grows it. No load-time reflow, so nothing to animate
// or debounce: the layout is stable by construction.
//
// Values are the measured settled body heights (settled card − ~90px head+pad),
// rounded up a little so real content fits without overflow. If a card's real
// content is shorter, the reserved height simply leaves a little slack — a
// deliberate trade for zero reflow (the alternative, growing to fit, is the
// jerk we're removing).
export const CARD_BODY = {
  contributors: 280,   // ranking list
  velocity: 360,       // area chart
  researchAreas: 300,  // bar chart
  yearPanel: 360,      // merged year panel
  journals: 400,       // ranked list
  collaborators: 400,  // ranked list
  countriesMap: 380,   // choropleth (2:1, sizes itself but reserve a floor)
  works: 380,          // most-cited / recent lists
} as const;

// Per chart-kind body height (for BatchedCharts minHeight lookups).
export const KIND_BODY: Record<string, number> = {
  'publications.velocity': CARD_BODY.velocity,
  'publications.researchAreas': CARD_BODY.researchAreas,
  'publications.topJournals': CARD_BODY.journals,
  'publications.collaborators': CARD_BODY.collaborators,
  'publications.countriesMap': CARD_BODY.countriesMap,
};
