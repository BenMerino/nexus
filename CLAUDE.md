# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Dev server:** `vercel dev` (or `npm run dev`)
- **Build:** `node build.js` (bundles React components via esbuild)
- **No test suite configured.**

## Architecture

Nexus is a DOI metadata aggregator and relationship explorer. Users submit DOIs, the system fetches metadata from four scholarly APIs (CrossRef, OpenAlex, Semantic Scholar, DataCite), normalizes/merges the results, stores them in PostgreSQL, and provides interactive graph and chart visualizations.

**Backend:** Vercel serverless functions in `api/`. Each file is one route (e.g., `api/submit.js`, `api/graph.js`, `api/records/[id].js`).

**Database:** Neon PostgreSQL via `@vercel/postgres`. Schema and queries live in `lib/db.js`. Three tables: `submissions`, `doi_records`, `tags`.

**Data pipeline:** `lib/fetchers.js` fetches from all four sources in parallel (Promise.allSettled). `lib/normalize.js` merges using first-non-null priority. `lib/normalize-authors.js` deduplicates authors across sources. `lib/normalize-tags.js` extracts tag categories (author, journal, publisher, type, institution, venue, year).

**Frontend:** Vanilla HTML pages (`public/index.html`, `records.html`, `explore.html`) with two React bundles built by esbuild:
- `charts-bundle.js` from `public/charts.tsx` — bar, donut, line charts of metadata
- `relationships-bundle.js` from `public/relationships.tsx` — D3 force-directed graph explorer with category strips, tag filtering, and detail panels

**Graph engine:** `graph-engine/` contains D3-powered visualization modules — rendering (cartesian, grid, radial, polar), force simulation, color scales, legends, and drag controls.

**Build:** `build.js` uses esbuild with a custom shim plugin to bundle the two React entry points into `public/`.

## Project Rules

### Rule nbr15: File Size & Commit Audit

1. **No file over 150 lines.** If any source file exceeds 150 lines, refactor it before committing (split into modules, extract helpers, etc.).
2. **Pre-commit audit.** Run the line-count audit hook before every commit to catch violations. The hook is at `hooks/pre-commit-audit.sh`.
