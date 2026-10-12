// Shared by the content script, background worker, popup, and options page.

const SB_DEFAULTS = {
  blockShorts: true,
  spoilerShield: true,
  keywords: [
    "gta 6",
    "gta vi",
    "grand theft auto 6",
    "grand theft auto vi",
    "gta leak",
    "rockstar leak",
    "cyber leek",
    "cyber leak",
    "vice city",
    "leonida",
    "lucia caminos",
    "jason duval",
    "port gellhorn",
  ],
  // Channel handles (@name) or channel IDs (UC...) whose videos are never hidden.
  allowedChannels: ["@RockstarGames"],
};

// Keywords added to the defaults in each release. Saved keyword lists replace
// the defaults, so on update these get appended to them (only once, so words
// the user removed on purpose stay removed).
const SB_KEYWORD_ADDITIONS = {
  "1.2.0": ["cyber leek", "cyber leak"],
};

function sbGetSettings() {
  return chrome.storage.sync.get(SB_DEFAULTS);
}

function sbEscapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Builds one case-insensitive regex from the keyword list. Spaces in a keyword
// match any run of spaces/dashes/dots/underscores (or nothing), so "cyber leek"
// also catches "CyberLeek", "cyber-leek", and "#cyberleek". A trailing "s" or
// "'s" is allowed ("leaks", "CyberLeek's"). Otherwise keywords only match whole
// words, so "gta vi" does not fire on "GTA Vice City".
function sbBuildMatcher(keywords) {
  const parts = keywords
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean)
    .map((k) => k.split(/\s+/).map(sbEscapeRegExp).join("[\\s\\-_.:]*"));
  if (!parts.length) return null;
  return new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${parts.join("|")})(?:['’]?s)?(?![\\p{L}\\p{N}])`,
    "iu"
  );
}

// Undo common filter dodges before matching: fancy Unicode letters
// ("𝗚𝗧𝗔 𝟲", full-width "ＧＴＡ６") and invisible zero-width characters.
function sbNormalizeText(text) {
  return text.normalize("NFKC").replace(/[­​-‏⁠﻿]/g, "");
}

function sbVersionLessThan(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) < (pb[i] || 0);
  }
  return false;
}

function sbNormalizeChannel(s) {
  return s.trim().replace(/^@/, "").toLowerCase();
}
