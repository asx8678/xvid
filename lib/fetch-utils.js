/**
 * Shared fetch utility with timeout and user-friendly error handling.
 */

export function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .catch(err => {
      if (err.name === "AbortError") throw new Error("Request timed out \u2014 please try again");
      if (err.name === "TypeError") throw new Error("Network error \u2014 check your internet connection");
      throw err;
    })
    .finally(() => clearTimeout(id));
}

export function friendlyHttpError(status) {
  if (status >= 500) return "X.com server error \u2014 please try again later";
  switch (status) {
    case 401: return "Authentication failed \u2014 please log in to X.com";
    case 403: return "Access denied \u2014 this content may be restricted";
    case 404: return "Tweet not found";
    case 429: return "Too many requests \u2014 please wait and try again";
    default: return `Request failed (HTTP ${status})`;
  }
}
