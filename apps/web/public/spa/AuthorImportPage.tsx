// Author-import page (/author-import). The .view body that lived in
// author-import.html, ported to React Router. The legacy author-import.js
// entry owns the search/select/import logic and binds inline onclick handlers
// via window.* (searchAuthor / pickSuggestion / selectAuthor / importDois);
// this page provides the exact markup + drives its (re)mount on every route
// entry via the legacy-mount bridge. Rendered as a raw-HTML block so the
// inline onclick="searchAuthor()" attribute keeps working. No page-specific
// <style> — the .html carried none (chrome + tokens come from shared.css).

import React from 'react';
import { useLegacyMounts } from './legacy-mount';

// Exact inner markup of the old author-import.html <main> .view block. Every
// id (#author-search, #suggestions, #status, #results) and the inline
// onclick="searchAuthor()" are preserved verbatim so author-import.js binds.
const BODY = `
  <header class="view-head">
    <div>
      <h1 class="view-title">Author import</h1>
    </div>
  </header>

  <div class="card">
    <label class="form-label">Author name</label>
    <div class="flex gap-8">
      <input id="author-search" class="doi-input" type="text" placeholder="e.g. Albert Einstein" style="flex: 1;">
      <button class="primary-btn" onclick="searchAuthor()">Search</button>
    </div>
  </div>

  <div id="suggestions" class="mt-16"></div>
  <div id="status" class="mt-8"></div>
  <div id="results" class="mt-16"></div>
`;

export function AuthorImportPage() {
  useLegacyMounts([() => import('../author-import.js' as string)]);
  return <div className="view" dangerouslySetInnerHTML={{ __html: BODY }} />;
}
