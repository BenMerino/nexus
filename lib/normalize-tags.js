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
      tags.push({ category: "author", value: a.name || a });
      if (a.affiliations) {
        for (const aff of a.affiliations) {
          const name = typeof aff === "string" ? aff : aff.name;
          if (name) tags.push({ category: "institution", value: name });
        }
      }
    }
  }
  if (record.journal) tags.push({ category: "journal", value: record.journal });
  if (record.publisher) tags.push({ category: "publisher", value: record.publisher });
  if (record.type) tags.push({ category: "type", value: record.type });
  if (record.venue && record.venue !== record.journal) {
    tags.push({ category: "venue", value: record.venue });
  }
  if (record.published) {
    const year = record.published.substring(0, 4);
    if (/^\d{4}$/.test(year)) tags.push({ category: "year", value: year });
  }
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
