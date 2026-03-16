/**
 * Resolves the GraphQL queryId for TweetResultByRestId by scraping X.com bundles.
 * Caches in chrome.storage.local with a 7-day TTL.
 * Fetches bundles in parallel for faster resolution.
 */

import { fetchWithTimeout } from "./fetch-utils.js";

const CACHE_KEY = "xvd_queryId";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const QUERY_ID_FORMAT = /^[a-zA-Z0-9_-]+$/;

export async function resolveQueryId(forceRefresh = false) {
  if (!forceRefresh) {
    const cached = await getCached();
    if (cached) return cached;
  }

  const queryId = await scrapeQueryId();
  if (queryId) {
    await chrome.storage.local.set({
      [CACHE_KEY]: { value: queryId, timestamp: Date.now() },
    });
  }
  return queryId;
}

async function getCached() {
  const data = await chrome.storage.local.get(CACHE_KEY);
  const entry = data[CACHE_KEY];
  if (!entry) return null;
  if (Date.now() - entry.timestamp > TTL_MS) return null;
  if (!QUERY_ID_FORMAT.test(entry.value)) return null;
  return entry.value;
}

async function scrapeQueryId() {
  const res = await fetchWithTimeout("https://x.com", { credentials: "omit" });
  if (!res.ok) throw new Error(`Failed to fetch x.com: ${res.status}`);
  const html = await res.text();

  const scriptPattern = /src="(https:\/\/abs\.twimg\.com\/responsive-web\/client-web[^"]+\.js)"/g;
  const scriptUrls = [];
  let match;
  while ((match = scriptPattern.exec(html)) !== null) {
    scriptUrls.push(match[1]);
  }

  if (scriptUrls.length === 0) {
    const altPattern = /src="([^"]*\/client-web\/[^"]+\.js)"/g;
    while ((match = altPattern.exec(html)) !== null) {
      scriptUrls.push(match[1]);
    }
  }

  const queryIdPattern = /queryId:"([^"]+)",operationName:"TweetResultByRestId"/;

  const BATCH_SIZE = 3;

  // Prioritize bundles likely to contain API definitions
  scriptUrls.sort((a, b) => {
    const aHasApi = /api|endpoint|graphql/i.test(a) ? 0 : 1;
    const bHasApi = /api|endpoint|graphql/i.test(b) ? 0 : 1;
    return aHasApi - bHasApi;
  });

  for (let i = 0; i < scriptUrls.length; i += BATCH_SIZE) {
    const batch = scriptUrls.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (url) => {
        const scriptRes = await fetchWithTimeout(url, { credentials: "omit" });
        if (!scriptRes.ok) return null;
        const js = await scriptRes.text();
        const qMatch = js.match(queryIdPattern);
        if (qMatch) {
          const id = qMatch[1];
          if (!QUERY_ID_FORMAT.test(id)) {
            throw new Error(`Resolved queryId has unexpected format: ${id}`);
          }
          return id;
        }
        return null;
      })
    );

    for (const r of results) {
      if (r.status === "rejected" && r.reason?.message?.includes("unexpected format")) {
        throw r.reason;
      }
    }

    for (const r of results) {
      if (r.status === "fulfilled" && r.value) return r.value;
    }
  }

  throw new Error("Could not find TweetResultByRestId queryId in X.com bundles");
}
