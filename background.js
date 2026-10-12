importScripts("shared.js");

// The /shorts/ -> /watch redirect is a static ruleset; switch it with the setting.
async function syncShortsRedirect() {
  const { blockShorts } = await sbGetSettings();
  await chrome.declarativeNetRequest.updateEnabledRulesets(
    blockShorts ? { enableRulesetIds: ["shorts_redirect"] } : { disableRulesetIds: ["shorts_redirect"] }
  );
}

// A saved keyword list replaces the defaults entirely, so new default keywords
// wouldn't reach anyone who has clicked Save. Append the ones added since the
// version they're upgrading from.
async function addNewDefaultKeywords(previousVersion) {
  const { keywords } = await chrome.storage.sync.get("keywords");
  if (!keywords) return; // Still on the defaults, which already include them.
  const have = new Set(keywords.map((k) => k.trim().toLowerCase()));
  const added = Object.entries(SB_KEYWORD_ADDITIONS)
    .filter(([version]) => sbVersionLessThan(previousVersion, version))
    .flatMap(([, words]) => words)
    .filter((word) => !have.has(word));
  if (added.length) await chrome.storage.sync.set({ keywords: [...keywords, ...added] });
}

chrome.runtime.onInstalled.addListener((details) => {
  syncShortsRedirect();
  if (details.reason === "update" && details.previousVersion) {
    addNewDefaultKeywords(details.previousVersion);
  }
});
chrome.runtime.onStartup.addListener(syncShortsRedirect);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && "blockShorts" in changes) syncShortsRedirect();
});

// Toolbar badge shows how many spoilers are hidden on the current tab.
chrome.action.setBadgeBackgroundColor({ color: "#2b2b30" });
chrome.action.setBadgeTextColor?.({ color: "#ffffff" });

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type !== "spoiler-count" || !sender.tab) return;
  chrome.action.setBadgeText({
    tabId: sender.tab.id,
    text: msg.count ? String(msg.count) : "",
  });
});
