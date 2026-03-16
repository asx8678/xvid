/**
 * Dual-strategy API: syndication (no auth) with GraphQL fallback (session cookies).
 */

import { extractVideoData } from "./video-extractor.js";
import { requireSlot } from "./rate-limiter.js";
import { resolveQueryId } from "./query-id-resolver.js";
import { fetchWithTimeout, parseJsonResponse, friendlyHttpError } from "./fetch-utils.js";

// X.com's public web-client bearer token. Not a secret — it is embedded in the
// x.com JavaScript bundle and used by all unofficial clients.
const BEARER_TOKEN = "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

const GRAPHQL_FEATURES = {
  creator_subscriptions_tweet_preview_api_enabled: true,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  creator_subscriptions_quote_tweet_preview_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  rweb_video_timestamps_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_enhance_cards_enabled: false,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  tweetypie_unmention_optimization_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  responsive_web_graphql_timeline_navigation_enabled: true,
};

const FIELD_TOGGLES = {
  withArticlePlainText: false,
  withArticleRichContentState: false,
  withAuxiliaryUserLabels: false,
  withCommunity: true,
  withVoice: true,
};

// Pre-serialized for URL params — these never change at runtime
const FEATURES_JSON = JSON.stringify(GRAPHQL_FEATURES);
const FIELD_TOGGLES_JSON = JSON.stringify(FIELD_TOGGLES);

export async function fetchTweetVideoData(tweetId, { syndicationOnly = false } = {}) {
  // Try syndication first (no auth needed — fully anonymous)
  try {
    const data = await fetchSyndication(tweetId);
    if (data) return { ...data, apiSource: "syndication" };
  } catch {
    // Syndication unavailable, will try GraphQL if allowed
  }

  if (syndicationOnly) {
    throw new Error("Video not available via anonymous API — disable syndication-only mode in settings to download this video");
  }

  // GraphQL fallback (authenticated — X can see which account made this request)
  return fetchGraphQL(tweetId);
}

async function fetchSyndication(tweetId) {
  await requireSlot();

  const cacheBuster = Math.floor(Math.random() * 1e13);
  const url = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=${cacheBuster}`;
  const res = await fetchWithTimeout(url);

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(friendlyHttpError(res.status));

  const json = await parseJsonResponse(res);
  return extractVideoData(json, "syndication");
}

async function fetchGraphQL(tweetId, retried = false) {
  await requireSlot();

  const hasCookies = await chrome.permissions.contains({ permissions: ["cookies"] });
  if (!hasCookies) {
    throw new Error("Authenticated downloads require cookie access — enable in extension settings");
  }

  const csrfCookie = await chrome.cookies.get({ url: "https://x.com", name: "ct0" });
  if (!csrfCookie) {
    throw new Error("Please log in to X.com to download this video");
  }

  const queryId = await resolveQueryId(retried);
  if (!queryId) throw new Error("Could not resolve video data \u2014 please try again later");

  const variables = JSON.stringify({ tweetId, withCommunity: true, includePromotedContent: false, withVoice: true });

  const params = new URLSearchParams({ variables, features: FEATURES_JSON, fieldToggles: FIELD_TOGGLES_JSON });
  const url = `https://x.com/i/api/graphql/${queryId}/TweetResultByRestId?${params}`;

  const res = await fetchWithTimeout(url, {
    credentials: "include",
    headers: {
      "Authorization": `Bearer ${BEARER_TOKEN}`,
      "x-csrf-token": csrfCookie.value,
      "x-twitter-client-language": navigator.language?.split("-")[0] || "en",
    },
  });

  if ((res.status === 400 || res.status === 403) && !retried) {
    return fetchGraphQL(tweetId, true);
  }

  if (!res.ok) throw new Error(friendlyHttpError(res.status));

  const json = await parseJsonResponse(res);
  const data = extractVideoData(json, "graphql");
  if (!data) throw new Error("No downloadable video found in this tweet");
  return { ...data, apiSource: "graphql" };
}
