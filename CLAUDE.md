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

## Behavioral Guidelines

### 1. Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.
- Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

Touch only what you must. Clean up only your own mess.

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

Define success criteria. Loop until verified.

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## Project Rules

### Rule nbr15: File Size & Commit Audit

Pre-commit hook at `hooks/pre-commit-audit.sh` blocks commits containing source files over 150 lines.
