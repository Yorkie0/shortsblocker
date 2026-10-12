(() => {
  // ---------- Settings ----------

  let settings = { ...SB_DEFAULTS };
  let matcher = sbBuildMatcher(settings.keywords);
  let allowed = new Set(settings.allowedChannels.map(sbNormalizeChannel));

  function applySettings(next) {
    settings = { ...SB_DEFAULTS, ...next };
    matcher = sbBuildMatcher(settings.keywords);
    allowed = new Set(settings.allowedChannels.map(sbNormalizeChannel));
    document.documentElement.toggleAttribute("data-sb-shorts-off", !settings.blockShorts);
    scheduleScan();
  }

  sbGetSettings().then(applySettings);
  chrome.storage.onChanged.addListener((_, area) => {
    if (area === "sync") sbGetSettings().then(applySettings);
  });

  // ---------- Shorts ----------

  // YouTube is a single-page app, so in-app navigation to /shorts/ never hits the
  // network redirect rule. Catch those navigations here and bounce to /watch.
  const SHORTS_PATH = /^\/shorts\/([A-Za-z0-9_-]+)/;

  function redirectIfShorts() {
    if (!settings.blockShorts) return;
    const match = location.pathname.match(SHORTS_PATH);
    if (match) {
      location.replace(`${location.origin}/watch?v=${match[1]}`);
    } else if (location.pathname === "/shorts" || location.pathname === "/shorts/") {
      location.replace(`${location.origin}/`);
    }
  }

  // Search filter chips ("Shorts") have no stable attribute to target from CSS.
  function hideShortsChips() {
    for (const chip of document.querySelectorAll(
      "yt-chip-cloud-chip-renderer, chip-shape, yt-chip-shape"
    )) {
      const isShorts = settings.blockShorts && chip.textContent.trim() === "Shorts";
      if (isShorts) {
        chip.style.setProperty("display", "none", "important");
        chip.dataset.sbChip = "";
      } else if ("sbChip" in chip.dataset) {
        chip.style.removeProperty("display");
        delete chip.dataset.sbChip;
      }
    }
  }

  // ---------- Spoiler shield ----------

  // Anything that represents a single video, post, or channel. Only the outermost
  // match is hidden so grids don't end up with empty slots.
  const TILE_SELECTOR = [
    "ytd-rich-item-renderer",
    "ytd-video-renderer",
    "ytd-compact-video-renderer",
    "ytd-grid-video-renderer",
    "ytd-playlist-renderer",
    "ytd-compact-playlist-renderer",
    "ytd-grid-playlist-renderer",
    "ytd-radio-renderer",
    "ytd-compact-radio-renderer",
    "ytd-movie-renderer",
    "ytd-channel-renderer",
    "ytd-playlist-panel-video-renderer",
    "ytd-reel-item-renderer",
    "ytd-notification-renderer",
    "ytd-backstage-post-thread-renderer",
    "ytd-post-renderer",
    "ytd-universal-watch-card-renderer",
    "yt-lockup-view-model",
    "ytm-shorts-lockup-view-model",
    "ytm-shorts-lockup-view-model-v2",
    "ytm-rich-item-renderer",
    "ytm-video-with-context-renderer",
    "ytm-compact-video-renderer",
    "ytm-media-item",
    // Player end screen, cards, and "up next"
    ".ytp-videowall-still",
    ".ytp-ce-element",
    ".ytp-autonav-endscreen-upnext-container",
    // Search box suggestions
    '[role="listbox"] [role="option"]',
  ].join(",");

  // Comments are checked one by one and never exempted: an @RockstarGames
  // mention inside a comment shouldn't let a spoiler through.
  const COMMENT_SELECTOR = [
    "ytd-comment-view-model",
    "ytd-comment-renderer",
    "ytm-comment-renderer",
  ].join(",");

  function textOf(el) {
    let text = el.textContent;
    for (const attr of ["aria-label", "title"]) {
      if (el.hasAttribute(attr)) text += " " + el.getAttribute(attr);
    }
    for (const child of el.querySelectorAll("[aria-label], [title]")) {
      text += " " + (child.getAttribute("aria-label") || "") + " " + (child.getAttribute("title") || "");
    }
    return text;
  }

  function channelKey(href) {
    let m = href.match(/^(?:https?:\/\/[^/]+)?\/@([^/?#]+)/);
    if (m) return sbNormalizeChannel(decodeURIComponent(m[1]));
    m = href.match(/^(?:https?:\/\/[^/]+)?\/channel\/(UC[\w-]+)/);
    if (m) return m[1].toLowerCase();
    return null;
  }

  // A tile is exempt only if it links to at least one channel and every channel
  // it links to is allowed. Display names are ignored since anyone can name
  // their channel "Rockstar Games".
  function isFromAllowedChannel(el) {
    let found = false;
    for (const a of el.querySelectorAll("a[href]")) {
      const key = channelKey(a.getAttribute("href"));
      if (!key) continue;
      if (!allowed.has(key)) return false;
      found = true;
    }
    return found;
  }

  function setHidden(el, hidden) {
    if (hidden) el.setAttribute("data-sb-spoiler", "");
    else el.removeAttribute("data-sb-spoiler");
  }

  function scanTiles() {
    const active = settings.spoilerShield && matcher;
    for (const el of document.querySelectorAll(TILE_SELECTOR)) {
      if (el.parentElement?.closest(TILE_SELECTOR)) continue;
      setHidden(el, active && matcher.test(textOf(el)) && !isFromAllowedChannel(el));
    }
    for (const el of document.querySelectorAll(COMMENT_SELECTOR)) {
      setHidden(el, active && matcher.test(el.textContent));
    }
    // Clear stale flags (e.g. elements that stopped matching a selector).
    if (!active) {
      for (const el of document.querySelectorAll("[data-sb-spoiler]")) setHidden(el, false);
    }
  }

  // ----- Watch page: cover the whole page if the video itself is a spoiler -----

  const dismissed = new Set();
  let blockedVideoId = null;

  function currentVideoId() {
    return location.pathname === "/watch" ? new URLSearchParams(location.search).get("v") : null;
  }

  function watchPageText() {
    const parts = [document.title];
    for (const el of document.querySelectorAll(
      "ytd-watch-metadata #title, ytd-watch-metadata #description, " +
        "ytd-watch-metadata #super-title, .slim-video-information-title, ytm-slim-video-metadata-section-renderer"
    )) {
      parts.push(el.textContent);
    }
    return parts.join(" ");
  }

  function watchPageOwner() {
    return document.querySelector(
      "ytd-watch-metadata #owner, ytd-video-owner-renderer, ytm-slim-owner-renderer"
    );
  }

  function pauseVideos() {
    for (const video of document.querySelectorAll("video")) {
      if (!video.paused) video.pause();
    }
  }

  function showOverlay(videoId) {
    blockedVideoId = videoId;
    pauseVideos();
    if (document.getElementById("sb-spoiler-overlay") || !document.body) return;

    const overlay = document.createElement("div");
    overlay.id = "sb-spoiler-overlay";
    overlay.innerHTML = `
      <div class="sb-card">
        <img alt="">
        <h2>Possible GTA 6 spoiler</h2>
        <p>This video matches your spoiler filter and isn't from a channel you've allowed.</p>
        <div class="sb-buttons">
          <button class="sb-primary" data-action="back">Take me back</button>
          <button class="sb-secondary" data-action="show">Watch anyway</button>
        </div>
      </div>`;
    overlay.querySelector("img").src = chrome.runtime.getURL("icons/icon128.png");
    overlay.addEventListener("click", (e) => {
      const action = e.target.closest("button")?.dataset.action;
      if (action === "back") {
        if (history.length > 1) history.back();
        else location.assign("/");
      } else if (action === "show") {
        dismissed.add(videoId);
        hideOverlay();
      }
    });
    document.body.appendChild(overlay);
  }

  function hideOverlay() {
    blockedVideoId = null;
    document.getElementById("sb-spoiler-overlay")?.remove();
  }

  function checkWatchPage() {
    const videoId = currentVideoId();
    const owner = watchPageOwner();
    const isSpoiler =
      settings.spoilerShield &&
      matcher &&
      videoId &&
      !dismissed.has(videoId) &&
      matcher.test(watchPageText()) &&
      !(owner && isFromAllowedChannel(owner));
    if (isSpoiler) showOverlay(videoId);
    else hideOverlay();
  }

  // Autoplay can kick in after the overlay appears; keep the video paused.
  document.addEventListener(
    "play",
    (e) => {
      if (blockedVideoId && e.target instanceof HTMLVideoElement) e.target.pause();
    },
    true
  );

  // ---------- Toolbar badge ----------

  let lastCount = -1;
  function reportCount() {
    const count = document.querySelectorAll("[data-sb-spoiler]").length + (blockedVideoId ? 1 : 0);
    if (count === lastCount) return;
    lastCount = count;
    try {
      chrome.runtime.sendMessage({ type: "spoiler-count", count });
    } catch {
      // Extension was reloaded; this content script is orphaned.
    }
  }

  // ---------- Main loop ----------

  function scan() {
    redirectIfShorts();
    hideShortsChips();
    scanTiles();
    checkWatchPage();
    reportCount();
  }

  // YouTube mutates the DOM constantly; batch the work to once per frame. The
  // frame callback runs before paint, so spoiler tiles never flash on screen.
  let scheduled = false;
  function scheduleScan() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      scan();
    });
  }

  redirectIfShorts();
  document.addEventListener("yt-navigate-start", redirectIfShorts);
  document.addEventListener("yt-navigate-finish", scheduleScan);
  window.addEventListener("popstate", scheduleScan);
  new MutationObserver(scheduleScan).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["href", "title", "aria-label"],
  });
})();
