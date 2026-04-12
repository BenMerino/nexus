const { getAuthorHIndexes } = require("./h-index");

function buildProfile(user, tenant) {
  return {
    name: user.full_name, position: user.position,
    faculty: user.faculty, affiliation: tenant?.name,
    titles: user.titles ? JSON.parse(user.titles) : [],
  };
}

function computeHIndex(user, records) {
  if (!user.full_name) return null;
  const authors = getAuthorHIndexes(records);
  const norm = s => s.toLowerCase().replace(/[-]/g, " ").trim();
  const surname = norm(user.full_name).split(" ").pop();
  const firstName = user.full_name.split(" ")[0].toLowerCase();
  const match = authors.find(a =>
    norm(a.author) === norm(user.full_name) ||
    (a.author.toLowerCase().includes(surname) && a.author.toLowerCase().includes(firstName))
  );
  return match ? match.hIndex : null;
}

module.exports = { buildProfile, computeHIndex };
