const $ = (id) => document.getElementById(id);
const TOGGLES = ["blockShorts", "spoilerShield"];
const LISTS = ["keywords", "allowedChannels"];

const readList = (id) =>
  $(id)
    .value.split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

function fill(settings) {
  for (const key of TOGGLES) $(key).checked = settings[key];
  for (const key of LISTS) $(key).value = settings[key].join("\n");
  updateTester();
}

function updateTester() {
  const title = $("tester").value.trim();
  const result = $("tester-result");
  if (!title) {
    result.textContent = "";
    result.className = "";
    return;
  }
  const match = sbBuildMatcher(readList("keywords"))?.exec(sbNormalizeText(title));
  result.textContent = match ? `Hidden: matches "${match[0]}"` : "Not hidden";
  result.className = match ? "blocked" : "clear";
}

let statusTimer;
function flash(message) {
  $("status").textContent = message;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => ($("status").textContent = ""), 2000);
}

// Toggles apply immediately, like in the popup.
for (const key of TOGGLES) {
  $(key).addEventListener("change", () => chrome.storage.sync.set({ [key]: $(key).checked }));
}

$("keywords").addEventListener("input", updateTester);
$("tester").addEventListener("input", updateTester);

$("save").addEventListener("click", async () => {
  await chrome.storage.sync.set({
    keywords: readList("keywords"),
    allowedChannels: readList("allowedChannels"),
  });
  flash("Saved. Open YouTube tabs update automatically.");
});

$("reset").addEventListener("click", async () => {
  await chrome.storage.sync.set(SB_DEFAULTS);
  fill(SB_DEFAULTS);
  flash("Defaults restored.");
});

sbGetSettings().then(fill);
