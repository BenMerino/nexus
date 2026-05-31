function doctorReason(grado, pubs, ir) {
  if (grado !== "Doctor") return "Requires a Doctorate degree";
  if (pubs < 5) return `Requires ≥5 indexed publications (has ${pubs})`;
  if (ir < 1) return "Requires ≥1 external competitive PI project in the last 5 years";
  return null;
}

function magAcadReason(hasMagOrDoc, pubs, any) {
  if (!hasMagOrDoc) return "Requires a Master's or Doctorate degree";
  if (pubs < 2) return `Requires ≥2 indexed publications (has ${pubs})`;
  if (any < 1) return "Requires ≥1 competitive project in the last 5 years";
  return null;
}

function magProfReason(hasMagOrDoc, pubs) {
  if (!hasMagOrDoc) return "Requires a Master's or Doctorate degree";
  if (pubs < 1) return "Requires ≥1 indexed publication in the last 5 years (Alt. A)";
  return null;
}

module.exports = { doctorReason, magAcadReason, magProfReason };
