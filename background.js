importScripts("shared.js");

// The /shorts/ -> /watch redirect is a static ruleset; switch it with the setting.
async function syncShortsRedirect() {
  const { blockShorts } = await sbGetSettings();
  await chrome.declarativeNetRequest.updateEnabledRulesets(
    blockShorts ? { enableRulesetIds: ["shorts_redirect"] } : { disableRulesetIds: ["shorts_redirect"] }
  );
}

chrome.runtime.onInstalled.addListener(syncShortsRedirect);
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
