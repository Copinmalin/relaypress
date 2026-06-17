import type { PublicationPublisher, PublisherPlatform } from "./types.js";

export function createMockPublisher(platform: PublisherPlatform): PublicationPublisher {
  return {
    platform,
    mode: "mock",
    component: `${platform}-mock-publisher`,
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
          mode: "mock",
          platform: job.platform,
          externalPostId,
          contentLength: job.adapted_content?.length ?? 0,
        },
      };
    },
  };
}
