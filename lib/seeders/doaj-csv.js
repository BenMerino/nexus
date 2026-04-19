const { extractEntries, replaceIndex } = require("../indexed-journals");

const URL = "https://doaj.org/csv";

async function seed() {
  const resp = await fetch(URL, {
    headers: { "User-Agent": "Nexus/1.0 (mailto:dev@example.com)" },
    redirect: "follow",
  });
  if (!resp.ok) throw new Error(`DOAJ ${resp.status}`);
  const csv = await resp.text();
  const entries = extractEntries(csv);
  if (!entries.length) throw new Error("DOAJ CSV yielded no ISSNs");
  const imported = await replaceIndex("DOAJ", entries);
  return { count: imported.count };
}

module.exports = { seed };
