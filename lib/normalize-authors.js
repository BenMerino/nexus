function mergeAuthors(...authorLists) {
  const byName = new Map();

  for (const list of authorLists) {
    if (!list) continue;
    for (const author of list) {
      if (!author?.name) continue;
      const key = author.name.toLowerCase().trim();
      if (!byName.has(key)) {
        byName.set(key, { name: author.name, orcid: null, affiliations: [] });
      }
      const entry = byName.get(key);
      if (author.orcid) entry.orcid = author.orcid;

      if (author.affiliations) {
        for (const aff of author.affiliations) {
          const affName = typeof aff === "string" ? aff : aff.name;
          if (!affName) continue;
          const exists = entry.affiliations.some(
            (a) => a.name.toLowerCase() === affName.toLowerCase()
          );
          if (!exists) {
            if (typeof aff === "string") {
              entry.affiliations.push({ name: aff });
            } else {
              entry.affiliations.push({
                name: aff.name,
                ...(aff.ror && { ror: aff.ror }),
                ...(aff.country && { country: aff.country }),
                ...(aff.type && { type: aff.type }),
              });
            }
          }
        }
      }
    }
  }

  if (byName.size === 0) return null;
  return Array.from(byName.values());
}

module.exports = { mergeAuthors };
