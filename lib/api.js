/**
 * Dual-strategy API: syndication (no auth) with GraphQL fallback (session cookies).
 */

import { extractVideoData } from "./video-extractor.js";
import { acquireSlot } from "./rate-limiter.js";
import { resolveQueryId } from "./query-id-resolver.js";
import { fetchWithTimeout, friendlyHttpError } from "./fetch-utils.js";

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

export async function fetchTweetVideoData(tweetId) {
  // Try syndication first (no auth needed)
  try {
    const data = await fetchSyndication(tweetId);
    if (data) return data;
  } catch (e) {
    console.log("[XVD] Syndication failed, trying GraphQL:", e.message);
  }

  // GraphQL fallback
  return fetchGraphQL(tweetId);
}

async function fetchSyndication(tweetId) {
  const slot = await acquireSlot();
  if (!slot.allowed) {
    throw new Error(`Rate limited \u2014 retry after ${Math.ceil(slot.retryAfterMs / 1000)}s`);
  }

  const token = Math.floor(Math.random() * 1e13);
  const url = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=${token}`;
  const res = await fetchWithTimeout(url);

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(friendlyHttpError(res.status));

  const json = await res.json();
  return extractVideoData(json, "syndication");
}

async function fetchGraphQL(tweetId, retried = false) {
  const slot = await acquireSlot();
  if (!slot.allowed) {
    throw new Error(`Rate limited \u2014 retry after ${Math.ceil(slot.retryAfterMs / 1000)}s`);
  }

  const csrfCookie = await chrome.cookies.get({ url: "https://x.com", name: "ct0" });
  if (!csrfCookie) {
    throw new Error("Please log in to X.com to download this video");
  }

  const queryId = await resolveQueryId(retried);
  if (!queryId) throw new Error("Could not resolve video data \u2014 please try again later");

  const variables = JSON.stringify({ tweetId, withCommunity: true, includePromotedContent: false, withVoice: true });
  const features = JSON.stringify(GRAPHQL_FEATURES);
  const fieldToggles = JSON.stringify(FIELD_TOGGLES);

  const params = new URLSearchParams({ variables, features, fieldToggles });
  const url = `https://x.com/i/api/graphql/${queryId}/TweetResultByRestId?${params}`;

  const res = await fetchWithTimeout(url, {
    credentials: "include",
    headers: {
      "Authorization": `Bearer ${BEARER_TOKEN}`,
      "x-csrf-token": csrfCookie.value,
      "x-twitter-active-user": "yes",
      "x-twitter-client-language": "en",
    },
  });

  if ((res.status === 400 || res.status === 403) && !retried) {
    console.log("[XVD] GraphQL returned", res.status, "\u2014 refreshing queryId");
    return fetchGraphQL(tweetId, true);
  }

  if (!res.ok) throw new Error(friendlyHttpError(res.status));

  const json = await res.json();
  const data = extractVideoData(json, "graphql");
  if (!data) throw new Error("No downloadable video found in this tweet");
  return data;
}
