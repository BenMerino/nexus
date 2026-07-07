const crypto = require("crypto");
const { promisify } = require("util");
const scrypt = promisify(crypto.scrypt);

// Password hashing on Node stdlib scrypt — no extension, no extra dependency.
// Stored format: scrypt$<salt-hex>$<hash-hex>. Legacy plaintext rows (pre-
// backfill, see seed-users.js) are still verifiable until rewritten.
const PREFIX = "scrypt$";

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await scrypt(String(password), salt, 32);
  return `${PREFIX}${salt}$${hash.toString("hex")}`;
}

async function verifyPassword(password, stored) {
  if (!password || !stored) return false;
  if (!stored.startsWith(PREFIX)) {
    // Legacy plaintext row — constant-time compare.
    const a = Buffer.from(String(password));
    const b = Buffer.from(String(stored));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  const [salt, hex] = stored.slice(PREFIX.length).split("$");
  if (!salt || !hex) return false;
  const candidate = await scrypt(String(password), salt, 32);
  return crypto.timingSafeEqual(candidate, Buffer.from(hex, "hex"));
}

function isHashed(stored) {
  return typeof stored === "string" && stored.startsWith(PREFIX);
}

module.exports = { hashPassword, verifyPassword, isHashed };
