const { mergeAuthors } = require("./normalize-authors");
const { extractTags, canonicalize, pick } = require("./normalize-tags");

function normalize(doi, sources) {
  const { crossref: cr, openalex: oa, semanticScholar: ss, datacite: dc } = sources;
  const authors = mergeAuthors(cr?.authors, oa?.authors, ss?.authors, dc?.authors);

  return {
    doi,
    title: pick([cr?.title, oa?.title, ss?.title, dc?.title]),
    authors,
    authorNames: authors?.map((a) => a.name) || null,
    published: pick([oa?.published, cr?.published, ss?.year?.toString(), dc?.published?.toString()]),
    journal: pick([cr?.journal, oa?.journal, ss?.venue]),
    issnL: pick([oa?.issnL, cr?.issn]),
    publisher: pick([cr?.publisher, dc?.publisher]),
    type: pick([cr?.type, oa?.type, dc?.type]),
    citationCount: pick([oa?.citedByCount, ss?.citationCount]),
    openAccess: cr?.found ? null : null || oa?.openAccess || false,
    openAccessUrl: pick([oa?.oaUrl, ss?.openAccessPdf]),
    abstract: pick([ss?.abstract]),
    venue: pick([ss?.venue, oa?.journal, cr?.journal]),
    url: pick([cr?.url]),
  };
}

module.exports = { normalize, extractTags, canonicalize };
