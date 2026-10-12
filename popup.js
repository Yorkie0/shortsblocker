const TOGGLES = ["blockShorts", "spoilerShield"];

sbGetSettings().then((settings) => {
  for (const key of TOGGLES) {
    const input = document.getElementById(key);
    input.checked = settings[key];
    input.addEventListener("change", () => chrome.storage.sync.set({ [key]: input.checked }));
  }
});

document.getElementById("options").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});
