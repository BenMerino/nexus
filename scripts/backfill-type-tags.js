const { sql } = require("@vercel/postgres");
const { canonicalize } = require("../lib/normalize-tags");

async function main() {
  const r = await sql`SELECT id, type FROM doi_records WHERE type IS NOT NULL`;
  let canonicalized = 0, typeTagsInserted = 0, typeTagsSkipped = 0;

  for (const row of r.rows) {
    const canonical = canonicalize("type", row.type);
    if (canonical !== row.type) {
      await sql`UPDATE doi_records SET type = ${canonical} WHERE id = ${row.id}`;
      canonicalized++;
    }
    const exists = await sql`SELECT 1 FROM tags
      WHERE doi_record_id=${row.id} AND category='type' LIMIT 1`;
    if (exists.rows.length) { typeTagsSkipped++; continue; }
    await sql`INSERT INTO tags (doi_record_id, category, value)
      VALUES (${row.id}, 'type', ${canonical})`;
    typeTagsInserted++;
  }

  console.log({ scanned: r.rows.length, canonicalized, typeTagsInserted, typeTagsSkipped });
}

main().catch(e => { console.error(e); process.exit(1); });
