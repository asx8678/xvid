/**
 * Extracts and normalizes video data from syndication or GraphQL API responses.
 * Supports multi-video tweets. Returns media type and duration metadata.
 */

function getAllMp4Variants(variants) {
  return variants
    .filter(v => v.content_type === "video/mp4" || v.contentType === "video/mp4")
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))
    .map(v => {
      const url = v.url;
      const resMatch = url.match(/\/(\d+x\d+)\//);
      return {
        bitrate: v.bitrate || 0,
        contentType: "video/mp4",
        url,
        resolution: resMatch ? resMatch[1] : "unknown",
      };
    });
}

export function extractVideoData(apiResponse, source) {
  if (source === "syndication") {
    return extractFromSyndication(apiResponse);
  }
  if (source === "graphql") {
    return extractFromGraphQL(apiResponse);
  }
  throw new Error(`Unknown source: ${source}`);
}

function extractFromSyndication(response) {
  const mediaDetails = response.mediaDetails;
  if (!mediaDetails || mediaDetails.length === 0) return null;

  const videoMediaItems = mediaDetails.filter(m => m.type === "video" || m.type === "animated_gif");
  if (videoMediaItems.length === 0) return null;

  const username = response.user?.screen_name || "unknown";
  const tweetId = String(response.id_str || response.id || "");

  const videos = videoMediaItems
    .filter(m => m.video_info?.variants?.length > 0)
    .map(m => ({
      type: m.type,
      durationMs: m.video_info.duration_millis || 0,
      variants: getAllMp4Variants(m.video_info.variants),
    }))
    .filter(v => v.variants.length > 0);

  if (videos.length === 0) return null;

  return { tweetId, username, videos };
}

function extractFromGraphQL(response) {
  let result = response?.data?.tweetResult?.result;
  if (!result) return null;

  if (result.__typename === "TweetTombstone") {
    throw new Error("This tweet has been deleted");
  }
  if (result.__typename === "TweetUnavailable") {
    throw new Error("This tweet is unavailable (private or suspended account)");
  }

  if (result.__typename === "TweetWithVisibilityResults") {
    result = result.tweet;
  }
  if (!result) return null;

  const legacy = result.legacy;
  if (!legacy) return null;

  const media = legacy.extended_entities?.media;
  if (!media || media.length === 0) {
    // Check if this might be age-restricted content
    if (result.legacy?.possibly_sensitive) {
      throw new Error("This video may be age-restricted — log in to X.com and disable sensitive content filter");
    }
    return null;
  }

  const videoMediaItems = media.filter(m => m.type === "video" || m.type === "animated_gif");
  if (videoMediaItems.length === 0) return null;

  const username = result.core?.user_results?.result?.legacy?.screen_name || "unknown";
  const tweetId = String(legacy.id_str || "");

  const videos = videoMediaItems
    .filter(m => m.video_info?.variants?.length > 0)
    .map(m => ({
      type: m.type,
      durationMs: m.video_info.duration_millis || 0,
      variants: getAllMp4Variants(m.video_info.variants),
    }))
    .filter(v => v.variants.length > 0);

  if (videos.length === 0) return null;

  return { tweetId, username, videos };
}
