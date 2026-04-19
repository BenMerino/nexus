const synonyms = {
  type: {
    "journal-article": "journal-article",
    "article": "journal-article",
    "JournalArticle": "journal-article",
    "proceedings-article": "conference-paper",
    "conference-paper": "conference-paper",
    "ConferencePaper": "conference-paper",
    "book-chapter": "book-chapter",
    "BookChapter": "book-chapter",
    "book": "book",
    "Book": "book",
    "dataset": "dataset",
    "Dataset": "dataset",
    "preprint": "preprint",
    "posted-content": "preprint",
  },
};

function extractTags(record) {
  const tags = [];
  if (record.authors) {
    for (const a of record.authors) {
      // Only tag authors with ORCID — canonical ID required
      if (a.orcid) tags.push({ category: "author", value: a.name || a, ext_id: a.orcid });
      if (a.affiliations) {
        for (const aff of a.affiliations) {
          // Only store institutions from OpenAlex (has ROR = real institution)
          if (typeof aff === "object" && aff.ror && aff.name) {
            tags.push({ category: "institution", value: aff.name, ext_id: aff.ror });
          }
        }
      }
    }
  }
  // Only tag journals when the venue is canonically a journal (ISSN-L + OpenAlex source.type),
  // not a preprint repository like SSRN or arXiv that happens to carry an ISSN.
  if (record.journal && record.issnL && record.venueType === "journal") {
    tags.push({ category: "journal", value: record.journal, ext_id: record.issnL });
  } else if (record.journal && record.venueType === "repository") {
    tags.push({ category: "repository", value: record.journal, ext_id: record.issnL || null });
  }
  // publisher, type, venue, year, source are properties on doi_records — filters, not tags
  return tags;
}

function canonicalize(category, value) {
  if (synonyms[category] && synonyms[category][value]) return synonyms[category][value];
  return value;
}

function pick(values) {
  for (const v of values) {
    if (v != null && v !== "" && v !== undefined) return v;
  }
  return null;
}

module.exports = { extractTags, canonicalize, pick };
