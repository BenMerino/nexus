// Canonical venue classification.
// Priority: OpenAlex source.type (authoritative, ISSN-registry-backed)
//   → known repository fallback table → work-type inference → "other".

const KNOWN_REPOSITORIES = {
  "1556-5068": "ssrn",                  // SSRN Electronic Journal
  "2693-5015": "researchsquare",        // Research Square
  "2167-9843": "peerj-preprints",
};

const REPOSITORY_NAME_PATTERNS = [
  /\bssrn\b/i,
  /\barxiv\b/i,
  /\bbiorxiv\b/i,
  /\bmedrxiv\b/i,
  /\bchemrxiv\b/i,
  /research\s*square/i,
  /preprints?\.org/i,
  /\bzenodo\b/i,
  /\bosf\b/i,
  /\bhal\b.*archives/i,
  /\brepec\b/i,
];

const ARTICLE_WORK_TYPES = new Set([
  "journal-article", "article", "JournalArticle",
]);

const PREPRINT_WORK_TYPES = new Set([
  "posted-content", "preprint", "Preprint",
]);

// Maps an OpenAlex source.type to our canonical venue type.
function fromOpenAlexSourceType(sourceType) {
  if (!sourceType) return null;
  const map = {
    "journal": "journal",
    "repository": "repository",
    "conference": "conference",
    "book series": "book-series",
    "ebook platform": "book",
    "metadata": null,
  };
  return map[sourceType] ?? "other";
}

function fromKnownRepository(issnL, journalName) {
  if (issnL && KNOWN_REPOSITORIES[issnL]) return "repository";
  if (journalName) {
    for (const pattern of REPOSITORY_NAME_PATTERNS) {
      if (pattern.test(journalName)) return "repository";
    }
  }
  return null;
}

function fromWorkType(workType) {
  if (!workType) return null;
  if (PREPRINT_WORK_TYPES.has(workType)) return "repository";
  if (workType === "proceedings-article" || workType === "ConferencePaper") return "conference";
  if (workType === "book-chapter" || workType === "BookChapter" || workType === "book" || workType === "Book") return "book";
  if (workType === "dataset" || workType === "Dataset") return "dataset";
  if (workType === "report" || workType === "report-component") return "report";
  if (ARTICLE_WORK_TYPES.has(workType)) return null;
  return null;
}

// Returns one of: journal, repository, conference, book, book-series,
// dataset, report, other, or null when no venue is associated.
function classifyVenue({ openAlexSourceType, issnL, journalName, workType }) {
  const fromKnown = fromKnownRepository(issnL, journalName);
  if (fromKnown) return fromKnown;
  const fromOA = fromOpenAlexSourceType(openAlexSourceType);
  if (fromOA) return fromOA;
  const fromWork = fromWorkType(workType);
  if (fromWork) return fromWork;
  if (journalName && issnL) return "journal";
  if (journalName) return "other";
  return null;
}

module.exports = { classifyVenue };
