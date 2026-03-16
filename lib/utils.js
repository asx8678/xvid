/**
 * Pure utility functions shared across contexts.
 * No Chrome API or DOM dependencies — fully testable.
 */

export function sanitizeFilenameComponent(str) {
  return str.replace(/[^a-zA-Z0-9_-]/g, "_") || "unknown";
}

export function pickVariantByQuality(variants, quality) {
  if (!variants || variants.length === 0) return undefined;
  if (quality === "highest" || !quality) return variants[0];
  const target = parseInt(quality);
  if (!target) return variants[0]; // Non-numeric quality strings fall back to highest
  const match = variants.find(v => {
    const height = parseInt((v.resolution || "").split("x")[1]);
    return height && height <= target;
  });
  return match || variants[0];
}

export function parseTweetId(input) {
  input = input.trim();
  if (/^\d+$/.test(input)) return input;
  const match = input.match(/(?:x\.com|twitter\.com)\/[^/]+\/status\/(\d+)/);
  return match ? match[1] : null;
}

export function formatDuration(ms) {
  const secs = Math.round(ms / 1000);
  const mins = Math.floor(secs / 60);
  const remainingSecs = secs % 60;
  if (mins > 0) return `${mins}:${String(remainingSecs).padStart(2, "0")}`;
  return `${secs}s`;
}

export function formatTimeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
