/**
 * Shared constants used across background, popup, and options contexts.
 */

// --- Storage keys ---
export const SETTINGS_KEY = "xvd_settings";
export const HISTORY_KEY = "xvd_download_history";
export const PENDING_KEY = "xvd_pending_downloads";
export const DISCLAIMER_KEY = "xvd_disclaimer_dismissed";

// --- Settings ---
export const DEFAULT_SETTINGS = {
  defaultQuality: "highest",
  syndicationOnly: false,
  anonymousFilenames: false,
  disableHistory: false,
};

// --- UI timing ---
export const BUTTON_RESET_MS = 4000;

// --- Warning strings ---
export const AUTH_API_WARNING = "Fetched via authenticated API";
