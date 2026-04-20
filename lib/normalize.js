const { mergeAuthors } = require("./normalize-authors");
const { extractTags, canonicalize, pick } = require("./normalize-tags");
const { classifyVenue } = require("./venue-type");

function normalize(doi, sources) {
  const { crossref: cr, openalex: oa, semanticScholar: ss, datacite: dc } = sources;
  const authors = mergeAuthors(cr?.authors, oa?.authors, ss?.authors, dc?.authors);
  const journal = pick([cr?.journal, oa?.journal, ss?.venue]);
  const issnL = pick([oa?.issnL, cr?.issn]);
  const issns = Array.from(new Set([...(oa?.issns || []), issnL, cr?.issn].filter(Boolean)));
  const workType = pick([cr?.type, oa?.type, dc?.type]);
  const venueType = classifyVenue({
    openAlexSourceType: oa?.sourceType,
    issnL, journalName: journal, workType,
  });

  return {
    doi,
    title: pick([cr?.title, oa?.title, ss?.title, dc?.title]),
    authors,
    authorNames: authors?.map((a) => a.name) || null,
    published: pick([oa?.published, cr?.published, ss?.year?.toString(), dc?.published?.toString()]),
    journal,
    issnL,
    issns,
    venueType,
    publisher: pick([cr?.publisher, dc?.publisher]),
    type: workType,
    citationCount: pick([oa?.citedByCount, ss?.citationCount]),
    openAccess: cr?.found ? null : null || oa?.openAccess || false,
    openAccessUrl: pick([oa?.oaUrl, ss?.openAccessPdf]),
    abstract: pick([ss?.abstract]),
    venue: pick([ss?.venue, oa?.journal, cr?.journal]),
    url: pick([cr?.url]),
    countsByYear: oa?.countsByYear || [],
    concepts: oa?.concepts || [],
    indexedIn: oa?.indexedIn || [],
  };
}

module.exports = { normalize, extractTags, canonicalize };
