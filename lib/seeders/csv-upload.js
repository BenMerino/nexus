const { extractEntries, replaceIndex } = require("../indexed-journals");

function makeCsvSeeder(sourceId) {
  return async function seed({ csv }) {
    if (!csv) throw new Error(`${sourceId} requires a CSV upload`);
    const entries = extractEntries(csv);
    if (!entries.length) throw new Error("No ISSN-bearing rows found");
    const imported = await replaceIndex(sourceId, entries);
    return { count: imported.count };
  };
}

module.exports = { makeCsvSeeder };
