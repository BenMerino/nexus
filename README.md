# Nexus

A multi-tenant CRIS (Current Research Information System) for universities. Nexus aggregates DOI metadata from CrossRef, OpenAlex, Semantic Scholar, and DataCite, then surfaces it as interactive graphs, paper lists, and dashboards per researcher and per institution. First tenant is Universidad de Talca.

## Commands

```sh
vercel dev       # local dev server
node build.js    # bundle React entries (run after tsx/ts changes)
```

No test suite.

## Where to look

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — cross-cutting invariants: data model, scope + role model, auth flow, bundle map.
- **[lib/README.md](lib/README.md)** — data pipeline conventions.

## Stack

- Backend: Vercel serverless functions (`api/`)
- Database: Neon PostgreSQL (`@vercel/postgres`)
- Frontend: HTML + React (TSX, bundled by esbuild)
- Graph viz: D3
