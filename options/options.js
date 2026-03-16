import { SETTINGS_KEY, DISCLAIMER_KEY, DEFAULT_SETTINGS } from "../lib/constants.js";

const defaultQualityEl = document.getElementById("defaultQuality");
const syndicationOnlyEl = document.getElementById("syndicationOnly");
const anonymousFilenamesEl = document.getElementById("anonymousFilenames");
const disableHistoryEl = document.getElementById("disableHistory");
const cookieAccessEl = document.getElementById("cookieAccess");
const clearAllBtn = document.getElementById("clearAllBtn");
const privacyLink = document.getElementById("privacyLink");
const statusEl = document.getElementById("status");
const versionEl = document.getElementById("version");

function load() {
  chrome.storage.sync.get(SETTINGS_KEY, (data) => {
    if (chrome.runtime.lastError) {
      console.warn("[XVD] load settings error:", chrome.runtime.lastError.message);
      return;
    }
    const settings = { ...DEFAULT_SETTINGS, ...data[SETTINGS_KEY] };
    defaultQualityEl.value = settings.defaultQuality;
    syndicationOnlyEl.checked = settings.syndicationOnly;
    anonymousFilenamesEl.checked = settings.anonymousFilenames;
    disableHistoryEl.checked = settings.disableHistory;
  });

  chrome.permissions.contains({ permissions: ["cookies"] }, (granted) => {
    if (chrome.runtime.lastError) {
      console.warn("[XVD] permissions check error:", chrome.runtime.lastError.message);
      return;
    }
    cookieAccessEl.checked = granted;
  });
}

function showStatus(text) {
  statusEl.textContent = text;
  statusEl.classList.remove("hidden");
  setTimeout(() => statusEl.classList.add("hidden"), 1500);
}

function save() {
  const settings = {
    defaultQuality: defaultQualityEl.value,
    syndicationOnly: syndicationOnlyEl.checked,
    anonymousFilenames: anonymousFilenamesEl.checked,
    disableHistory: disableHistoryEl.checked,
  };

  if (settings.disableHistory) {
    // Clear history via the service worker's message handler to use its mutex
    chrome.runtime.sendMessage({ action: "clearHistory" }, () => {
      if (chrome.runtime.lastError) {
        console.warn("[XVD] clear history error:", chrome.runtime.lastError.message);
      }
    });
  }

  chrome.storage.sync.set({ [SETTINGS_KEY]: settings }, () => {
    if (chrome.runtime.lastError) {
      console.warn("[XVD] save settings error:", chrome.runtime.lastError.message);
      return;
    }
    showStatus("Settings saved");
  });
}

cookieAccessEl.addEventListener("change", () => {
  if (cookieAccessEl.checked) {
    chrome.permissions.request({ permissions: ["cookies"] }, (granted) => {
      if (chrome.runtime.lastError) {
        console.warn("[XVD] permission request error:", chrome.runtime.lastError.message);
        return;
      }
      cookieAccessEl.checked = granted;
      if (granted) showStatus("Cookie access granted");
    });
  } else {
    chrome.permissions.remove({ permissions: ["cookies"] }, (removed) => {
      if (chrome.runtime.lastError) {
        console.warn("[XVD] permission remove error:", chrome.runtime.lastError.message);
        return;
      }
      cookieAccessEl.checked = !removed;
      if (removed) showStatus("Cookie access revoked");
    });
  }
});

defaultQualityEl.addEventListener("change", save);
syndicationOnlyEl.addEventListener("change", save);
anonymousFilenamesEl.addEventListener("change", save);
disableHistoryEl.addEventListener("change", save);

clearAllBtn.addEventListener("click", () => {
  if (!confirm("This will reset all settings, history, and cached data. Continue?")) return;

  Promise.all([
    chrome.storage.local.clear(),
    chrome.storage.sync.remove([SETTINGS_KEY, DISCLAIMER_KEY]),
    chrome.storage.session.clear(),
  ]).then(() => {
    showStatus("All data cleared");
    load();
  }).catch((e) => {
    console.warn("[XVD] clear all data error:", e.message);
    showStatus("Failed to clear data");
  });
});

privacyLink.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: chrome.runtime.getURL("PRIVACY_POLICY.md") });
});

versionEl.textContent = `v${chrome.runtime.getManifest().version}`;
load();
