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
    "gta leaks",
    "rockstar leak",
    "rockstar leaks",
    "cyberleek",
    "vice city",
    "leonida",
    "lucia caminos",
    "jason duval",
    "port gellhorn",
  ],
  // Channel handles (@name) or channel IDs (UC...) whose videos are never hidden.
  allowedChannels: ["@RockstarGames"],
};

function sbGetSettings() {
  return chrome.storage.sync.get(SB_DEFAULTS);
}

function sbEscapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Builds one case-insensitive regex from the keyword list. Spaces in a keyword
// match any run of spaces/dashes/dots/underscores (or nothing), so "gta 6"
// also catches "GTA6", "gta-6", and "#GTA6". Keywords only match whole words,
// so "gta vi" does not fire on "GTA Vice City".
function sbBuildMatcher(keywords) {
  const parts = keywords
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean)
    .map((k) => k.split(/\s+/).map(sbEscapeRegExp).join("[\\s\\-_.:]*"));
  if (!parts.length) return null;
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${parts.join("|")})(?![\\p{L}\\p{N}])`, "iu");
}

function sbNormalizeChannel(s) {
  return s.trim().replace(/^@/, "").toLowerCase();
}
