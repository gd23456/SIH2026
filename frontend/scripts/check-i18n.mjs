// Fails if any UI string is missing a translation.
//
// Why this exists: t() falls back to English when a language is absent, so an
// incomplete key is invisible in development and in code review — the app just
// quietly speaks English. That is exactly how 70 of 166 keys ended up with only
// en/hi/kn: every string added after the original translation pass inherited
// the gap, and picking Tamil gave you a mostly-English app.
//
// Run: npm run check:i18n   (also runs in CI)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(here, "..", "src", "lib", "i18n.js");
const src = fs.readFileSync(file, "utf8");

// Pull LANGS and STR out without importing (i18n.js has no runtime deps, but
// it is an ESM module with exports we do not want to execute here).
const langsBlock = src.slice(src.indexOf("export const LANGS"), src.indexOf("const STR"));
const LANGS = [...langsBlock.matchAll(/code:\s*"([a-z]{2})"/g)].map((m) => m[1]);

const strStart = src.indexOf("const STR = {");
const strEnd = src.indexOf("\nexport function t");
if (strStart === -1 || strEnd === -1) {
  console.error("check-i18n: could not locate LANGS/STR in i18n.js");
  process.exit(2);
}
const STR = eval(
  "(" + src.slice(strStart, strEnd).replace(/^const STR = /, "").replace(/;\s*$/, "") + ")",
);

const problems = [];
for (const [key, value] of Object.entries(STR)) {
  if (typeof value !== "object" || value === null) continue;
  const missing = LANGS.filter((l) => !value[l] || !String(value[l]).trim());
  if (missing.length) problems.push({ key, missing });
}

const total = Object.keys(STR).length;
if (problems.length === 0) {
  console.log(`✅ i18n: ${total} keys × ${LANGS.length} languages (${LANGS.join(", ")}) — complete`);
  process.exit(0);
}

console.error(`❌ i18n: ${problems.length} of ${total} keys are missing translations.\n`);
for (const { key, missing } of problems) {
  console.error(`   ${key.padEnd(24)} missing: ${missing.join(", ")}`);
}
console.error(
  "\nEvery user-facing string must exist in all " +
    LANGS.length +
    " languages. t() silently falls back to English, so a missing one ships as an English\n" +
    "word in the middle of a Tamil screen and nobody notices until a judge does.",
);
process.exit(1);
