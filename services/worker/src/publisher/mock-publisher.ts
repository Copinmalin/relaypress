import type { PublicationPublisher, PublisherPlatform } from "./types.js";

export function createMockPublisher(platform: PublisherPlatform): PublicationPublisher {
  return {
    mode: `${platform}_mock`,
    component: `${platform}-mock-publisher`,
    supportedPlatforms: [platform],
    isReady: async () => ({ ready: true }),
    publish: async (job) => {
      if (job.platform !== platform) {
        throw new Error(`Mock publisher for ${platform} cannot publish platform: ${job.platform}`);
      }

      const externalPostId = `mock:${job.platform}:${job.id}`;

      return {
        externalPostId,
        rawResponse: {
          ok: true,
          mode: `${platform}_mock`,
          platform: job.platform,
          externalPostId,
          contentLength: job.adapted_content?.length ?? 0,
        },
      };
    },
  };
}
