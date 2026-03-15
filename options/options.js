const defaultQuality = document.getElementById("defaultQuality");
const status = document.getElementById("status");

const SETTINGS_KEY = "xvd_settings";
const DEFAULTS = { defaultQuality: "highest" };

function load() {
  chrome.storage.sync.get(SETTINGS_KEY, (data) => {
    const settings = { ...DEFAULTS, ...data[SETTINGS_KEY] };
    defaultQuality.value = settings.defaultQuality;
  });
}

function save() {
  const settings = {
    defaultQuality: defaultQuality.value,
  };
  chrome.storage.sync.set({ [SETTINGS_KEY]: settings }, () => {
    status.classList.remove("hidden");
    setTimeout(() => status.classList.add("hidden"), 1500);
  });
}

defaultQuality.addEventListener("change", save);

load();
