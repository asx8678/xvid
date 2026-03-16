import { describe, it, expect } from 'vitest';
import { extractVideoData, isAllowedVideoUrl } from '../lib/video-extractor.js';

describe('extractVideoData', () => {
  describe('syndication source', () => {
    it('returns null when no mediaDetails', () => {
      expect(extractVideoData({}, 'syndication')).toBeNull();
    });

    it('returns null when mediaDetails is empty', () => {
      expect(extractVideoData({ mediaDetails: [] }, 'syndication')).toBeNull();
    });

    it('returns null when no video media items', () => {
      const response = {
        mediaDetails: [{ type: 'photo' }],
      };
      expect(extractVideoData(response, 'syndication')).toBeNull();
    });

    it('extracts video data from syndication response', () => {
      const response = {
        id_str: '123456',
        user: { screen_name: 'testuser' },
        mediaDetails: [{
          type: 'video',
          video_info: {
            duration_millis: 30000,
            variants: [
              { content_type: 'video/mp4', bitrate: 2000000, url: 'https://video.twimg.com/ext_tw_video/123/pu/vid/1280x720/abc.mp4' },
              { content_type: 'video/mp4', bitrate: 800000, url: 'https://video.twimg.com/ext_tw_video/123/pu/vid/640x360/def.mp4' },
              { content_type: 'application/x-mpegURL', url: 'https://video.twimg.com/ext_tw_video/123/pu/pl/playlist.m3u8' },
            ],
          },
        }],
      };
      const result = extractVideoData(response, 'syndication');
      expect(result).not.toBeNull();
      expect(result.tweetId).toBe('123456');
      expect(result.username).toBe('testuser');
      expect(result.videos).toHaveLength(1);
      expect(result.videos[0].variants).toHaveLength(2); // Only mp4s
      expect(result.videos[0].variants[0].bitrate).toBeGreaterThan(result.videos[0].variants[1].bitrate); // Sorted desc
      expect(result.videos[0].variants[0].resolution).toBe('1280x720');
      expect(result.videos[0].durationMs).toBe(30000);
    });

    it('handles animated_gif type', () => {
      const response = {
        id_str: '789',
        user: { screen_name: 'gifuser' },
        mediaDetails: [{
          type: 'animated_gif',
          video_info: {
            duration_millis: 0,
            variants: [
              { content_type: 'video/mp4', bitrate: 0, url: 'https://video.twimg.com/tweet_video/abc.mp4' },
            ],
          },
        }],
      };
      const result = extractVideoData(response, 'syndication');
      expect(result).not.toBeNull();
      expect(result.videos).toHaveLength(1);
      expect(result.videos[0].type).toBe('animated_gif');
    });

    it('filters out URLs from non-allowed domains', () => {
      const response = {
        id_str: '999',
        user: { screen_name: 'baduser' },
        mediaDetails: [{
          type: 'video',
          video_info: {
            duration_millis: 5000,
            variants: [
              { content_type: 'video/mp4', bitrate: 1000000, url: 'https://evil.com/malicious.mp4' },
            ],
          },
        }],
      };
      const result = extractVideoData(response, 'syndication');
      expect(result).toBeNull(); // All variants filtered out
    });

    it('falls back to response.id when id_str is absent', () => {
      const response = {
        id: 111222,
        user: { screen_name: 'fallbackuser' },
        mediaDetails: [{
          type: 'video',
          video_info: {
            duration_millis: 1000,
            variants: [
              { content_type: 'video/mp4', bitrate: 500000, url: 'https://video.twimg.com/ext_tw_video/111/pu/vid/640x360/v.mp4' },
            ],
          },
        }],
      };
      const result = extractVideoData(response, 'syndication');
      expect(result).not.toBeNull();
      expect(result.tweetId).toBe('111222');
    });

    it('handles multi-video tweets', () => {
      const response = {
        id_str: '333',
        user: { screen_name: 'multiuser' },
        mediaDetails: [
          {
            type: 'video',
            video_info: {
              duration_millis: 10000,
              variants: [
                { content_type: 'video/mp4', bitrate: 1000000, url: 'https://video.twimg.com/ext_tw_video/333/pu/vid/1280x720/a.mp4' },
              ],
            },
          },
          {
            type: 'video',
            video_info: {
              duration_millis: 20000,
              variants: [
                { content_type: 'video/mp4', bitrate: 2000000, url: 'https://video.twimg.com/ext_tw_video/333/pu/vid/1920x1080/b.mp4' },
              ],
            },
          },
        ],
      };
      const result = extractVideoData(response, 'syndication');
      expect(result).not.toBeNull();
      expect(result.videos).toHaveLength(2);
      expect(result.videos[0].durationMs).toBe(10000);
      expect(result.videos[1].durationMs).toBe(20000);
    });
  });

  describe('graphql source', () => {
    it('returns null when no tweetResult', () => {
      expect(extractVideoData({ data: {} }, 'graphql')).toBeNull();
    });

    it('throws on TweetTombstone', () => {
      const response = {
        data: { tweetResult: { result: { __typename: 'TweetTombstone' } } },
      };
      expect(() => extractVideoData(response, 'graphql')).toThrow('deleted');
    });

    it('throws on TweetUnavailable', () => {
      const response = {
        data: { tweetResult: { result: { __typename: 'TweetUnavailable' } } },
      };
      expect(() => extractVideoData(response, 'graphql')).toThrow('unavailable');
    });

    it('unwraps TweetWithVisibilityResults', () => {
      const response = {
        data: {
          tweetResult: {
            result: {
              __typename: 'TweetWithVisibilityResults',
              tweet: {
                legacy: {
                  id_str: '555',
                  extended_entities: {
                    media: [{
                      type: 'video',
                      video_info: {
                        duration_millis: 10000,
                        variants: [
                          { content_type: 'video/mp4', bitrate: 1500000, url: 'https://video.twimg.com/ext_tw_video/555/pu/vid/1280x720/xyz.mp4' },
                        ],
                      },
                    }],
                  },
                },
                core: { user_results: { result: { legacy: { screen_name: 'wrapped' } } } },
              },
            },
          },
        },
      };
      const result = extractVideoData(response, 'graphql');
      expect(result).not.toBeNull();
      expect(result.username).toBe('wrapped');
    });

    it('returns null when TweetWithVisibilityResults wraps null tweet', () => {
      const response = {
        data: {
          tweetResult: {
            result: {
              __typename: 'TweetWithVisibilityResults',
              tweet: null,
            },
          },
        },
      };
      expect(extractVideoData(response, 'graphql')).toBeNull();
    });

    it('throws on age-restricted content without media', () => {
      const response = {
        data: {
          tweetResult: {
            result: {
              __typename: 'Tweet',
              legacy: {
                id_str: '777',
                possibly_sensitive: true,
                // no extended_entities
              },
              core: { user_results: { result: { legacy: { screen_name: 'restricted' } } } },
            },
          },
        },
      };
      expect(() => extractVideoData(response, 'graphql')).toThrow('age-restricted');
    });

    it('extracts video data from standard graphql response', () => {
      const response = {
        data: {
          tweetResult: {
            result: {
              __typename: 'Tweet',
              legacy: {
                id_str: '456',
                extended_entities: {
                  media: [{
                    type: 'video',
                    video_info: {
                      duration_millis: 60000,
                      variants: [
                        { content_type: 'video/mp4', bitrate: 2000000, url: 'https://video.twimg.com/ext_tw_video/456/pu/vid/1920x1080/hd.mp4' },
                        { content_type: 'video/mp4', bitrate: 500000, url: 'https://video.twimg.com/ext_tw_video/456/pu/vid/480x270/sd.mp4' },
                      ],
                    },
                  }],
                },
              },
              core: { user_results: { result: { legacy: { screen_name: 'gqluser' } } } },
            },
          },
        },
      };
      const result = extractVideoData(response, 'graphql');
      expect(result.tweetId).toBe('456');
      expect(result.username).toBe('gqluser');
      expect(result.videos[0].variants[0].resolution).toBe('1920x1080');
    });

    it('handles camelCase contentType from graphql variants', () => {
      const response = {
        data: {
          tweetResult: {
            result: {
              __typename: 'Tweet',
              legacy: {
                id_str: '888',
                extended_entities: {
                  media: [{
                    type: 'video',
                    video_info: {
                      duration_millis: 5000,
                      variants: [
                        { contentType: 'video/mp4', bitrate: 1000000, url: 'https://video.twimg.com/ext_tw_video/888/pu/vid/1280x720/camel.mp4' },
                      ],
                    },
                  }],
                },
              },
              core: { user_results: { result: { legacy: { screen_name: 'cameluser' } } } },
            },
          },
        },
      };
      const result = extractVideoData(response, 'graphql');
      expect(result).not.toBeNull();
      expect(result.videos[0].variants).toHaveLength(1);
      expect(result.videos[0].variants[0].contentType).toBe('video/mp4');
    });

    it('handles multi-video graphql response', () => {
      const response = {
        data: {
          tweetResult: {
            result: {
              __typename: 'Tweet',
              legacy: {
                id_str: '444',
                extended_entities: {
                  media: [
                    {
                      type: 'video',
                      video_info: {
                        duration_millis: 15000,
                        variants: [
                          { content_type: 'video/mp4', bitrate: 1500000, url: 'https://video.twimg.com/ext_tw_video/444/pu/vid/1280x720/v1.mp4' },
                        ],
                      },
                    },
                    {
                      type: 'animated_gif',
                      video_info: {
                        duration_millis: 0,
                        variants: [
                          { content_type: 'video/mp4', bitrate: 0, url: 'https://video.twimg.com/tweet_video/gif.mp4' },
                        ],
                      },
                    },
                  ],
                },
              },
              core: { user_results: { result: { legacy: { screen_name: 'multiuser' } } } },
            },
          },
        },
      };
      const result = extractVideoData(response, 'graphql');
      expect(result.videos).toHaveLength(2);
      expect(result.videos[0].type).toBe('video');
      expect(result.videos[1].type).toBe('animated_gif');
    });
  });

  describe('unknown source', () => {
    it('throws for unknown source', () => {
      expect(() => extractVideoData({}, 'unknown')).toThrow('Unknown source');
    });
  });
});
