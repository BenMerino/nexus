function doctorReason(grado, pubs, ir) {
  if (grado !== "Doctor") return "Requiere grado de Doctor";
  if (pubs < 5) return `Requiere ≥5 publicaciones indexadas (tiene ${pubs})`;
  if (ir < 1) return "Requiere ≥1 proyecto IR concursable externo en últimos 5 años";
  return null;
}

function magAcadReason(hasMagOrDoc, pubs, any) {
  if (!hasMagOrDoc) return "Requiere grado de Magíster o Doctor";
  if (pubs < 2) return `Requiere ≥2 publicaciones indexadas (tiene ${pubs})`;
  if (any < 1) return "Requiere ≥1 proyecto concursable en últimos 5 años";
  return null;
}

function magProfReason(hasMagOrDoc, pubs) {
  if (!hasMagOrDoc) return "Requiere grado de Magíster o Doctor";
  if (pubs < 1) return "Requiere ≥1 publicación indexada en últimos 5 años (Alt A)";
  return null;
}

module.exports = { doctorReason, magAcadReason, magProfReason };
