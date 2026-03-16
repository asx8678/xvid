/**
 * Shared fetch utility with timeout and user-friendly error handling.
 */

export function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeoutMs);

  // If caller provided a signal, abort our controller when it fires
  const onExternalAbort = options.signal ? () => controller.abort() : null;
  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener("abort", onExternalAbort, { once: true });
    }
  }

  const { signal: _ignored, ...restOptions } = options;
  return fetch(url, { ...restOptions, signal: controller.signal, referrerPolicy: "no-referrer" })
    .catch(err => {
      if (err.name === "AbortError") throw new Error("Request timed out \u2014 please try again");
      if (err.name === "TypeError") throw new Error("Network error \u2014 check your internet connection");
      throw err;
    })
    .finally(() => {
      clearTimeout(timerId);
      if (onExternalAbort && options.signal) {
        options.signal.removeEventListener("abort", onExternalAbort);
      }
    });
}

export async function parseJsonResponse(res) {
  try {
    return await res.json();
  } catch {
    throw new Error("Invalid response from X.com \u2014 please try again");
  }
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
